import path from "node:path";
import type { Spec } from "@json-render/core";
import fs from "fs-extra";
import type { ArtistContent, ContentDocument } from "../schemas/content-schema.js";
import type { DesignTokens } from "../schemas/design-tokens.js";
import type { DesignBrief, FactoryContext, FontSpec } from "../utils/config.js";
import { writeJson } from "../utils/file-utils.js";
import type { Logger } from "../utils/logger.js";
import { isHex } from "./color.js";
import { injectContent } from "./content-injector.js";
import { faviconSvg } from "./placeholder-art.js";
import { renderGlobalsCss, renderTailwindConfig, renderThemeModule, type Theme } from "./theme-generator.js";

/**
 * Writes a complete, runnable Next.js 15 project (App Router, TypeScript, Tailwind CSS v4 via
 * tailwind.config.ts, shadcn/ui copy-in primitives, Framer Motion, lucide-react) for one brief.
 * Re-scaffolding replaces generated files but never deletes node_modules/ or .next/.
 */

export interface ScaffoldOptions {
  ctx: FactoryContext;
  brief: DesignBrief;
  theme: Theme;
  tokens: DesignTokens;
  doc: ContentDocument;
  spec: Spec;
  pageTsx: string;
  projectDir: string;
  logger: Logger;
}

export function renderPackageJson(projectName: string, ctx: FactoryContext): string {
  return `${JSON.stringify(
    {
      name: projectName,
      version: "1.0.0",
      private: true,
      type: "module",
      scripts: { dev: "next dev", build: "next build", start: "next start" },
      dependencies: ctx.config.generation.dependencies,
      devDependencies: ctx.config.generation.devDependencies,
      engines: { node: ">=20" },
    },
    null,
    2,
  )}\n`;
}

export function renderNextConfig(): string {
  return `import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This project lives inside the artist-site-factory repository; pin the workspace root to this folder.
  outputFileTracingRoot: projectRoot,
  eslint: { ignoreDuringBuilds: true },
  images: { formats: ["image/avif", "image/webp"] },
  poweredByHeader: false,
  reactStrictMode: true,
};

export default nextConfig;
`;
}

const POSTCSS = `export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
`;

const TSCONFIG = {
  compilerOptions: {
    target: "ES2017",
    lib: ["dom", "dom.iterable", "esnext"],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: "esnext",
    moduleResolution: "bundler",
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: "preserve",
    incremental: true,
    plugins: [{ name: "next" }],
    paths: { "@/*": ["./*"] },
  },
  include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  exclude: ["node_modules"],
};

const NEXT_ENV = `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`;

const GITIGNORE = `node_modules/
.next/
out/
*.log
.env*
!.env.example
next-env.d.ts.bak
`;

function fontDecl(role: string, spec: FontSpec): string {
  return `const ${role}Font = ${spec.importName}({
  subsets: ["latin", "latin-ext"],
  weight: ${JSON.stringify(spec.weights)},
  style: ${JSON.stringify(spec.styles)},
  variable: "--font-${role}",
  display: "swap",
});`;
}

export function renderLayoutTsx(brief: DesignBrief, theme: Theme): string {
  const fonts: Array<[string, FontSpec]> = [["display", brief.fonts.display], ["body", brief.fonts.body]];
  if (brief.fonts.mono) fonts.push(["mono", brief.fonts.mono]);
  const imports = [...new Set(fonts.map(([, f]) => f.importName))].join(", ");
  const classNames = fonts.map(([role]) => `\${${role}Font.variable}`).join(" ");
  const themeColor = isHex(theme.palette.background) ? theme.palette.background : undefined;
  return `import type { Metadata, Viewport } from "next";
import { ${imports} } from "next/font/google";
import { artistContent } from "@/lib/content";
import { t } from "@/lib/i18n";
import "./globals.css";

${fonts.map(([role, f]) => fontDecl(role, f)).join("\n\n")}

const hero = artistContent.images.hero;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: \`\${artistContent.name} — \${artistContent.tagline}\`,
  description: artistContent.shortBio,
  openGraph: {
    title: artistContent.name,
    description: artistContent.shortBio,
    locale: artistContent.locale.replace("-", "_"),
    type: "website",
    images: hero && !hero.placeholder ? [{ url: hero.src, width: hero.width, height: hero.height, alt: hero.alt }] : [],
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {${themeColor ? `\n  themeColor: "${themeColor}",` : ""}
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={artistContent.lang} className={\`${classNames}\`}>
      <body className="min-h-dvh antialiased">
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:bg-background focus:px-4 focus:py-2 focus:text-foreground focus:outline focus:outline-2 focus:outline-ring"
        >
          {t("skipToContent")}
        </a>
        {children}
      </body>
    </html>
  );
}
`;
}

const NOT_FOUND = `import Link from "next/link";
import { artistContent } from "@/lib/content";

export default function NotFound() {
  const es = artistContent.lang === "es";
  return (
    <main id="contenido" className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-mono text-sm uppercase tracking-[0.3em] text-muted-foreground">404</p>
      <h1 className="font-display text-4xl md:text-6xl">{es ? "Página no encontrada" : "Page not found"}</h1>
      <Link href="/" className="underline underline-offset-4 hover:text-primary">
        {es ? "Volver al inicio" : "Back to home"}
      </Link>
    </main>
  );
}
`;

function siteReadme(opts: { projectName: string; brief: DesignBrief; theme: Theme; content: ArtistContent; tokens: DesignTokens }): string {
  const { projectName, brief, theme, content, tokens } = opts;
  return `# ${content.name} — ${brief.name}

A Next.js 15 website for **${content.name}** in the **${brief.name}** style (${brief.keyCharacteristics}),
generated by *artist-site-factory*.

## Run it

\`\`\`bash
npm run dev          # http://localhost:3000
npm run build && npm start   # production
\`\`\`

\`node_modules/\` is already installed. See \`RUN.md\` for details.

## How it is built

- **Page composition:** \`app/page.tsx\` was rendered from the json-render spec in \`lib/ui-spec.json\`.
- **Content:** \`lib/content.ts\` — fetched from public sources; edit it to change any text, link or image.
- **Theme:** \`app/globals.css\` (CSS variables) + \`tailwind.config.ts\`. Palette strategy "${theme.strategy}",
  derived from the design tokens of ${tokens.sourceUrl ?? "the default token set"} (chhapify).
  Fonts: ${brief.fonts.display.family} / ${brief.fonts.body.family}${brief.fonts.mono ? ` / ${brief.fonts.mono.family}` : ""}.
- **Components:** \`components/\` (this style's components + shared shadcn/ui primitives in \`components/ui\`).

## Content sources & licenses

${content.credits.sources.map((s) => `- [${s.label}](${s.href})`).join("\n")}

${content.biography.sourceNote ?? ""}
Image credits: \`public/images/CREDITS.md\`. Review all content before publishing this site publicly.

## Notes

- The newsletter form is a front-end mock (no data is sent). Connect it to your email provider in \`components/Newsletter.tsx\`.
- Tour dates are shown only when real upcoming dates were found; otherwise a "coming soon" message is displayed.
- Project id: \`${projectName}\`.
`;
}

export async function scaffoldProject(opts: ScaffoldOptions): Promise<{ files: string[]; content: ArtistContent }> {
  const { ctx, brief, theme, tokens, doc, spec, pageTsx, projectDir, logger } = opts;
  const files: string[] = [];
  const write = async (rel: string, content: string) => {
    await fs.outputFile(path.join(projectDir, rel), content, "utf8");
    files.push(rel);
  };

  await fs.ensureDir(projectDir);
  // Replace generated content, keep installed dependencies and build caches.
  for (const dir of ["app", "components", "lib", "public", "styles"]) await fs.remove(path.join(projectDir, dir));

  // Templates: shared first, then the brief's own components (brief wins on name clash).
  const templates = ctx.paths.templatesDir;
  const briefDir = path.join(ctx.paths.root, brief.templateDir);
  await fs.copy(path.join(templates, "shared", "components"), path.join(projectDir, "components"));
  if (await fs.pathExists(path.join(briefDir, "components"))) {
    await fs.copy(path.join(briefDir, "components"), path.join(projectDir, "components"), { overwrite: true });
  } else {
    logger.warn(`Brief ${brief.id} has no components directory (${brief.templateDir}/components)`);
  }
  await fs.copy(path.join(templates, "shared", "lib"), path.join(projectDir, "lib"));

  // Every component imported by the page must exist.
  const imported = [...pageTsx.matchAll(/from "@\/components\/([\w/]+)"/g)].map((m) => m[1]);
  const missing = [];
  for (const name of imported) {
    if (!(await fs.pathExists(path.join(projectDir, "components", `${name}.tsx`)))) missing.push(name);
  }
  if (missing.length) throw new Error(`Brief ${brief.id} is missing components required by the page: ${missing.join(", ")}`);

  // Content + images.
  const { content } = await injectContent({ ctx, doc, projectDir, theme, brief });
  files.push("lib/content.ts");

  const briefCssFile = path.join(briefDir, "styles.css");
  const skinBaseFile = path.join(templates, "shared", "styles", "skin-base.css");
  const skinBase = (await fs.pathExists(skinBaseFile)) ? await fs.readFile(skinBaseFile, "utf8") : "";
  const briefCss = `${skinBase}\n${(await fs.pathExists(briefCssFile)) ? await fs.readFile(briefCssFile, "utf8") : ""}`;
  await write("package.json", renderPackageJson(brief.projectName, ctx));
  await write("next.config.js", renderNextConfig());
  await write("postcss.config.js", POSTCSS);
  await write("tsconfig.json", `${JSON.stringify(TSCONFIG, null, 2)}\n`);
  await write("next-env.d.ts", NEXT_ENV);
  await write(".gitignore", GITIGNORE);
  await write("tailwind.config.ts", renderTailwindConfig(theme));
  await write("app/globals.css", renderGlobalsCss(theme, briefCss));
  await write("app/layout.tsx", renderLayoutTsx(brief, theme));
  await write("app/page.tsx", pageTsx);
  await write("app/not-found.tsx", NOT_FOUND);
  await write("app/icon.svg", faviconSvg(content.name, theme));
  await write("lib/theme.ts", renderThemeModule(theme));
  await writeJson(path.join(projectDir, "lib", "ui-spec.json"), spec);
  files.push("lib/ui-spec.json");
  if (tokens.files.shadcn && (await fs.pathExists(path.join(ctx.paths.root, tokens.files.shadcn)))) {
    const original = await fs.readFile(path.join(ctx.paths.root, tokens.files.shadcn), "utf8");
    await write(
      "styles/inspiration-shadcn-theme.css",
      `/*\n * Original shadcn/ui theme extracted by chhapify from ${tokens.sourceUrl}.\n * Reference only (not imported): app/globals.css contains the brief-transformed version of these variables.\n */\n${original}`,
    );
  }
  await write("README.md", siteReadme({ projectName: brief.projectName, brief, theme, content, tokens }));
  logger.debug(`[scaffold] ${brief.projectName}: ${files.length} files written`);
  return { files, content };
}
