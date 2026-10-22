import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import fs from "fs-extra";
import { z } from "zod";
import { readJsonValidated } from "./file-utils.js";

/**
 * Loads and validates every configuration file, and resolves all filesystem paths.
 * Agents must take paths from `FactoryContext.paths` — never hard-code them.
 */

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const AutoMode = z.union([z.enum(["auto", "on", "off"]), z.boolean()]);
export type AutoModeValue = z.infer<typeof AutoMode>;

export const FactoryConfigSchema = z.object({
  variations: z.number().int().min(1).max(12),
  siteLanguage: z.enum(["es", "en"]),
  locale: z.string(),
  llm: z.object({
    provider: z.enum(["auto", "api", "cli", "off"]),
    cliTimeoutMs: z.number().int(),
  }),
  paths: z.object({
    urlsFile: z.string(),
    outputDir: z.string(),
    artifactsDir: z.string(),
    vendorDir: z.string(),
    templatesDir: z.string(),
    promptsDir: z.string(),
    logFile: z.string(),
    stateFile: z.string(),
  }),
  concurrency: z.object({
    urls: z.number().int().min(1),
    /** Sites composed in parallel (matters only when Claude composes the pages). */
    projects: z.number().int().min(1),
    /** Sites reviewed in parallel by site-facelift's Claude review. */
    reviews: z.number().int().min(1).default(2),
    builds: z.number().int().min(1),
  }),
  acquisition: z.object({
    navigationTimeoutMs: z.number().int(),
    settleMs: z.number().int(),
    maxAssets: z.number().int(),
    maxAssetBytes: z.number().int(),
    crawlDepth: z.number().int().min(0),
    useFaceliftCrawler: z.boolean(),
    userAgent: z.string(),
  }),
  tools: z.object({
    chhapify: z.object({ enabled: z.boolean(), args: z.array(z.string()), timeoutMs: z.number().int() }),
    clooney: z.object({
      enabled: z.boolean(),
      repoUrls: z.array(z.string()),
      pinnedRefs: z.record(z.string(), z.string()),
      breakpoints: z.array(z.enum(["mobile", "tablet", "desktop"])),
      installTimeoutMs: z.number().int(),
      timeoutMs: z.number().int(),
    }),
    jsonRender: z.object({
      useLLM: AutoMode,
      model: z.string(),
      effort: z.enum(["low", "medium", "high", "xhigh", "max"]),
      maxTokens: z.number().int(),
      maxRepairAttempts: z.number().int().min(0),
    }),
    contentFetch: z.object({
      timeoutMs: z.number().int(),
      useBrowser: z.boolean(),
      useLLM: AutoMode,
      llmModel: z.string(),
      maxTopSongs: z.number().int(),
      maxPressQuotes: z.number().int(),
      maxVideos: z.number().int(),
      downloadImages: z.boolean(),
    }),
    facelift: z.object({
      enabled: z.boolean(),
      version: z.string(),
      aiReview: AutoMode,
      aiCleanup: AutoMode,
      /** Model for the Claude review/cleanup runs ("" = the Claude Code default). A copy-edit pass does not need the largest model. */
      model: z.string().default("sonnet"),
      effort: z.enum(["low", "medium", "high", "xhigh", "max", ""]).default("medium"),
      timeoutMs: z.number().int(),
    }),
  }),
  generation: z.object({
    /** Seed for the reproducible "random" choice of inspiration tokens per brief. */
    inspirationSeed: z.string(),
    /** Exact dependency versions written into every generated project's package.json. */
    dependencies: z.record(z.string(), z.string()),
    devDependencies: z.record(z.string(), z.string()),
  }),
  packaging: z.object({
    install: z.boolean(),
    installArgs: z.array(z.string()),
    build: z.boolean(),
    maxFixAttempts: z.number().int().min(0),
    installTimeoutMs: z.number().int(),
    buildTimeoutMs: z.number().int(),
    smokeTest: z.boolean(),
    smokeTestTimeoutMs: z.number().int(),
    smokeTestBasePort: z.number().int(),
  }),
});
export type FactoryConfig = z.infer<typeof FactoryConfigSchema>;

const FontSpecSchema = z.object({
  family: z.string(),
  /** Export name in next/font/google, e.g. "Playfair_Display". */
  importName: z.string(),
  weights: z.array(z.string()),
  styles: z.array(z.enum(["normal", "italic"])),
  fallback: z.array(z.string()),
});
export type FontSpec = z.infer<typeof FontSpecSchema>;

const CopyBlockSchema = z.record(z.string(), z.string());
const CopyLanguageSchema = z.record(z.string(), CopyBlockSchema);

export const DesignBriefSchema = z.object({
  id: z.string(),
  number: z.number().int(),
  slug: z.string(),
  name: z.string(),
  projectName: z.string(),
  promptFile: z.string(),
  templateDir: z.string(),
  keyCharacteristics: z.string(),
  mode: z.enum(["light", "dark"]),
  fonts: z.object({ display: FontSpecSchema, body: FontSpecSchema, mono: FontSpecSchema.nullable() }),
  palette: z.looseObject({ strategy: z.string(), fallbackHue: z.number() }),
  radius: z.object({ base: z.number(), sm: z.number(), lg: z.number() }),
  shadows: z.string(),
  motion: z.object({
    preset: z.string(),
    duration: z.number(),
    ease: z.union([z.array(z.number()), z.string()]),
    distance: z.number(),
  }),
  containerWidth: z.number().int(),
  sectionOrder: z.array(z.string()),
  dividers: z.object({ after: z.array(z.string()), variant: z.string() }),
  jsonRenderRules: z.array(z.string()),
  copy: z.object({ es: CopyLanguageSchema, en: CopyLanguageSchema }),
});
export type DesignBrief = z.infer<typeof DesignBriefSchema>;

export const DesignBriefsFileSchema = z.object({ version: z.number(), briefs: z.array(DesignBriefSchema).min(1) });

export const FeatureTypeDefSchema = z.object({
  component: z.string(),
  label: z.string(),
  alwaysInclude: z.boolean(),
  position: z.enum(["start", "end"]).optional(),
  contentPaths: z.array(z.string()),
  keywords: z.array(z.string()),
});
export type FeatureTypeDef = z.infer<typeof FeatureTypeDefSchema>;

export const FeatureMapSchema = z.object({
  version: z.number(),
  fallbackComponent: z.string(),
  baseline: z.array(z.string()),
  featureTypes: z.record(z.string(), FeatureTypeDefSchema),
  ignoredKeywords: z.array(z.string()),
});
export type FeatureMap = z.infer<typeof FeatureMapSchema>;

export const ArtistConfigSchema = z.object({
  slug: z.string(),
  searchName: z.string(),
  displayNameOverride: z.string().nullable(),
  requestedDisplayName: z.string().nullable().optional(),
  anchors: z.object({
    wikidataId: z.string().nullable(),
    musicbrainzId: z.string().nullable(),
    spotifyArtistId: z.string().nullable(),
    deezerArtistId: z.union([z.number(), z.string()]).nullable(),
    officialSite: z.string().nullable(),
    wikipediaTitles: z.object({ es: z.string().nullable(), en: z.string().nullable() }),
  }),
  ticketSearch: z.object({ ticketmasterKeyword: z.string(), countryCodes: z.array(z.string()) }),
  /**
   * Extra URLs to fetch as sources, for an artist too small for the fixed provider list (no
   * Wikidata/MusicBrainz entry, no streaming catalog): a press article, an "about" page, an
   * official bio. Fetched at runtime like every other source — never typed in as content.
   */
  extraSources: z.array(z.object({ url: z.string(), label: z.string().optional() })).optional().default([]),
  /** Social/profile URLs cited by a real source but not discoverable via Wikidata/MusicBrainz. */
  knownSocialLinks: z.array(z.string()).optional().default([]),
  claimsToVerify: z.array(
    z.object({
      id: z.string(),
      claim: z.string(),
      patterns: z.array(z.string()),
      /** Shown on the sites only when the claim is verified by a fetched source. */
      display: z
        .object({
          alias: z.string().optional(),
          tagline: z.object({ es: z.string(), en: z.string() }).optional(),
          stat: z
            .object({
              es: z.object({ label: z.string(), value: z.string() }),
              en: z.object({ label: z.string(), value: z.string() }),
            })
            .optional(),
        })
        .optional(),
    }),
  ),
});
export type ArtistConfig = z.infer<typeof ArtistConfigSchema>;

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

export interface FactoryPaths {
  /** Repository root (where package.json lives). Sentinels and state live here. */
  root: string;
  configDir: string;
  urlsFile: string;
  outputDir: string;
  artifactsDir: string;
  /** artifacts/acquisition/<slug>/ — raw + rendered HTML, assets, screenshots, dom-snapshot.json */
  acquisitionDir: string;
  /** artifacts/design-tokens/<slug>/ — chhapify outputs + tokens.json */
  designTokensDir: string;
  /** artifacts/feature-manifests/<slug>.json and UNION.json */
  featureManifestsDir: string;
  /** artifacts/marisela-content/ — content.json, raw provider dumps, images/ */
  contentDir: string;
  /** artifacts/validation-reports/<project>.md */
  validationReportsDir: string;
  /** artifacts/ui-specs/<project>.spec.json (json-render specs + prompts) */
  uiSpecsDir: string;
  /** artifacts/build-logs/<project>.log */
  buildLogsDir: string;
  taskGraphFile: string;
  reportFile: string;
  reportJsonFile: string;
  vendorDir: string;
  templatesDir: string;
  promptsDir: string;
  logFile: string;
  stateFile: string;
  scriptsDir: string;
}

export interface FactoryEnv {
  anthropicApiKey?: string;
  anthropicModel?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  ticketmasterApiKey?: string;
  bandsintownAppId?: string;
  faceliftAiReview?: string;
  faceliftAiCleanup?: string;
  clooneyRepoUrls?: string[];
}

export interface CliFlags {
  /** Ignore sentinels and start a fresh run. */
  fresh: boolean;
  /** Re-run from this phase number (clears sentinels >= N). */
  fromPhase: number | null;
  verbose: boolean;
  /** Disable every LLM call (deterministic mode). */
  noAi: boolean;
  /** Override config.variations. */
  variations: number | null;
  /** Override the URLs file. */
  urlsFile: string | null;
  /** Delete state, sentinels, artifacts and generated sites, then exit. */
  reset: boolean;
}

export interface FactoryContext {
  paths: FactoryPaths;
  config: FactoryConfig;
  briefs: DesignBrief[];
  featureMap: FeatureMap;
  artist: ArtistConfig;
  env: FactoryEnv;
  flags: CliFlags;
}

/** Repository root, derived from this file's location (src/utils/config.ts → ../..). */
export function repoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..");
}

export function resolvePaths(root: string, config: FactoryConfig, urlsOverride?: string | null): FactoryPaths {
  const r = (p: string) => (path.isAbsolute(p) ? p : path.join(root, p));
  const artifactsDir = r(config.paths.artifactsDir);
  return {
    root,
    configDir: path.join(root, "config"),
    urlsFile: urlsOverride ? r(urlsOverride) : r(config.paths.urlsFile),
    outputDir: r(config.paths.outputDir),
    artifactsDir,
    acquisitionDir: path.join(artifactsDir, "acquisition"),
    designTokensDir: path.join(artifactsDir, "design-tokens"),
    featureManifestsDir: path.join(artifactsDir, "feature-manifests"),
    contentDir: path.join(artifactsDir, "marisela-content"),
    validationReportsDir: path.join(artifactsDir, "validation-reports"),
    uiSpecsDir: path.join(artifactsDir, "ui-specs"),
    buildLogsDir: path.join(artifactsDir, "build-logs"),
    taskGraphFile: path.join(artifactsDir, "task-graph.json"),
    reportFile: path.join(artifactsDir, "report.md"),
    reportJsonFile: path.join(artifactsDir, "report.json"),
    vendorDir: r(config.paths.vendorDir),
    templatesDir: r(config.paths.templatesDir),
    promptsDir: r(config.paths.promptsDir),
    logFile: r(config.paths.logFile),
    stateFile: r(config.paths.stateFile),
    scriptsDir: path.join(root, "scripts"),
  };
}

function readEnv(): FactoryEnv {
  const e = process.env;
  const clean = (v: string | undefined) => {
    const t = v?.trim();
    // Treat the .env.example placeholders as unset.
    if (!t || t === "..." || t.endsWith("-...") || t === "sk-..." || t === "sk-ant-...") return undefined;
    return t;
  };
  const repos = clean(e.CLOONEY_REPO_URLS);
  return {
    anthropicApiKey: clean(e.ANTHROPIC_API_KEY) ?? clean(e.ANTHROPIC_AUTH_TOKEN),
    anthropicModel: clean(e.ANTHROPIC_MODEL),
    openaiApiKey: clean(e.OPENAI_API_KEY),
    geminiApiKey: clean(e.GEMINI_API_KEY) ?? clean(e.GOOGLE_GENERATIVE_AI_API_KEY),
    ticketmasterApiKey: clean(e.TICKETMASTER_API_KEY),
    bandsintownAppId: clean(e.BANDSINTOWN_APP_ID),
    faceliftAiReview: clean(e.FACELIFT_AI_REVIEW),
    faceliftAiCleanup: clean(e.FACELIFT_AI_CLEANUP),
    clooneyRepoUrls: repos ? repos.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
  };
}

/**
 * Load .env, every config file, and resolve paths. Throws with a clear message on invalid config.
 * `opts.requirePrompts: false` skips the prompts/*.md existence check (useful in tests).
 */
export async function loadFactoryContext(
  flags: CliFlags,
  root = repoRoot(),
  opts: { requirePrompts?: boolean } = {},
): Promise<FactoryContext> {
  dotenv.config({ path: path.join(root, ".env"), quiet: true });
  const configDir = path.join(root, "config");
  const config = await readJsonValidated(path.join(configDir, "factory.config.json"), FactoryConfigSchema);
  if (flags.variations) config.variations = flags.variations;
  const briefsFile = await readJsonValidated(path.join(configDir, "design-briefs.json"), DesignBriefsFileSchema);
  const featureMap = await readJsonValidated(path.join(configDir, "feature-map.json"), FeatureMapSchema);
  const artist = await readJsonValidated(path.join(configDir, "artist.json"), ArtistConfigSchema);
  const env = readEnv();
  if (env.anthropicModel) {
    config.tools.jsonRender.model = env.anthropicModel;
    config.tools.contentFetch.llmModel = env.anthropicModel;
  }
  if (env.clooneyRepoUrls?.length) config.tools.clooney.repoUrls = env.clooneyRepoUrls;
  const paths = resolvePaths(root, config, flags.urlsFile);
  const briefs = [...briefsFile.briefs].sort((a, b) => a.number - b.number).slice(0, config.variations);
  if (briefs.length < config.variations) {
    throw new Error(
      `config.variations is ${config.variations} but config/design-briefs.json only defines ${briefsFile.briefs.length} briefs. Add briefs or lower "variations".`,
    );
  }
  for (const brief of opts.requirePrompts === false ? [] : briefs) {
    const promptPath = path.join(root, brief.promptFile);
    if (!(await fs.pathExists(promptPath))) {
      throw new Error(`Design brief prompt not found: ${brief.promptFile} (brief ${brief.id})`);
    }
  }
  return { paths, config, briefs, featureMap, artist, env, flags };
}

/** Resolve an auto/on/off setting. `available` = the prerequisite (key, CLI…) is present. */
export function resolveAutoMode(mode: AutoModeValue, available: boolean): boolean {
  if (mode === true || mode === "on") return true;
  if (mode === false || mode === "off") return false;
  return available;
}

export const DEFAULT_FLAGS: CliFlags = {
  fresh: false,
  fromPhase: null,
  verbose: false,
  noAi: false,
  variations: null,
  urlsFile: null,
  reset: false,
};
