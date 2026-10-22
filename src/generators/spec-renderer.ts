import type { Spec } from "@json-render/core";
import type { ArtistContent } from "../schemas/content-schema.js";
import { CANONICAL_BINDINGS, CATALOG_COMPONENTS, type CatalogBundle, type CatalogComponentName } from "./component-registry.js";
import { footerCredits, getByPointer, leadFor, stripUndefined } from "./spec-builder.js";

/**
 * json-render spec → Next.js page.
 *  - normalizeSpec: makes any spec (LLM or deterministic) safe: canonical data bindings, enforced
 *    names/anchors, grounded copy (no unknown numbers), full feature coverage, Page/NavBar/Footer shape.
 *  - renderPageTsx: emits app/page.tsx (a server component) importing one component per catalog type.
 */

type Props = Record<string, unknown>;
type Element = { type: string; props: Props; children: string[] };
type FlatSpec = { root: string; elements: Record<string, Element> };

const STATE_KEY = "$state";
const isBinding = (v: unknown): v is { $state: string } => typeof v === "object" && v !== null && STATE_KEY in v && typeof (v as Record<string, unknown>)[STATE_KEY] === "string";

/**
 * json-render's catalog.prompt() documents several PropExpression kinds besides `$state` — notably
 * `{ $template: string }`, which interpolates `${/path}` (and bare `${field}`, falling back to
 * `/field`) references into a string. Models use it for real (e.g. a dynamic Footer.copyright), but
 * this factory renders a static server component with no live state/repeat context, so a surviving
 * `$template` object reaches JSX as a literal object — React then throws "Objects are not valid as a
 * React child" at build time. `$item`/`$index`/`$bindState`/`$bindItem`/`$cond`/`$computed` depend on
 * a repeat item, two-way binding or a registered function this factory never sets up, so they can
 * never resolve to anything meaningful here either.
 */
const isTemplateExpr = (v: unknown): v is { $template: string } => typeof v === "object" && v !== null && typeof (v as Record<string, unknown>).$template === "string";
const UNSUPPORTED_EXPR_KEYS = ["$item", "$index", "$bindState", "$bindItem", "$cond", "$computed"];
const isUnsupportedExpr = (v: unknown): boolean => typeof v === "object" && v !== null && UNSUPPORTED_EXPR_KEYS.some((k) => k in (v as Record<string, unknown>));

/** `${/path}` (absolute) or `${field}` (treated as `/field`, matching json-render's own no-repeat-item fallback). Null if any reference is outside `allowedStatePaths` or doesn't resolve — the caller grounds this the same as any other unverifiable copy. */
function resolveTemplate(template: string, content: ArtistContent, allowedStatePaths: string[]): string | null {
  let ok = true;
  const out = template.replace(/\$\{([^}]+)\}/g, (_match, raw: string) => {
    const pointer = raw.startsWith("/") ? raw : `/${raw}`;
    const value = allowedStatePaths.includes(pointer) ? getByPointer(content, pointer) : undefined;
    if (value === undefined || value === null) {
      ok = false;
      return "";
    }
    return String(value);
  });
  return ok ? out : null;
}

/** Resolve every `$template` (recursively — a model can nest one inside e.g. a link's label) to a
 * plain grounded string, and drop any other unsupported live expression. Returns undefined when a
 * top-level value could not be resolved at all; the caller falls back to the deterministic prop. */
function resolveExpressions(value: unknown, content: ArtistContent, allowedStatePaths: string[]): unknown {
  if (isBinding(value)) return value;
  if (isTemplateExpr(value)) return resolveTemplate(value.$template, content, allowedStatePaths) ?? undefined;
  if (isUnsupportedExpr(value)) return undefined;
  if (Array.isArray(value)) return value.map((v) => resolveExpressions(v, content, allowedStatePaths));
  if (value && typeof value === "object") {
    const out: Props = {};
    for (const [k, v] of Object.entries(value)) {
      const r = resolveExpressions(v, content, allowedStatePaths);
      if (r !== undefined) out[k] = r;
    }
    return out;
  }
  return value;
}

/** Props each component may carry (anything else from a model is dropped). */
const ALLOWED_PROPS: Record<CatalogComponentName, string[]> = {
  Page: ["title", "description", "lang"],
  NavBar: ["brand", "links", "cta", "socials"],
  Hero: ["anchorId", "variant", "title", "eyebrow", "subtitle", "tagline", "primaryCta", "secondaryCta", "image", "stats", "showScrollIndicator"],
  StatsBand: ["anchorId", "variant", "title", "eyebrow", "items", "note"],
  Biography: ["anchorId", "variant", "title", "eyebrow", "lead", "paragraphs", "facts", "image", "sourceNote", "maxParagraphs"],
  Discography: ["anchorId", "variant", "title", "eyebrow", "intro", "albums", "layout", "limit", "showTypes"],
  TopSongs: ["anchorId", "variant", "title", "eyebrow", "intro", "songs", "limit", "showStats"],
  TourDates: ["anchorId", "variant", "title", "eyebrow", "intro", "events", "tourName", "ticketsUrl", "emptyTitle", "emptyMessage", "ctaLabel"],
  VideoGallery: ["anchorId", "variant", "title", "eyebrow", "intro", "videos", "limit", "channelUrl"],
  PhotoGallery: ["anchorId", "variant", "title", "eyebrow", "images", "limit"],
  MusicPlayer: ["anchorId", "variant", "title", "eyebrow", "intro", "spotifyArtistId", "links"],
  PressQuotes: ["anchorId", "variant", "title", "eyebrow", "quotes", "limit"],
  Newsletter: ["anchorId", "variant", "title", "eyebrow", "body", "placeholder", "buttonLabel", "successMessage", "errorMessage", "privacyNote"],
  SocialLinks: ["anchorId", "variant", "title", "eyebrow", "intro", "links"],
  ContactBooking: ["anchorId", "variant", "title", "eyebrow", "body", "email", "bookingUrl", "phone", "links"],
  FeatureSection: ["anchorId", "variant", "featureType", "title", "eyebrow", "body", "items", "cta"],
  SectionDivider: ["label", "variant"],
  Footer: ["brand", "tagline", "links", "socials", "copyright", "credits", "sources"],
};

/** Required props whose absence would break the component contract. */
const REQUIRED_PROPS: Partial<Record<CatalogComponentName, string[]>> = {
  NavBar: ["brand", "links"],
  Hero: ["title"],
  StatsBand: ["items"],
  Biography: ["title", "paragraphs"],
  Discography: ["title", "albums"],
  TopSongs: ["title", "songs"],
  TourDates: ["title", "events", "emptyTitle", "emptyMessage"],
  VideoGallery: ["title", "videos"],
  PhotoGallery: ["title", "images"],
  MusicPlayer: ["title", "links"],
  PressQuotes: ["title", "quotes"],
  Newsletter: ["title", "placeholder", "buttonLabel", "successMessage", "errorMessage"],
  SocialLinks: ["title", "links"],
  ContactBooking: ["title"],
  FeatureSection: ["featureType", "title"],
  Footer: ["brand", "links", "socials", "copyright", "credits"],
};

const SECTION_COMPONENTS = CATALOG_COMPONENTS.filter((c) => !["Page", "NavBar", "Footer", "SectionDivider"].includes(c));

/** Which union feature type an element covers. */
function featureTypeOf(el: Element, bundle: CatalogBundle): string | null {
  if (el.type === "FeatureSection") return typeof el.props.featureType === "string" ? el.props.featureType : null;
  if (el.type === "NavBar") return "navigation";
  if (el.type === "Footer") return "footer";
  return Object.entries(bundle.componentByFeature).find(([, comp]) => comp === el.type)?.[0] ?? null;
}

export function checkSpecCoverage(spec: Spec, bundle: CatalogBundle): { missing: string[]; present: string[] } {
  const s = spec as unknown as FlatSpec;
  const page = s.elements?.[s.root];
  const present = new Set<string>();
  for (const key of page?.children ?? []) {
    const el = s.elements[key];
    if (!el) continue;
    const t = featureTypeOf(el, bundle);
    if (t) present.add(t);
  }
  const missing = bundle.requiredFeatureTypes.filter((t) => !present.has(t));
  return { missing, present: [...present] };
}

/** Numbers that appear in literal copy must exist somewhere in the content (no invented figures). */
function hasUngroundedNumber(text: string, corpus: string): boolean {
  return (text.match(/\d[\d.,]*/g) ?? []).some((n) => !corpus.includes(n.replace(/[.,]$/, "")));
}

function cleanLiteral(value: unknown, corpus: string): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map((v) => cleanLiteral(v, corpus));
  if (value && typeof value === "object" && !isBinding(value)) {
    const out: Props = {};
    for (const [k, v] of Object.entries(value)) if (v !== null && v !== undefined) out[k] = cleanLiteral(v, corpus);
    return out;
  }
  return value;
}

function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out));
  else if (value && typeof value === "object" && !isBinding(value)) Object.values(value).forEach((v) => collectStrings(v, out));
  return out;
}

/**
 * Make a spec safe and complete. `fallback` is the deterministic spec for the same brief; it supplies
 * missing sections and replaces any prop that fails validation.
 */
export function normalizeSpec(spec: Spec, bundle: CatalogBundle, content: ArtistContent, fallback: Spec): { spec: Spec; fixes: string[] } {
  const fixes: string[] = [];
  const src = spec as unknown as FlatSpec;
  const fb = fallback as unknown as FlatSpec;
  const corpus = JSON.stringify(content);
  const out: FlatSpec = { root: "page", elements: {} };
  const fbByType = new Map<string, Element>();
  for (const key of fb.elements[fb.root].children) {
    const el = fb.elements[key];
    const t = featureTypeOf(el, bundle);
    if (t) fbByType.set(t, el);
  }

  // 1. Walk the source page children in order, keeping valid elements.
  const rootEl = src?.elements?.[src?.root];
  const order: string[] = [];
  const seenTypes = new Set<string>();
  let navKey: string | null = null;
  let footerKey: string | null = null;
  let dividers = 0;
  for (const key of rootEl?.children ?? []) {
    const el = src.elements[key];
    if (!el || !(CATALOG_COMPONENTS as readonly string[]).includes(el.type) || el.type === "Page") {
      if (el) fixes.push(`dropped unknown component "${el.type}"`);
      continue;
    }
    const type = el.type as CatalogComponentName;
    const ft = featureTypeOf(el, bundle);
    if (type === "SectionDivider") {
      if (dividers >= 6) continue;
      dividers++;
    } else if (ft) {
      if (!bundle.requiredFeatureTypes.includes(ft) && type === "FeatureSection") {
        fixes.push(`dropped FeatureSection for non-union type "${ft}"`);
        continue;
      }
      if (seenTypes.has(ft)) {
        fixes.push(`dropped duplicate ${type} (${ft})`);
        continue;
      }
      seenTypes.add(ft);
    } else if (!SECTION_COMPONENTS.includes(type) || !Object.values(bundle.componentByFeature).includes(type)) {
      fixes.push(`dropped ${type}: not part of this page's feature union`);
      continue;
    }
    const newKey = type === "NavBar" ? "nav" : type === "Footer" ? "footer" : ft && type !== "SectionDivider" ? ft : `divider-${dividers}`;
    out.elements[newKey] = { type, props: { ...(el.props ?? {}) }, children: [] };
    if (type === "NavBar") navKey = newKey;
    else if (type === "Footer") footerKey = newKey;
    else order.push(newKey);
  }

  // 2. Insert missing coverage from the fallback, at the fallback's relative position.
  const fbOrder = fb.elements[fb.root].children.map((k) => featureTypeOf(fb.elements[k], bundle)).filter((t): t is string => Boolean(t) && t !== "navigation" && t !== "footer");
  for (const type of bundle.requiredFeatureTypes) {
    if (type === "navigation" || type === "footer" || seenTypes.has(type)) continue;
    const el = fbByType.get(type);
    if (!el) continue;
    out.elements[type] = structuredClone(el);
    const idx = fbOrder.indexOf(type);
    const after = fbOrder.slice(0, idx).reverse().find((t) => order.includes(t));
    const pos = after ? order.indexOf(after) + 1 : 0;
    order.splice(pos, 0, type);
    seenTypes.add(type);
    fixes.push(`inserted missing section "${type}" from the deterministic plan`);
  }
  if (!navKey) {
    out.elements.nav = structuredClone(fb.elements.nav);
    navKey = "nav";
    fixes.push("inserted missing NavBar");
  }
  if (!footerKey) {
    out.elements.footer = structuredClone(fb.elements.footer);
    footerKey = "footer";
    fixes.push("inserted missing Footer");
  }
  // Hero first among sections.
  const heroIdx = order.indexOf("hero");
  if (heroIdx > 0) {
    order.splice(heroIdx, 1);
    order.unshift("hero");
    fixes.push("moved Hero to the top");
  }
  // No divider first/last/adjacent.
  for (let i = order.length - 1; i >= 0; i--) {
    const isDiv = out.elements[order[i]].type === "SectionDivider";
    const prevDiv = i > 0 && out.elements[order[i - 1]].type === "SectionDivider";
    if (isDiv && (i === 0 || i === order.length - 1 || prevDiv)) {
      delete out.elements[order[i]];
      order.splice(i, 1);
    }
  }

  // 3. Per-element prop normalization.
  const anchorsPresent = new Set<string>();
  for (const key of [navKey, ...order, footerKey]) {
    const el = out.elements[key];
    const type = el.type as CatalogComponentName;
    const ft = featureTypeOf(el, bundle);
    const fbEl = ft ? (fbByType.get(ft) ?? (type === "NavBar" ? fb.elements.nav : type === "Footer" ? fb.elements.footer : undefined)) : undefined;
    const allowed = new Set(ALLOWED_PROPS[type]);
    const props: Props = {};
    for (const [k, v] of Object.entries(el.props)) {
      if (!allowed.has(k) || v === null || v === undefined) continue;
      const resolved = resolveExpressions(v, content, bundle.allowedStatePaths);
      if (resolved === undefined) {
        if (fbEl && fbEl.props[k] !== undefined) {
          props[k] = structuredClone(fbEl.props[k]);
          fixes.push(`${type}.${k}: replaced an unsupported or ungrounded expression (e.g. $template) with the fallback copy`);
        }
        continue;
      }
      if (isBinding(resolved)) {
        if (getByPointer(content, resolved.$state) !== undefined && bundle.allowedStatePaths.includes(resolved.$state)) props[k] = resolved;
        continue;
      }
      props[k] = cleanLiteral(resolved, corpus);
    }
    // Canonical data bindings always win over model-provided values.
    for (const [prop, path] of Object.entries(CANONICAL_BINDINGS[type] ?? {})) {
      if (getByPointer(content, path) !== undefined) props[prop] = { $state: path };
      else delete props[prop];
    }
    // Grounding: literal copy with numbers not present in the content reverts to the fallback copy.
    for (const [k, v] of Object.entries(props)) {
      if (isBinding(v) || typeof v === "number" || typeof v === "boolean") continue;
      const strings = collectStrings(v);
      if (strings.some((s) => hasUngroundedNumber(s, corpus) && !/^#/.test(s) && !/^https?:/.test(s))) {
        if (fbEl && fbEl.props[k] !== undefined) props[k] = structuredClone(fbEl.props[k]);
        else delete props[k];
        fixes.push(`${type}.${k}: replaced copy containing unverified numbers`);
      }
    }
    // Variants must exist in the brief manifest.
    const variants = bundle.variants[type];
    if (type === "Discography") {
      if (typeof props.layout !== "string" || !(variants ?? ["grid", "list"]).includes(props.layout)) props.layout = (variants ?? ["grid"])[0];
      delete props.variant;
    } else if (props.variant !== undefined && (!variants || !variants.includes(String(props.variant)))) {
      if (variants?.length) props.variant = variants[0];
      else delete props.variant;
    }
    // Identity props are never left to the model.
    if (type === "Hero") props.title = content.name;
    if (type === "NavBar" || type === "Footer") props.brand = content.name;
    if (type === "Footer") props.credits = footerCredits(content);
    // The hero already shows /shortBio; a biography lead repeating it reads as duplicated copy.
    if (type === "Biography" && props.lead !== undefined) {
      const lead = isBinding(props.lead) ? getByPointer(content, props.lead.$state) : props.lead;
      if (typeof lead !== "string" || lead.trim() === content.shortBio.trim() || leadFor({ ...content, biography: { ...content.biography, summary: lead } }) === undefined) {
        delete props.lead;
        fixes.push("Biography.lead: removed (repeats the hero subtitle or the first paragraph)");
      }
    }
    // Anchors.
    if (ft && bundle.anchors[ft] && type !== "NavBar" && type !== "Footer") {
      props.anchorId = bundle.anchors[ft];
      anchorsPresent.add(bundle.anchors[ft]);
    }
    if (type === "FeatureSection" && ft) props.featureType = ft;
    // Required props: borrow from the fallback when missing.
    for (const req of REQUIRED_PROPS[type] ?? []) {
      if (props[req] === undefined && fbEl?.props[req] !== undefined) {
        props[req] = structuredClone(fbEl.props[req]);
        fixes.push(`${type}.${req}: filled from the deterministic plan`);
      }
    }
    out.elements[key] = { type, props: stripUndefined(props), children: [] };
  }

  // 4. Links must point at existing anchors (or be absolute URLs).
  const fixLinks = (list: unknown, fallbackList: unknown): unknown => {
    if (!Array.isArray(list)) return fallbackList;
    const valid = list.filter((l): l is { label: string; href: string } => {
      if (!l || typeof l !== "object") return false;
      const href = String((l as { href?: unknown }).href ?? "");
      const label = String((l as { label?: unknown }).label ?? "").trim();
      if (!label) return false;
      if (href.startsWith("#")) return anchorsPresent.has(href.slice(1));
      return /^(https?:|mailto:|tel:)/.test(href);
    });
    return valid.length >= Math.min(3, Array.isArray(fallbackList) ? fallbackList.length : 3) ? valid : fallbackList;
  };
  const nav = out.elements[navKey];
  nav.props.links = fixLinks(nav.props.links, fb.elements.nav.props.links);
  const foot = out.elements[footerKey];
  foot.props.links = fixLinks(foot.props.links, fb.elements.footer.props.links);
  for (const key of order) {
    const el = out.elements[key];
    for (const ctaProp of ["primaryCta", "secondaryCta", "cta"]) {
      const cta = el.props[ctaProp] as { href?: string } | undefined;
      if (cta?.href?.startsWith("#") && !anchorsPresent.has(cta.href.slice(1))) {
        delete el.props[ctaProp];
        fixes.push(`${el.type}.${ctaProp}: removed link to a missing anchor`);
      }
    }
  }
  const navCta = nav.props.cta as { href?: string } | undefined;
  if (navCta?.href?.startsWith("#") && !anchorsPresent.has(navCta.href.slice(1))) delete nav.props.cta;

  const pageProps = (src?.elements?.[src?.root]?.props ?? {}) as Props;
  out.elements.page = {
    type: "Page",
    props: {
      title: typeof pageProps.title === "string" && !hasUngroundedNumber(pageProps.title, corpus) ? pageProps.title : fb.elements.page.props.title,
      description: typeof pageProps.description === "string" && !hasUngroundedNumber(pageProps.description, corpus) ? pageProps.description : fb.elements.page.props.description,
      lang: content.lang,
    },
    children: [navKey, ...order, footerKey],
  };
  return { spec: out as unknown as Spec, fixes };
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** `/biography/paragraphs` → `artistContent.biography.paragraphs` */
export function pointerToExpression(pointer: string): string {
  return pointer
    .split("/")
    .filter(Boolean)
    .reduce((expr, seg) => (IDENT.test(seg) ? `${expr}.${seg}` : `${expr}[${JSON.stringify(seg)}]`), "artistContent");
}

function renderProps(props: Props, indent: string): string {
  const entries = Object.entries(props).filter(([, v]) => v !== undefined && v !== null);
  if (!entries.length) return "";
  const parts = entries.map(([k, v]) => {
    if (isBinding(v)) return `${k}={${pointerToExpression(v.$state)}}`;
    if (typeof v === "string") return `${k}={${JSON.stringify(v)}}`;
    if (typeof v === "boolean") return v ? k : `${k}={false}`;
    return `${k}={${JSON.stringify(v)}}`;
  });
  return `\n${parts.map((p) => `${indent}  ${p}`).join("\n")}\n${indent}`;
}

function renderElement(el: Element, indent: string): string {
  return `${indent}<${el.type}${renderProps(el.props, indent)}/>`;
}

/** Render app/page.tsx from a normalized spec. */
export function renderPageTsx(spec: Spec, _opts: { content: ArtistContent }): string {
  const s = spec as unknown as FlatSpec;
  const page = s.elements[s.root];
  const keys = page.children;
  const els = keys.map((k) => s.elements[k]).filter(Boolean);
  const nav = els.filter((e) => e.type === "NavBar");
  const footer = els.filter((e) => e.type === "Footer");
  const sections = els.filter((e) => e.type !== "NavBar" && e.type !== "Footer");
  const components = [...new Set(els.map((e) => e.type))].sort();
  const usesContent = JSON.stringify(els).includes(`"${STATE_KEY}"`);
  const lines: string[] = [];
  lines.push("// Generated by artist-site-factory from the json-render spec in lib/ui-spec.json.");
  if (usesContent) lines.push('import { artistContent } from "@/lib/content";');
  for (const c of components) lines.push(`import ${c} from "@/components/${c}";`);
  lines.push("");
  lines.push("export default function Home() {");
  lines.push("  return (");
  lines.push("    <>");
  for (const e of nav) lines.push(renderElement(e, "      "));
  lines.push('      <main id="contenido">');
  for (const e of sections) lines.push(renderElement(e, "        "));
  lines.push("      </main>");
  for (const e of footer) lines.push(renderElement(e, "      "));
  lines.push("    </>");
  lines.push("  );");
  lines.push("}");
  return `${lines.join("\n")}\n`;
}
