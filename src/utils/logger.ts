import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import ora, { type Ora } from "ora";

/**
 * Factory logger.
 *
 * - Console: colored, human friendly, cooperates with one active `ora` spinner.
 * - File (`factory.log`): every line, including subprocess output (DEBUG), in the format
 *   `[2026-01-15T10:23:45Z] [INFO] message` so any failure can be diagnosed from the log alone.
 */

export type LogLevel = "DEBUG" | "INFO" | "SUCCESS" | "WARN" | "ERROR";

const LEVEL_ORDER: Record<LogLevel, number> = { DEBUG: 10, INFO: 20, SUCCESS: 25, WARN: 30, ERROR: 40 };

export function isoTimestamp(date = new Date()): string {
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}

function formatError(err: unknown): string {
  if (err instanceof Error) {
    return err.stack ?? `${err.name}: ${err.message}`;
  }
  try {
    return typeof err === "string" ? err : JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export class Logger {
  private fileStream: fs.WriteStream | null = null;
  private spinner: Ora | null = null;
  private consoleLevel: LogLevel = "INFO";
  readonly prefix: string;
  private root: Logger | null;

  constructor(opts: { logFile?: string; verbose?: boolean; prefix?: string; root?: Logger } = {}) {
    this.prefix = opts.prefix ?? "";
    this.root = opts.root ?? null;
    if (!this.root) {
      if (opts.logFile) this.attachFile(opts.logFile);
      if (opts.verbose) this.consoleLevel = "DEBUG";
    }
  }

  /** Open (append) the log file. Safe to call once. */
  attachFile(logFile: string): void {
    const target = this.root ?? this;
    if (target.fileStream) return;
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    target.fileStream = fs.createWriteStream(logFile, { flags: "a", encoding: "utf8" });
  }

  setVerbose(verbose: boolean): void {
    const target = this.root ?? this;
    target.consoleLevel = verbose ? "DEBUG" : "INFO";
  }

  /** A logger that prefixes every message, e.g. `logger.child("chhapify")` → "[chhapify] …". */
  child(prefix: string): Logger {
    const combined = this.prefix ? `${this.prefix}:${prefix}` : prefix;
    return new Logger({ prefix: combined, root: this.root ?? this });
  }

  debug(message: string): void {
    this.write("DEBUG", message);
  }
  info(message: string): void {
    this.write("INFO", message);
  }
  success(message: string): void {
    this.write("SUCCESS", message);
  }
  warn(message: string, err?: unknown): void {
    this.write("WARN", err === undefined ? message : `${message} — ${err instanceof Error ? err.message : formatError(err)}`);
    if (err !== undefined) this.write("DEBUG", formatError(err), { consoleOnlyIfVerbose: true });
  }
  error(message: string, err?: unknown): void {
    this.write("ERROR", err === undefined ? message : `${message} — ${err instanceof Error ? err.message : formatError(err)}`);
    if (err !== undefined) this.write("DEBUG", formatError(err), { consoleOnlyIfVerbose: true });
  }

  /** Subprocess output line: always written to factory.log, shown on console only with --verbose. */
  subprocess(label: string, line: string): void {
    this.write("DEBUG", `[${label}] ${line}`, { consoleOnlyIfVerbose: true });
  }

  /** Run `fn` under an ora spinner. The spinner succeeds/fails with the returned/thrown outcome. */
  async withSpinner<T>(text: string, fn: (update: (text: string) => void) => Promise<T>, doneText?: (result: T) => string): Promise<T> {
    const target = this.root ?? this;
    const spinner = ora({ text, isEnabled: Boolean(process.stdout.isTTY) && !process.env.CI });
    target.spinner = spinner;
    spinner.start();
    this.writeFileOnly("INFO", text);
    try {
      const result = await fn((t) => {
        spinner.text = t;
      });
      target.spinner = null;
      const finalText = doneText ? doneText(result) : text;
      spinner.succeed(finalText);
      this.writeFileOnly("SUCCESS", finalText);
      return result;
    } catch (err) {
      target.spinner = null;
      spinner.fail(`${text} — failed`);
      this.writeFileOnly("ERROR", `${text} — failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  /** Flush and close the file stream. */
  async close(): Promise<void> {
    const target = this.root ?? this;
    const stream = target.fileStream;
    target.fileStream = null;
    if (!stream) return;
    await new Promise<void>((resolve) => stream.end(resolve));
  }

  private writeFileOnly(level: LogLevel, message: string): void {
    const target = this.root ?? this;
    const text = this.prefix ? `[${this.prefix}] ${message}` : message;
    const lines = text.split(/\r?\n/);
    const stamp = isoTimestamp();
    for (const line of lines) {
      target.fileStream?.write(`[${stamp}] [${level}] ${line}\n`);
    }
  }

  private write(level: LogLevel, message: string, opts: { consoleOnlyIfVerbose?: boolean } = {}): void {
    const target = this.root ?? this;
    this.writeFileOnly(level, message);
    const minLevel = opts.consoleOnlyIfVerbose ? "DEBUG" : target.consoleLevel;
    if (opts.consoleOnlyIfVerbose && target.consoleLevel !== "DEBUG") return;
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    const text = this.prefix ? `${chalk.dim(`[${this.prefix}]`)} ${message}` : message;
    const colored =
      level === "ERROR"
        ? chalk.red(`✖ ${text}`)
        : level === "WARN"
          ? chalk.yellow(`⚠ ${text}`)
          : level === "SUCCESS"
            ? chalk.green(`✔ ${text}`)
            : level === "DEBUG"
              ? chalk.gray(text)
              : text;
    const spinner = target.spinner;
    if (spinner?.isSpinning) {
      spinner.clear();
      process.stdout.write(`${colored}\n`);
      spinner.render();
    } else {
      process.stdout.write(`${colored}\n`);
    }
  }
}

/** Process-wide logger. `src/index.ts` attaches the log file and verbosity at startup. */
export const logger = new Logger();
