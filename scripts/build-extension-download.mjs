// Build the downloadable C.A.R.E extension package served from the website.
//
// Produces public/care-extension.zip from the PROD extension package (extension/store/dist/ — localhost stripped,
// dev/dead files dropped). The /extension/download page links to /care-extension.zip; users unzip it and load it
// unpacked (until the Chrome Web Store listing is live, at which point the page can link there instead).
//
// Deterministic: a fixed entry date + sorted entries so a rebuild is byte-identical (no git churn, and the
// prebuild hook can regenerate it on every deploy without producing spurious diffs). Uses jszip (already a
// transitive dependency) so there is no new package and it runs the same on Windows (local) and Linux (Vercel).

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Runs build-store-package.mjs top-level code → refreshes extension/store/dist/ (validates + strips localhost).
await import("../extension/store/build-store-package.mjs");

const { default: JSZip } = await import("jszip");

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const dist = join(repo, "extension", "store", "dist");
const outDir = join(repo, "public");
const out = join(outDir, "care-extension.zip");

// Fixed epoch so the archive bytes are stable across rebuilds (git-churn-free, reproducible).
const FIXED_DATE = new Date("2020-01-01T00:00:00Z");

const zip = new JSZip();
function addDir(absDir, folder) {
  for (const name of readdirSync(absDir).sort()) {
    const abs = join(absDir, name);
    if (statSync(abs).isDirectory()) addDir(abs, folder.folder(name));
    else folder.file(name, readFileSync(abs), { date: FIXED_DATE });
  }
}
addDir(dist, zip);

const buf = await zip.generateAsync({
  type: "nodebuffer",
  platform: "UNIX",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});

mkdirSync(outDir, { recursive: true });
writeFileSync(out, buf);
console.log(`\n✅ wrote ${relative(repo, out)} (${buf.length} bytes) — served at /care-extension.zip`);
