import os from "node:os";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import fs from "fs-extra";
import { z } from "zod";
import { logger as rootLogger, type Logger } from "./logger.js";
import { commandExists, run } from "./shell.js";

/**
 * LLM access for the factory, with two interchangeable Claude providers:
 *
 *  1. "anthropic-api" — the official Anthropic SDK (needs ANTHROPIC_API_KEY).
 *     Streaming + finalMessage() for long outputs, adaptive thinking, explicit effort,
 *     server-side refusal fallbacks (`fallbacks: "default"`), typed errors.
 *  2. "claude-cli"    — the locally installed Claude Code CLI in headless mode
 *     (`claude -p --tools "" --output-format json`). Uses the user's existing Claude login, so
 *     the pipeline gets LLM-quality output with zero API keys (the same mechanism site-facelift uses).
 *
 * `initLLM()` picks the provider once per run (config `llm.provider`: auto | api | cli | off).
 * Callers check `llmAvailable()` and must always have a deterministic fallback.
 */

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";
export type LLMProvider = "anthropic-api" | "claude-cli";
export type LLMMode = "auto" | "api" | "cli" | "off";

export const DEFAULT_MODEL = "claude-opus-5-5";
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

export class LLMUnavailableError extends Error {
  constructor(message = "No LLM provider available (set ANTHROPIC_API_KEY in .env, or install and log in to the Claude Code CLI)") {
    super(message);
    this.name = "LLMUnavailableError";
  }
}

export class LLMRefusalError extends Error {
  readonly category: string | null;
  constructor(category: string | null, explanation?: string | null) {
    super(`Claude declined the request${category ? ` (category: ${category})` : ""}${explanation ? `: ${explanation}` : ""}`);
    this.name = "LLMRefusalError";
    this.category = category;
  }
}

let provider: LLMProvider | null = null;
let initialized = false;
let client: Anthropic | null = null;
let cliTimeoutMs = 10 * 60 * 1000;
let exhaustedReason: string | null = null;

/**
 * Variables a Claude Code session exports to the processes it starts. A nested headless `claude`
 * must not inherit them: they tie the child to the parent session (session id, messaging socket)
 * and — CLAUDE_EFFORT — would silently run every nested call at the parent's effort level.
 */
const CLAUDE_SESSION_VARS = [
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_SESSION_ATTENDED",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_CODE_EXECPATH",
  "CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING",
  "CLAUDE_CODE_ENABLE_TASKS",
  "CLAUDE_CODE_QUESTION_PREVIEW_FORMAT",
  "CLAUDE_CODE_EMIT_STARTUP_TIMING",
  "CLAUDE_AGENT_SDK_VERSION",
  "CLAUDE_PID",
  "CLAUDE_EFFORT",
];

/** Environment overrides for a nested `claude` process (session markers removed, `extra` applied). */
export function nestedClaudeEnv(extra: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of CLAUDE_SESSION_VARS) env[key] = undefined;
  return { ...env, ...extra };
}

const UNAVAILABLE_PATTERN =
  /hit your (?:\w+ )?limit|(?:session|usage|weekly|daily|monthly) limit|rate[ -]?limit(?:ed| reached| exceeded)|quota|credit balance|invalid api key|please run \/login|not logged in|oauth token (?:has )?expired|authentication_error|401 unauthorized/i;

/** True when Claude's error output means no further call can succeed in this run (limits, auth). */
export function isClaudeUnavailableText(text: string): boolean {
  return UNAVAILABLE_PATTERN.test(text);
}

/**
 * Stop every Claude call for the rest of the run (session/usage limit, auth failure). The pipeline
 * keeps going with its deterministic paths instead of burning time on calls that cannot succeed.
 */
export function markLLMExhausted(reason: string, log: Logger = rootLogger): void {
  initialized = true;
  provider = null;
  if (exhaustedReason) return;
  exhaustedReason = reason;
  log.warn(`Claude is unavailable for the rest of this run (${reason}) — continuing without AI: deterministic page composer, no AI review.`);
}

/** Why Claude was switched off mid-run, or null. */
export function llmExhaustedReason(): string | null {
  return exhaustedReason;
}

function isFatalLLMError(err: unknown): boolean {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError || err instanceof Anthropic.RateLimitError) return true;
  return err instanceof Error && isClaudeUnavailableText(err.message);
}

/** Run an LLM call; on a fatal error (limits, auth) switch Claude off for the rest of the run, then rethrow. */
async function guarded<T>(log: Logger, call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if (isFatalLLMError(err)) markLLMExhausted(describeLLMError(err).slice(0, 160), log);
    throw err;
  }
}

function hasApiKey(): boolean {
  const key = process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim();
  return Boolean(key) && key !== "sk-ant-...";
}

/** Choose the LLM provider for this run. Safe to call more than once (re-initializes). */
export async function initLLM(opts: { mode: LLMMode | boolean; cliTimeoutMs?: number; logger?: Logger }): Promise<LLMProvider | null> {
  const log = opts.logger ?? rootLogger;
  const mode: LLMMode = opts.mode === true ? "auto" : opts.mode === false ? "off" : opts.mode;
  if (opts.cliTimeoutMs) cliTimeoutMs = opts.cliTimeoutMs;
  initialized = true;
  provider = null;
  if (mode === "off") {
    log.info("LLM: disabled — deterministic generation only");
    return null;
  }
  if ((mode === "auto" || mode === "api") && hasApiKey()) {
    provider = "anthropic-api";
  } else if ((mode === "auto" || mode === "cli") && (await commandExists("claude"))) {
    provider = "claude-cli";
  }
  if (provider) log.info(`LLM: using ${provider === "anthropic-api" ? "Anthropic API (ANTHROPIC_API_KEY)" : "Claude Code CLI (claude -p)"}`);
  else log.warn(`LLM: no provider available for mode "${mode}" — deterministic generation only`);
  return provider;
}

/** Disable every LLM call for the rest of the run (`--no-ai`). */
export function disableLLM(): void {
  initialized = true;
  provider = null;
}

/** Test helper: forget provider selection, any mid-run exhaustion and CLI model fallbacks. */
export function resetLLMState(): void {
  initialized = false;
  provider = null;
  exhaustedReason = null;
  cliModelFallback.clear();
}

export function llmProvider(): LLMProvider | null {
  if (!initialized && hasApiKey()) return "anthropic-api";
  return provider;
}

/** True when an LLM call can be attempted. */
export function llmAvailable(): boolean {
  return llmProvider() !== null;
}

function getClient(): Anthropic {
  if (!hasApiKey()) throw new LLMUnavailableError("ANTHROPIC_API_KEY is not set");
  if (!client) client = new Anthropic({ maxRetries: 0, timeout: 15 * 60 * 1000 });
  return client;
}

export interface GenerateTextOptions {
  system: string;
  prompt: string;
  model?: string;
  effort?: Effort;
  maxTokens?: number;
  /** Short label for logs, e.g. "json-render:01-minimalist". */
  label: string;
  logger?: Logger;
}

export interface GenerateTextResult {
  text: string;
  stopReason: string | null;
  model: string;
  provider: LLMProvider;
  inputTokens: number;
  outputTokens: number;
}

function isFallbackParamRejection(err: unknown): boolean {
  return err instanceof Anthropic.BadRequestError && /fallback/i.test(err.message);
}

function collectText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

/** Generate free-form text. Throws LLMUnavailableError / LLMRefusalError / provider errors. */
export async function generateText(opts: GenerateTextOptions): Promise<GenerateTextResult> {
  const p = llmProvider();
  if (!p) throw new LLMUnavailableError(exhaustedReason ? `Claude unavailable: ${exhaustedReason}` : undefined);
  return guarded(opts.logger ?? rootLogger, () => (p === "anthropic-api" ? generateTextApi(opts) : generateTextCli(opts)));
}

async function generateTextApi(opts: GenerateTextOptions): Promise<GenerateTextResult> {
  const log = opts.logger ?? rootLogger;
  const anthropic = getClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const started = Date.now();
  log.debug(`[llm:${opts.label}] api request model=${model} effort=${opts.effort ?? "medium"} system=${opts.system.length}ch prompt=${opts.prompt.length}ch`);

  const base = {
    model,
    max_tokens: opts.maxTokens ?? 32000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: opts.effort ?? ("medium" as Effort) },
    system: opts.system,
    messages: [{ role: "user" as const, content: opts.prompt }],
  };

  const runOnce = async (withFallbacks: boolean) => {
    const stream = withFallbacks
      ? anthropic.beta.messages.stream({ ...base, betas: [FALLBACK_BETA], fallbacks: "default" })
      : anthropic.beta.messages.stream(base);
    return stream.finalMessage();
  };

  let message;
  try {
    message = await runOnce(true);
  } catch (err) {
    if (!isFallbackParamRejection(err)) throw err;
    log.debug(`[llm:${opts.label}] fallbacks parameter rejected; retrying without it`);
    message = await runOnce(false);
  }

  if (message.stop_reason === "refusal") {
    const details = (message as { stop_details?: { category?: string | null; explanation?: string | null } | null }).stop_details;
    throw new LLMRefusalError(details?.category ?? null, details?.explanation ?? null);
  }
  const result: GenerateTextResult = {
    text: collectText(message.content as Array<{ type: string; text?: string }>),
    stopReason: message.stop_reason ?? null,
    model: message.model,
    provider: "anthropic-api",
    inputTokens: message.usage?.input_tokens ?? 0,
    outputTokens: message.usage?.output_tokens ?? 0,
  };
  log.debug(`[llm:${opts.label}] done in ${Date.now() - started}ms stop=${result.stopReason} in=${result.inputTokens} out=${result.outputTokens}`);
  if (result.stopReason === "max_tokens") log.warn(`[llm:${opts.label}] response hit max_tokens; output may be truncated`);
  return result;
}

interface CliJsonResult {
  result?: string;
  is_error?: boolean;
  stop_reason?: string;
  subtype?: string;
  structured_output?: unknown;
  usage?: { input_tokens?: number; output_tokens?: number };
  modelUsage?: Record<string, unknown>;
}

/** Model the installed CLI accepts in place of a configured model ID it rejected (per run). */
const cliModelFallback = new Map<string, string>();
const UNSUPPORTED_MODEL = /does not support this model|model (?:is )?not (?:supported|available|found)|invalid model|unknown model/i;

/** The CLI alias of a model ID ("claude-opus-5-5" → "opus"); the CLI resolves it to the newest model it knows. */
export function cliModelAlias(model: string): string | null {
  const family = model.toLowerCase().match(/\b(opus|sonnet|haiku|fable)\b/)?.[1];
  return family && family !== model.toLowerCase() ? family : null;
}

/**
 * One headless CLI call. An older Claude Code rejects model IDs newer than itself ("version X or
 * newer is required"); the call is then retried once with the family alias, which every version
 * resolves to the newest model it supports, and the alias is used for the rest of the run.
 */
async function runClaudeCli(opts: GenerateTextOptions & { jsonSchema?: object }): Promise<{ parsed: CliJsonResult; model: string }> {
  const log = opts.logger ?? rootLogger;
  const requested = opts.model ?? DEFAULT_MODEL;
  const model = cliModelFallback.get(requested) ?? requested;
  try {
    return await runClaudeCliWith(opts, model);
  } catch (err) {
    const alias = cliModelAlias(model);
    if (!alias || !(err instanceof Error) || !UNSUPPORTED_MODEL.test(err.message)) throw err;
    cliModelFallback.set(requested, alias);
    log.warn(`The installed Claude Code CLI does not support ${model}; using the "${alias}" alias instead (run \`claude update\` to use ${model}).`);
    return runClaudeCliWith(opts, alias);
  }
}

async function runClaudeCliWith(opts: GenerateTextOptions & { jsonSchema?: object }, model: string): Promise<{ parsed: CliJsonResult; model: string }> {
  const log = opts.logger ?? rootLogger;
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "asf-llm-"));
  const sysFile = path.join(tmpDir, "system.txt");
  await fs.writeFile(sysFile, opts.system, "utf8");
  const args = [
    "-p",
    "--system-prompt-file",
    sysFile,
    "--tools",
    "",
    "--output-format",
    "json",
    "--no-session-persistence",
    "--model",
    model,
    "--effort",
    opts.effort ?? "medium",
  ];
  if (opts.jsonSchema) args.push("--json-schema", JSON.stringify(opts.jsonSchema));
  const started = Date.now();
  log.debug(`[llm:${opts.label}] cli request model=${model} system=${opts.system.length}ch prompt=${opts.prompt.length}ch`);
  try {
    const res = await run("claude", args, {
      input: opts.prompt,
      timeoutMs: cliTimeoutMs,
      label: `claude:${opts.label}`,
      logger: log,
      quiet: true,
      cwd: tmpDir,
      env: nestedClaudeEnv(),
    });
    let parsed: CliJsonResult;
    try {
      const jsonStart = res.stdout.indexOf("{");
      parsed = JSON.parse(jsonStart >= 0 ? res.stdout.slice(jsonStart) : res.stdout) as CliJsonResult;
    } catch {
      throw new Error(`claude CLI returned non-JSON output (exit ${res.exitCode}): ${res.all.slice(-500)}`);
    }
    if (res.failed || parsed.is_error) {
      throw new Error(`claude CLI failed (exit ${res.exitCode}${res.timedOut ? ", timeout" : ""}): ${String(parsed.result ?? res.all).slice(-500)}`);
    }
    if (parsed.stop_reason === "refusal") throw new LLMRefusalError(null, String(parsed.result ?? ""));
    log.debug(`[llm:${opts.label}] cli done in ${Date.now() - started}ms stop=${parsed.stop_reason ?? "?"}`);
    return { parsed, model };
  } finally {
    await fs.remove(tmpDir).catch(() => undefined);
  }
}

async function generateTextCli(opts: GenerateTextOptions): Promise<GenerateTextResult> {
  const { parsed, model } = await runClaudeCli(opts);
  return {
    text: String(parsed.result ?? ""),
    stopReason: parsed.stop_reason ?? null,
    model,
    provider: "claude-cli",
    inputTokens: parsed.usage?.input_tokens ?? 0,
    outputTokens: parsed.usage?.output_tokens ?? 0,
  };
}

export interface GenerateStructuredOptions<S extends z.ZodType> extends Omit<GenerateTextOptions, "maxTokens"> {
  schema: S;
  maxTokens?: number;
}

/** Extract the first JSON value from model text (handles ```json fences and surrounding prose). */
export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start < 0) throw new Error("no JSON found in model output");
  const open = candidate[start];
  const close = open === "{" ? "}" : "]";
  const end = candidate.lastIndexOf(close);
  return JSON.parse(candidate.slice(start, end + 1));
}

/** Generate a JSON object validated against a Zod schema. */
export async function generateStructured<S extends z.ZodType>(opts: GenerateStructuredOptions<S>): Promise<z.infer<S>> {
  const p = llmProvider();
  if (!p) throw new LLMUnavailableError(exhaustedReason ? `Claude unavailable: ${exhaustedReason}` : undefined);
  const log = opts.logger ?? rootLogger;
  return guarded(log, () => generateStructuredWith(p, opts, log));
}

async function generateStructuredWith<S extends z.ZodType>(p: LLMProvider, opts: GenerateStructuredOptions<S>, log: Logger): Promise<z.infer<S>> {
  if (p === "claude-cli") {
    const jsonSchema = z.toJSONSchema(opts.schema) as object;
    const { parsed } = await runClaudeCli({
      ...opts,
      system: `${opts.system}\n\nRespond with ONLY a JSON value that conforms to the provided JSON schema. No prose, no code fences.`,
      jsonSchema,
    });
    const raw = parsed.structured_output ?? extractJson(String(parsed.result ?? ""));
    const checked = opts.schema.safeParse(raw);
    if (!checked.success) throw new Error(`[llm:${opts.label}] structured output failed validation: ${checked.error.message}`);
    return checked.data;
  }

  const anthropic = getClient();
  const model = opts.model ?? DEFAULT_MODEL;
  const started = Date.now();
  const base = {
    model,
    max_tokens: opts.maxTokens ?? 16000,
    thinking: { type: "adaptive" as const },
    output_config: { effort: opts.effort ?? ("medium" as Effort), format: betaZodOutputFormat(opts.schema) },
    system: opts.system,
    messages: [{ role: "user" as const, content: opts.prompt }],
  };
  log.debug(`[llm:${opts.label}] structured api request model=${model}`);

  const runOnce = (withFallbacks: boolean) =>
    withFallbacks
      ? anthropic.beta.messages.parse({ ...base, betas: [FALLBACK_BETA], fallbacks: "default" })
      : anthropic.beta.messages.parse(base);

  let response;
  try {
    response = await runOnce(true);
  } catch (err) {
    if (!isFallbackParamRejection(err)) throw err;
    response = await runOnce(false);
  }
  if (response.stop_reason === "refusal") {
    const details = (response as { stop_details?: { category?: string | null; explanation?: string | null } | null }).stop_details;
    throw new LLMRefusalError(details?.category ?? null, details?.explanation ?? null);
  }
  const parsedOutput = response.parsed_output;
  if (parsedOutput === null || parsedOutput === undefined) {
    throw new Error(`[llm:${opts.label}] structured output could not be parsed (stop_reason=${response.stop_reason})`);
  }
  log.debug(`[llm:${opts.label}] structured done in ${Date.now() - started}ms`);
  return parsedOutput as z.infer<S>;
}

/** Human-readable reason an LLM call failed, for degradation warnings. */
export function describeLLMError(err: unknown): string {
  if (err instanceof LLMUnavailableError) return err.message;
  if (err instanceof LLMRefusalError) return err.message;
  if (err instanceof Anthropic.AuthenticationError) return "invalid Anthropic API key";
  if (err instanceof Anthropic.RateLimitError) return "Anthropic rate limit reached";
  if (err instanceof Anthropic.APIError) return `Anthropic API error ${err.status ?? ""}: ${err.message}`;
  return err instanceof Error ? err.message : String(err);
}
