import chalk from "chalk";
import { DEFAULT_FLAGS, type CliFlags } from "./utils/config.js";

/**
 * Command-line parsing for `npm start` / `npm run generate-websites` (and the /generate-websites
 * Claude Code command, which calls the latter). Pure functions — no filesystem access — so they
 * can be tested without starting the pipeline.
 */

export const USAGE = `
${chalk.bold("artist-site-factory")} — turn inspirational artist websites into six unique Next.js sites

Usage:
  npm run generate-websites -- --urls <url1> <url2> ... [options]
  npm start [-- options]                      (uses the URLs saved in config/urls.txt)

Options:
  --urls <url...>    inspiration websites (saved to config/urls.txt so a later run can resume)
  --urls <file>      read the inspiration URLs from another file instead
  --no-ai            never call Claude: deterministic page composer, no AI review
  --fresh            ignore previous progress and start from phase 1
  --from <n>         re-run from phase n (1-9) onwards
  --variations <n>   generate only the first n design briefs
  --verbose          show tool output in the terminal (always written to factory.log)
  --reset            delete generated sites, artifacts, logs and progress markers, then exit
  --help             show this help
`;

export interface ParsedArgs extends CliFlags {
  help: boolean;
  /** Values given with --urls or as bare arguments: website addresses, or a single file path. */
  urlInputs: string[];
}

const splitList = (value: string) => value.split(/[\s,]+/).filter(Boolean);

export function parseArgs(argv: string[]): ParsedArgs {
  const flags: ParsedArgs = { ...DEFAULT_FLAGS, help: false, urlInputs: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("-")) {
      flags.urlInputs.push(...splitList(arg));
      continue;
    }
    const [key, inline] = arg.includes("=") ? [arg.slice(0, arg.indexOf("=")), arg.slice(arg.indexOf("=") + 1)] : [arg, undefined];
    const value = () => {
      const v = inline ?? argv[++i];
      if (v === undefined || v.startsWith("--")) throw new Error(`Missing value for ${key}`);
      return v;
    };
    switch (key) {
      case "--urls": {
        const values = inline !== undefined ? splitList(inline) : [];
        while (inline === undefined && i + 1 < argv.length && !argv[i + 1].startsWith("-")) values.push(...splitList(argv[++i]));
        if (!values.length) throw new Error("--urls needs at least one website address (or a file with one URL per line)");
        flags.urlInputs.push(...values);
        break;
      }
      case "--fresh":
        flags.fresh = true;
        break;
      case "--from": {
        const n = Number.parseInt(value(), 10);
        if (!Number.isInteger(n) || n < 1 || n > 9) throw new Error("--from expects a phase number between 1 and 9");
        flags.fromPhase = n;
        break;
      }
      case "--variations": {
        const n = Number.parseInt(value(), 10);
        if (!Number.isInteger(n) || n < 1) throw new Error("--variations expects a positive number");
        flags.variations = n;
        break;
      }
      case "--no-ai":
        flags.noAi = true;
        break;
      case "--verbose":
        flags.verbose = true;
        break;
      case "--reset":
        flags.reset = true;
        break;
      case "--help":
      case "-h":
        flags.help = true;
        break;
      default:
        throw new Error(`Unknown option "${arg}". Run \`npm start -- --help\`.`);
    }
  }
  return flags;
}

/** Normalize one website address: trims quotes/brackets, adds https:// when missing. Null if it is not a web URL. */
export function normalizeUrl(raw: string): string | null {
  const line = raw.trim().replace(/^[<"'(\[]+|[>"')\],;]+$/g, "");
  if (!line) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(line) ? line : `https://${line}`;
  try {
    const u = new URL(candidate);
    if (!/^https?:$/.test(u.protocol) || !u.hostname.includes(".") || /\s/.test(line)) return null;
    return u.href;
  } catch {
    return null;
  }
}

/** Normalize a list of addresses, dropping duplicates. */
export function normalizeUrls(inputs: string[]): { urls: string[]; invalid: string[] } {
  const urls: string[] = [];
  const invalid: string[] = [];
  for (const input of inputs) {
    const url = normalizeUrl(input);
    if (!url) invalid.push(input);
    else if (!urls.includes(url)) urls.push(url);
  }
  return { urls, invalid };
}

/** Parse a URLs file: one URL per line, `#` comments and blank lines ignored, https:// added if missing. */
export function parseUrls(text: string): { urls: string[]; invalid: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  return normalizeUrls(lines);
}

/** The example addresses shipped in config/urls.txt (example.com, example-artist-1.com, …). */
export function isPlaceholderUrl(url: string): boolean {
  try {
    return /^(?:www\.)?example(?:-[a-z0-9-]+)?\.(?:com|org|net)$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Contents written to config/urls.txt when URLs are given on the command line. */
export function renderUrlsFile(urls: string[], date: string): string {
  return [
    "# Inspiration websites for artist-site-factory — one URL per line; lines starting with # are ignored.",
    `# Saved by --urls on ${date}. \`npm start\` (or /generate-websites without --urls) resumes or re-runs with this list.`,
    ...urls,
    "",
  ].join("\n");
}

export const NO_URLS_HELP = `
  Tell the factory which artist websites inspire you, for example:
    npm run generate-websites -- --urls https://first-artist.com https://second-artist.com
  In Claude Code:
    /generate-websites --urls https://first-artist.com https://second-artist.com
  Or list them in config/urls.txt (one per line) and run npm start.
`;
