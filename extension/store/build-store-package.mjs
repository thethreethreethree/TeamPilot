// Produce a Chrome-Web-Store-ready copy of the extension in extension/store/dist/.
//
// WHY this exists: the dev extension carries http://localhost:4321 in host_permissions + externally_connectable
// so the founder can test against a local server. For the PUBLISHED build those MUST be stripped — an unused
// permission is CWS rejection reason #1. It also drops dev/dead files (popup.*, README, the store/ tooling)
// that reviewers flag. Run:  node extension/store/build-store-package.mjs   then zip the dist/ contents.

import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const extDir = join(here, ".."); // extension/
const dist = join(here, "dist");

// Files the published package needs. Everything else in extension/ is dev-only or dead.
const INCLUDE = ["manifest.json", "background.js", "content.js", "config.js", "adapters.js", "permission.html", "permission.js", "icons"];
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

// Fresh dist/
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const f of INCLUDE) {
  const src = join(extDir, f);
  if (!existsSync(src)) throw new Error(`missing required file: ${f}`);
  if (f === "manifest.json") continue; // written below (stripped)
  cpSync(src, join(dist, f), { recursive: true });
}
writeFileSync(join(dist, "manifest.json"), JSON.stringify(prod, null, 2) + "\n");

// Validate the produced manifest.
const errs = [];
const hp = JSON.stringify(prod.host_permissions || []);
const ec = JSON.stringify(prod.externally_connectable || {});
if (STRIP_HOST.test(hp)) errs.push("host_permissions still contains localhost");
if (STRIP_HOST.test(ec)) errs.push("externally_connectable still contains localhost");
if (prod.manifest_version !== 3) errs.push("manifest_version must be 3");
if (!prod.icons?.["128"]) errs.push("128px icon missing");
if ((prod.description || "").length >= 132) errs.push("description >= 132 chars");

console.log("Produced:", dist);
console.log("  host_permissions:", hp);
console.log("  externally_connectable.matches:", JSON.stringify(prod.externally_connectable?.matches || []));
console.log("  files:", INCLUDE.join(", "));
if (errs.length) {
  console.error("\nVALIDATION FAILED:\n - " + errs.join("\n - "));
  process.exit(1);
}
console.log("\n✅ store package valid. Next: zip the CONTENTS of dist/ (manifest at the zip root):");
console.log("   cd extension/store/dist && zip -r ../care-extension.zip . -x '.*'");
