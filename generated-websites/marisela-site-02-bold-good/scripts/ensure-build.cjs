// Runs before \`npm start\` (prestart). \`next start\` serves the last production build, so rebuild when
// there is none (fresh checkout, or \`next dev\` replaced it) or when any source file changed since.
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SOURCES = ["app", "components", "lib", "public", "styles", "package.json", "next.config.js", "tailwind.config.ts", "postcss.config.js", "tsconfig.json"];

function newestMtime(target) {
  if (!fs.existsSync(target)) return 0;
  const stat = fs.statSync(target);
  if (!stat.isDirectory()) return stat.mtimeMs;
  return Math.max(0, ...fs.readdirSync(target).map((name) => newestMtime(path.join(target, name))));
}

const buildId = path.join(".next", "BUILD_ID");
const builtAt = fs.existsSync(buildId) ? fs.statSync(buildId).mtimeMs : 0;
const changedAt = Math.max(...SOURCES.map(newestMtime));

if (!builtAt || changedAt > builtAt) {
  console.log(builtAt ? "Source files changed since the last build — rebuilding…" : "No production build yet — building…");
  execSync("next build", { stdio: "inherit" });
}
