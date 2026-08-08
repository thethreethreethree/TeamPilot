// Build the downloadable Sales Coach extension package served from the website.
//
// Produces public/sales-coach-extension.zip from extension-sales/, PROD-hardened: localhost stripped from the
// manifest (an unused permission is Chrome-Web-Store rejection reason #1), only the files a published package
// needs included. The /extension/download-sales page links to /sales-coach-extension.zip; users unzip + load
// unpacked (until a CWS listing is live). Mirrors scripts/build-extension-download.mjs (the C.A.R.E one), but
// zips directly from source (the sales package has no separate store/dist tooling step).
//
// Stable-as-possible: a fixed entry date + sorted entries pin the ordering + timestamps. NOTE: this does NOT
// make a rebuild byte-identical — jszip's DEFLATE layer is not byte-reproducible, so the committed zip's HASH
// drifts on every rebuild (the SOURCES are byte-stable; only the compressed bytes vary). This is cosmetic: the
// zip's CONTENT is always correct. So (a) verify this artifact by extracting + diffing its files, never by its
// hash; (b) don't churn-commit it chasing a stable hash; (c) the prebuild hook regenerates it every deploy, so
// the DEPLOYED zip is always freshly built from current source regardless of the committed bytes. Uses jszip
// (already a transitive dep). See memory: reference_jszip_build_not_byte_deterministic_verify_content.

import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const extDir = join(repo, "extension-sales");
const outDir = join(repo, "public");
const out = join(outDir, "sales-coach-extension.zip");

// Files the published package needs. NO permission.* (the sales extension dropped the image-permission flow).
const INCLUDE = ["manifest.json", "background.js", "content.js", "config.js", "adapters.js", "icons"];
const STRIP_HOST = /localhost/;

function stripLocalhost(manifest) {
  const m = structuredClone(manifest);
  m.host_permissions = (m.host_permissions || []).filter((h) => !STRIP_HOST.test(h));
  if (m.externally_connectable?.matches) {
    m.externally_connectable.matches = m.externally_connectable.matches.filter((h) => !STRIP_HOST.test(h));
  }
  return m;
}

const manifest = JSON.parse(readFileSync(join(extDir, "manifest.json"), "utf8"));
const prod = stripLocalhost(manifest);

// Validate the produced manifest (same checks as the C.A.R.E store build).
const errs = [];
const hp = JSON.stringify(prod.host_permissions || []);
const ec = JSON.stringify(prod.externally_connectable || {});
if (STRIP_HOST.test(hp)) errs.push("host_permissions still contains localhost");
if (STRIP_HOST.test(ec)) errs.push("externally_connectable still contains localhost");
if (prod.manifest_version !== 3) errs.push("manifest_version must be 3");
if (!prod.icons?.["128"]) errs.push("128px icon missing");
if ((prod.description || "").length >= 132) errs.push(`description >= 132 chars (${(prod.description || "").length})`);
for (const f of INCLUDE) {
  if (!existsSync(join(extDir, f))) errs.push(`missing required file: ${f}`);
}
if (errs.length) {
  console.error("\nVALIDATION FAILED:\n - " + errs.join("\n - "));
  process.exit(1);
}

const { default: JSZip } = await import("jszip");
const FIXED_DATE = new Date("2020-01-01T00:00:00Z"); // stable archive bytes across rebuilds
const zip = new JSZip();

function addDir(absDir, folder) {
  for (const name of readdirSync(absDir).sort()) {
    const abs = join(absDir, name);
    if (statSync(abs).isDirectory()) addDir(abs, folder.folder(name));
    else folder.file(name, readFileSync(abs), { date: FIXED_DATE });
  }
}

// Add the included files; the manifest is written from the STRIPPED version (not copied from source).
zip.file("manifest.json", JSON.stringify(prod, null, 2) + "\n", { date: FIXED_DATE });
for (const f of INCLUDE) {
  if (f === "manifest.json") continue;
  const abs = join(extDir, f);
  if (statSync(abs).isDirectory()) addDir(abs, zip.folder(f));
  else zip.file(f, readFileSync(abs), { date: FIXED_DATE });
}

const buf = await zip.generateAsync({
  type: "nodebuffer",
  platform: "UNIX",
  compression: "DEFLATE",
  compressionOptions: { level: 9 },
});

mkdirSync(outDir, { recursive: true });
writeFileSync(out, buf);
console.log(`✅ wrote ${relative(repo, out)} (${buf.length} bytes) — served at /sales-coach-extension.zip`);
console.log(`   host_permissions: ${hp}`);
console.log(`   files: ${INCLUDE.join(", ")}`);
