import { z } from "zod";

/**
 * Normalized design tokens extracted from one inspirational website.
 *
 * Produced by `src/agents/design-extractor.ts` from chhapify's outputs
 * (`<slug>-design-tokens.json` W3C tokens + `<slug>-shadcn-theme.css`), or from
 * `config/default-design-tokens.json` when extraction fails.
 * Stored at `artifacts/design-tokens/<slug>/tokens.json`.
 */

export const HexColorSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "expected a 6-digit hex color like #1a2b3c");

export const DesignTokensSchema = z.object({
  schemaVersion: z.literal(1),
  /** URL slug (see `slugifyUrl`) or "default". */
  slug: z.string(),
  /** Inspirational URL the tokens came from; null for the default token set. */
  sourceUrl: z.string().nullable(),
  extractor: z.enum(["chhapify", "default"]),
  extractedAt: z.string(),
  colors: z.object({
    primary: HexColorSchema.nullable(),
    secondary: HexColorSchema.nullable(),
    accent: HexColorSchema.nullable(),
    backgrounds: z.array(HexColorSchema),
    text: z.array(HexColorSchema),
    neutrals: z.array(HexColorSchema),
    /** Every distinct color found, most significant first (max 24). */
    palette: z.array(HexColorSchema),
  }),
  typography: z.object({
    headingFamily: z.string().nullable(),
    bodyFamily: z.string().nullable(),
    families: z.array(z.string()),
    /** Font-size scale in px, ascending. */
    scalePx: z.array(z.number()),
  }),
  spacing: z.object({
    basePx: z.number().nullable(),
    scalePx: z.array(z.number()),
  }),
  radiiPx: z.array(z.number()),
  shadows: z.array(z.string()),
  breakpointsPx: z.array(z.number()),
  /** CSS custom properties parsed from chhapify's shadcn theme (name without leading `--` → raw value). */
  shadcn: z.record(z.string(), z.string()),
  /** chhapify output kind → path relative to the repo root (markdown, tokens, tailwind, cssVars, shadcn, theme, preview, figma). */
  files: z.record(z.string(), z.string()),
  /** chhapify design score, when available. */
  score: z
    .object({ overall: z.number(), grade: z.string() })
    .nullable(),
  warnings: z.array(z.string()),
});

export type DesignTokens = z.infer<typeof DesignTokensSchema>;
