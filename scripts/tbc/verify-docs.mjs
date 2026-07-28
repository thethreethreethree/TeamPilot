#!/usr/bin/env node
// scripts/tbc/verify-docs.mjs
//
// SPEC: THINK_BUILD_CHECK.md §6.5
//   "Fails when CLAUDE.md or ThinkerThinker.md hashes differ from
//    DOC_MANIFEST.json without a matching AMD-XXX in docs/amendments/
//    — enforcing §7.4."
//
// Also closes SYSTEM-PREP R3 (naming drift): a manifest path that does not
// resolve is a failure, so a rename cannot go unnoticed.

import { join } from "node:path";
import { readdirSync } from "node:fs";
import { REPO, AMD_DIR, MANIFEST_PATH, exists, readJSON, sha256, git, run } from "./lib.mjs";

run("tbc:docs", (r) => {
  if (!exists(MANIFEST_PATH)) {
    r.fail("§6.5", "docs/tbc/DOC_MANIFEST.json is missing.",
      "Generate it with the current hashes of the governing documents.");
    return;
  }

  const manifest = readJSON(MANIFEST_PATH);
  const docs = manifest.documents ?? [];
  if (docs.length === 0) {
    r.fail("§6.5", "DOC_MANIFEST.json lists no documents.");
    return;
  }

  // Amendment IDs referenced anywhere in the current commit message or in the
  // amendments directory listing. §7.4 requires the edit to REFERENCE its
  // amendment; we accept either an AMD file that exists or a commit trailer.
  const amdFiles = exists(AMD_DIR)
    ? readdirSync(AMD_DIR).filter((f) => /^AMD-\d+/i.test(f))
    : [];
  const commitMsg = git("log -1 --pretty=%B", "");
  const stagedMsgPath = process.env.HUSKY_GIT_PARAMS ?? process.env.GIT_PARAMS;
  const msgSources = [commitMsg, stagedMsgPath ?? ""].join("\n");

  const changed = [];

  for (const doc of docs) {
    const path = join(REPO, doc.path);

    if (!exists(path)) {
      r.fail("§6.5 / R3",
        `Manifest lists "${doc.path}" but no such file exists.`,
        `A rename or move happened without updating DOC_MANIFEST.json.\n` +
        `Either restore the path or regenerate the manifest under an amendment.`);
      continue;
    }

    const actual = sha256(path);
    if (!doc.sha256 || doc.sha256 === "<hash>") {
      r.fail("§6.5", `Manifest entry for "${doc.path}" has no recorded hash.`,
        `Recorded: ${doc.sha256 ?? "(absent)"}\nActual:   ${actual}`);
      continue;
    }

    if (actual !== doc.sha256) {
      changed.push({ path: doc.path, recorded: doc.sha256, actual, role: doc.role });
    }
  }

  if (changed.length === 0) {
    r.note(`${docs.length} governing document(s) match the manifest.`);
    return;
  }

  // A governing document changed. §7.4: permitted ONLY as the consequence of a
  // ratified amendment, and the edit must reference it.
  const referencedAmd = (msgSources.match(/AMD-\d+/gi) ?? []).map((s) => s.toUpperCase());

  for (const c of changed) {
    const hasAmd = referencedAmd.some((id) =>
      amdFiles.some((f) => f.toUpperCase().startsWith(id))
    );

    if (hasAmd) {
      r.note(
        `"${c.path}" changed under ${referencedAmd.join(", ")} — permitted. ` +
        `Regenerate DOC_MANIFEST.json in this commit.`
      );
      r.fail("§6.5",
        `"${c.path}" changed and the manifest was not regenerated.`,
        `Recorded: ${c.recorded}\nActual:   ${c.actual}\n` +
        `The amendment authorises the edit; it does not update the manifest for you.`);
    } else {
      r.fail("§7.4",
        `"${c.path}" changed with no ratified amendment referenced.`,
        `Recorded: ${c.recorded}\n` +
        `Actual:   ${c.actual}\n` +
        `§7.4 — the constitution may only be modified as the consequence of a\n` +
        `ratified amendment, and the edit must reference its amendment by ID in\n` +
        `the commit message. An edit without a backing amendment must be reverted.\n` +
        `Amendments on file: ${amdFiles.length ? amdFiles.join(", ") : "(none)"}`);
    }
  }
});
