import { z } from "zod";

/**
 * Feature inventory of one inspirational website, and the union across all of them.
 *
 * Per-URL manifests: `artifacts/feature-manifests/<slug>.json` (FeatureManifest).
 * Union: `artifacts/feature-manifests/UNION.json` (UnionManifest).
 * Feature `type` values are the keys of `config/feature-map.json` → featureTypes.
 */

export const FeatureLayoutSchema = z.enum([
  "full-width",
  "contained",
  "split",
  "grid",
  "list",
  "carousel",
  "overlay",
  "sticky",
  "inline",
  "unknown",
]);
export type FeatureLayout = z.infer<typeof FeatureLayoutSchema>;

export const FeatureDetectorSchema = z.enum(["clooney", "heuristic", "baseline", "required"]);
export type FeatureDetector = z.infer<typeof FeatureDetectorSchema>;

export const FeatureSchema = z.object({
  /** Stable kebab-case id, e.g. "hero-section". */
  id: z.string(),
  /** Feature type key from config/feature-map.json, e.g. "hero", "tour-dates". */
  type: z.string(),
  name: z.string(),
  description: z.string(),
  layout: FeatureLayoutSchema,
  /** UI building blocks observed, e.g. ["heading", "subheading", "button", "background-image"]. */
  components: z.array(z.string()),
  /** Interactions observed, e.g. ["scroll-indicator", "cta-click"]. */
  interactions: z.array(z.string()),
  source: z.object({
    url: z.string().nullable(),
    detector: FeatureDetectorSchema,
    confidence: z.number().min(0).max(1),
  }),
  /** Short human-readable evidence strings (selectors, text snippets, Clooney component names). */
  evidence: z.array(z.string()),
});
export type Feature = z.infer<typeof FeatureSchema>;

export const AnalyzerRunSchema = z.object({
  name: z.string(),
  status: z.enum(["ok", "skipped", "failed"]),
  durationMs: z.number(),
  detail: z.string().optional(),
});
export type AnalyzerRun = z.infer<typeof AnalyzerRunSchema>;

export const FeatureManifestSchema = z.object({
  schemaVersion: z.literal(1),
  url: z.string(),
  slug: z.string(),
  generatedAt: z.string(),
  analyzers: z.array(AnalyzerRunSchema),
  /** True when no analyzer produced features and the baseline set was used. */
  usedBaseline: z.boolean(),
  features: z.array(FeatureSchema),
});
export type FeatureManifest = z.infer<typeof FeatureManifestSchema>;

export const UnionFeatureSchema = FeatureSchema.extend({
  /** URLs where this feature type was observed (empty for required/baseline-only features). */
  sources: z.array(z.string()),
  /** Every layout observed for this type across sites. */
  layouts: z.array(FeatureLayoutSchema),
  /** Feature ids merged into this superset feature. */
  mergedFrom: z.array(z.string()),
});
export type UnionFeature = z.infer<typeof UnionFeatureSchema>;

export const UnionManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string(),
  sourceUrls: z.array(z.string()),
  /** Ordered list of unique feature types in the union. */
  featureTypes: z.array(z.string()),
  features: z.array(UnionFeatureSchema),
});
export type UnionManifest = z.infer<typeof UnionManifestSchema>;
