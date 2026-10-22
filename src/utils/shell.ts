import { execa } from "execa";
import { logger as rootLogger, type Logger } from "./logger.js";

/**
 * Subprocess helpers. Every line of output is mirrored to factory.log (DEBUG) under a label,
 * so failures of external tools (chhapify, npm, next, python, git, claude) are diagnosable.
 * `run` never throws for a non-zero exit code — inspect `RunResult.failed`.
 */

export interface RunOptions {
  cwd?: string;
  /** Extra environment variables. A value of `undefined` REMOVES that variable from the child env. */
  env?: Record<string, string | undefined>;
  /** Kill the whole process tree after this many ms. */
  timeoutMs?: number;
  /** Prefix used for log lines (defaults to the command name). */
  label?: string;
  logger?: Logger;
  /** Text written to stdin. */
  input?: string;
  /** Do not mirror output lines to the log (still captured in the result). */
  quiet?: boolean;
  /** Keep at most this many characters of each captured stream (tail). Default 2,000,000. */
  maxBufferChars?: number;
}

export interface RunResult {
  command: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  /** Interleaved stdout + stderr. */
  all: string;
  timedOut: boolean;
  failed: boolean;
  durationMs: number;
  /** Spawn error message (e.g. ENOENT) when the process could not start. */
  errorMessage?: string;
}

export const isWindows = process.platform === "win32";

function buildEnv(extra?: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined) env[k] = v;
  }
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v === undefined) {
        // Windows env keys are case-insensitive.
        for (const key of Object.keys(env)) {
          if (key.toLowerCase() === k.toLowerCase()) delete env[key];
        }
      } else {
        env[k] = v;
      }
    }
  }
  return env;
}

function keepTail(text: string, max: number): string {
  return text.length > max ? `…[truncated]…\n${text.slice(text.length - max)}` : text;
}

export function quoteArg(arg: string): string {
  return /[\s"]/u.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

/** Run a command to completion. Never throws on non-zero exit; check `result.failed`. */
export async function run(file: string, args: string[] = [], opts: RunOptions = {}): Promise<RunResult> {
  const log = opts.logger ?? rootLogger;
  const label = opts.label ?? file;
  const max = opts.maxBufferChars ?? 2_000_000;
  const command = [file, ...args].map(quoteArg).join(" ");
  const started = Date.now();
  let stdout = "";
  let stderr = "";
  let all = "";
  let timedOut = false;

  log.debug(`$ ${command}${opts.cwd ? `   (cwd: ${opts.cwd})` : ""}`);

  const onLine = (stream: "stdout" | "stderr", line: string) => {
    if (stream === "stdout") stdout += `${line}\n`;
    else stderr += `${line}\n`;
    all += `${line}\n`;
    if (stdout.length > max * 1.5) stdout = keepTail(stdout, max);
    if (stderr.length > max * 1.5) stderr = keepTail(stderr, max);
    if (all.length > max * 1.5) all = keepTail(all, max);
    if (!opts.quiet && line.trim()) log.subprocess(label, line);
  };

  let subprocess: ReturnType<typeof execa> | null = null;
  try {
    subprocess = execa(file, args, {
      cwd: opts.cwd,
      env: buildEnv(opts.env),
      extendEnv: false,
      input: opts.input,
      reject: false,
      windowsHide: true,
      buffer: false,
      stdin: opts.input === undefined ? "ignore" : "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (err) {
    return {
      command,
      exitCode: null,
      stdout,
      stderr,
      all,
      timedOut,
      failed: true,
      durationMs: Date.now() - started,
      errorMessage: err instanceof Error ? err.message : String(err),
    };
  }

  const attach = (stream: NodeJS.ReadableStream | null | undefined, name: "stdout" | "stderr") => {
    if (!stream) return;
    let pending = "";
    stream.setEncoding?.("utf8");
    stream.on("data", (chunk: string | Buffer) => {
      pending += chunk.toString();
      const lines = pending.split(/\r?\n|\r(?!\n)/);
      pending = lines.pop() ?? "";
      for (const line of lines) onLine(name, line);
    });
    stream.on("end", () => {
      if (pending) onLine(name, pending);
      pending = "";
    });
  };
  attach(subprocess.stdout, "stdout");
  attach(subprocess.stderr, "stderr");

  const pid = subprocess.pid;
  const timer =
    opts.timeoutMs && opts.timeoutMs > 0
      ? setTimeout(() => {
          timedOut = true;
          log.warn(`${label}: timed out after ${Math.round((opts.timeoutMs ?? 0) / 1000)}s — killing process tree`);
          if (pid) void killTree(pid);
        }, opts.timeoutMs)
      : null;

  const result = await subprocess;
  if (timer) clearTimeout(timer);

  const exitCode = typeof result.exitCode === "number" ? result.exitCode : null;
  const spawnFailed = !pid || Boolean((result as { failed?: boolean; exitCode?: number }).failed && exitCode === null);
  const failed = timedOut || exitCode !== 0;
  const durationMs = Date.now() - started;
  log.debug(`${label}: exit ${exitCode ?? "n/a"}${timedOut ? " (timeout)" : ""} in ${durationMs}ms`);
  return {
    command,
    exitCode,
    stdout: stdout.trimEnd(),
    stderr: stderr.trimEnd(),
    all: all.trimEnd(),
    timedOut,
    failed,
    durationMs,
    errorMessage: spawnFailed ? ((result as { shortMessage?: string }).shortMessage ?? "failed to spawn process") : undefined,
  };
}

/** Run and throw a descriptive error (with the output tail) if the command fails. */
export async function runOrThrow(file: string, args: string[] = [], opts: RunOptions = {}): Promise<RunResult> {
  const result = await run(file, args, opts);
  if (result.failed) {
    const tail = result.all.split("\n").slice(-30).join("\n");
    throw new Error(
      `Command failed (${result.timedOut ? "timeout" : `exit ${result.exitCode}`}): ${result.command}${
        result.errorMessage ? `\n${result.errorMessage}` : ""
      }\n${tail}`,
    );
  }
  return result;
}

/** True if `cmd` resolves on PATH. */
export async function commandExists(cmd: string): Promise<boolean> {
  const probe = isWindows ? await run("where", [cmd], { quiet: true }) : await run("which", [cmd], { quiet: true });
  return !probe.failed && probe.stdout.trim().length > 0;
}

/** Kill a process and all of its children (taskkill /T on Windows). */
export async function killTree(pid: number): Promise<void> {
  try {
    if (isWindows) {
      await execa("taskkill", ["/pid", String(pid), "/T", "/F"], { reject: false, windowsHide: true });
    } else {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        process.kill(pid, "SIGKILL");
      }
    }
  } catch {
    // already gone
  }
}

export interface BackgroundProcess {
  pid: number | undefined;
  /** Captured output so far (tail). */
  output(): string;
  /** Resolve true when a line matching `pattern` appears, false on timeout or exit. */
  waitFor(pattern: RegExp, timeoutMs: number): Promise<boolean>;
  /** True once the process exited. */
  exited(): boolean;
  stop(): Promise<void>;
}

/** Start a long-running process (e.g. `next dev`) and return a handle to observe and stop it. */
export function spawnBackground(file: string, args: string[], opts: RunOptions = {}): BackgroundProcess {
  const log = opts.logger ?? rootLogger;
  const label = opts.label ?? file;
  let buffer = "";
  let done = false;
  const waiters: Array<{ pattern: RegExp; resolve: (ok: boolean) => void }> = [];

  log.debug(`$ ${[file, ...args].map(quoteArg).join(" ")} (background${opts.cwd ? `, cwd: ${opts.cwd}` : ""})`);
  const subprocess = execa(file, args, {
    cwd: opts.cwd,
    env: buildEnv(opts.env),
    extendEnv: false,
    reject: false,
    windowsHide: true,
    buffer: false,
    detached: !isWindows,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  const onChunk = (chunk: string | Buffer) => {
    const text = chunk.toString();
    buffer = keepTail(buffer + text, 200_000);
    for (const line of text.split(/\r?\n/)) {
      if (line.trim() && !opts.quiet) log.subprocess(label, line);
    }
    for (const w of [...waiters]) {
      if (w.pattern.test(buffer)) {
        waiters.splice(waiters.indexOf(w), 1);
        w.resolve(true);
      }
    }
  };
  subprocess.stdout?.on("data", onChunk);
  subprocess.stderr?.on("data", onChunk);
  void subprocess.then(() => {
    done = true;
    for (const w of waiters.splice(0)) w.resolve(false);
  });

  return {
    pid: subprocess.pid,
    output: () => buffer,
    exited: () => done,
    waitFor(pattern, timeoutMs) {
      if (pattern.test(buffer)) return Promise.resolve(true);
      if (done) return Promise.resolve(false);
      return new Promise<boolean>((resolve) => {
        const entry = { pattern, resolve };
        waiters.push(entry);
        setTimeout(() => {
          const i = waiters.indexOf(entry);
          if (i >= 0) {
            waiters.splice(i, 1);
            resolve(false);
          }
        }, timeoutMs);
      });
    },
    async stop() {
      if (done) return;
      if (subprocess.pid) await killTree(subprocess.pid);
      await Promise.race([subprocess, new Promise((r) => setTimeout(r, 5000))]);
      done = true;
    },
  };
}

/** `npm` / `npx` executable names (execa resolves .cmd shims on Windows). */
export const NPM = "npm";
export const NPX = "npx";
