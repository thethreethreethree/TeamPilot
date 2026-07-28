#!/usr/bin/env node
// scripts/tbc/verify-manifest.mjs
//
// SPEC: THINK_BUILD_CHECK.md §6.2 — closes the A35 gap.
//   Fails when:
//     - any §/A\d+ citation in commit messages, code comments, or
//       docs/tbc/<dir>/*.md has NO corresponding manifest entry
//     - any manifest entry's read_at predates the session start
//     - any line_range does not exist, or the ID does not appear within it
//     - the minimum-set clauses (§3.1.2) are absent
//
// The last condition is the A35 fix: the minimum set is required
// UNCONDITIONALLY, so staying quiet no longer dodges the check.

import { join } from "node:path";
import { readdirSync } from "node:fs";
import {
  REPO, exists, read, run, currentBuildDir, sessionCommitMessages,
  extractCitations, normaliseId, frontMatter, jsonBlocks, rawJsonBlocks, loadAllowlist, repoRel,
} from "./lib.mjs";

// §3.1.2 — "Minimum set, always"
const MINIMUM_SET = ["§0", "§0.1", "§1.5.1", "§1.5.2", "§6", "A19", "A22", "A30", "A38"];

run("tbc:manifest", (r) => {
  const dir = currentBuildDir();
  if (!dir) {
    r.fail("§3.1", "No build directory under docs/tbc/.",
      "THINK produces docs/tbc/<date>-<slug>/think.md before any file is edited.");
    return;
  }
  r.note(`build: ${repoRel(dir)}`);

  const thinkPath = join(dir, "think.md");
  if (!exists(thinkPath)) {
    r.fail("§3.1", "think.md is missing.", `Expected at ${thinkPath}`);
    return;
  }
  const think = read(thinkPath);

  // ---- session start, from think.md front-matter -------------------------
  const fm = frontMatter(think);
  if (!fm?.started_at) {
    r.fail("§3.1.2", "think.md front-matter has no started_at.",
      "read_at cannot be validated against a session that does not declare its start.");
    return;
  }
  const sessionStart = new Date(fm.started_at);
  if (Number.isNaN(sessionStart.getTime())) {
    r.fail("§3.1.2", `started_at is not a valid timestamp: "${fm.started_at}"`);
    return;
  }

  // ---- parse manifest entries -------------------------------------------
  const raw = rawJsonBlocks(think);
  const parsed = jsonBlocks(think);
  if (raw.length !== parsed.length) {
    r.fail("§3.1.2", `${raw.length - parsed.length} json block(s) in think.md failed to parse.`,
      "A malformed manifest entry is an unread asset with extra steps.");
  }

  const entries = parsed
    .flatMap((b) => (Array.isArray(b) ? b : [b]))
    .filter((e) => e && typeof e === "object" && e.id && e.read_at);

  if (entries.length === 0) {
    r.fail("§3.1.2", "No session-read manifest entries found in think.md.",
      "The manifest is required whether or not the build cites anything (A35).");
    return;
  }
  r.note(`${entries.length} manifest entr(ies)`);

  const declared = new Map();
  for (const e of entries) declared.set(normaliseId(e.id), e);

  // ---- 1. minimum set present (the A35 fix) ------------------------------
  const missing = MINIMUM_SET.filter((id) => !declared.has(normaliseId(id)));
  if (missing.length) {
    r.fail("§3.1.2 / A35",
      `Minimum-set clause(s) absent from the manifest: ${missing.join(", ")}`,
      "These are required unconditionally. A35: the hook charges for the citation,\n" +
      "not the reliance — so the minimum set exists to make silence non-viable.");
  }

  // ---- 2. read_at is this session ---------------------------------------
  for (const e of entries) {
    const t = new Date(e.read_at);
    if (Number.isNaN(t.getTime())) {
      r.fail("§3.1.2", `${e.id}: read_at is not a valid timestamp ("${e.read_at}").`);
      continue;
    }
    if (t < sessionStart) {
      r.fail("§3.1.2 / A22",
        `${e.id}: read_at ${e.read_at} predates session start ${fm.started_at}.`,
        "A22: cached labels are not a read. Open the file, read it, then write the timestamp.");
    }
  }

  // ---- 3. line_range is real and contains the ID -------------------------
  for (const e of entries) {
    if (!e.line_range || !e.source_file) {
      r.fail("§3.1.2", `${e.id}: missing source_file or line_range.`);
      continue;
    }
    const src = join(REPO, e.source_file);
    if (!exists(src)) {
      r.fail("§3.1.2", `${e.id}: source_file "${e.source_file}" does not exist.`);
      continue;
    }
    const m = String(e.line_range).match(/^(\d+)\s*-\s*(\d+)$/);
    if (!m) {
      r.fail("§3.1.2", `${e.id}: line_range "${e.line_range}" is not "start-end".`);
      continue;
    }
    const [start, end] = [Number(m[1]), Number(m[2])];
    const lines = read(src).split("\n");
    if (start < 1 || end > lines.length || start > end) {
      r.fail("§3.1.2",
        `${e.id}: line_range ${e.line_range} does not exist in ${e.source_file} (${lines.length} lines).`);
      continue;
    }
    const slice = lines.slice(start - 1, end).join("\n");
    const bare = normaliseId(e.id).replace(/^§/, "");
    const idRe = new RegExp(`(§\\s?)?${bare.replace(/\./g, "\\.")}\\b`);
    if (!idRe.test(slice)) {
      r.fail("§3.1.2",
        `${e.id}: the ID does not appear within ${e.source_file}:${e.line_range}.`,
        "The range must be where the clause actually lives — this catches a\n" +
        "plausible-looking range written without opening the file.");
    }
  }

  // ---- 4. why_it_governs is the agent's own words ------------------------
  for (const e of entries) {
    const why = String(e.why_it_governs ?? "").trim();
    if (why.length < 25) {
      r.fail("§3.1.2",
        `${e.id}: why_it_governs is absent or too short to be a reason.`,
        "§3.1.2: a restatement of the asset title is not a reason.");
    }
    if (!e.how_this_build_will_embody_it) {
      r.fail("§3.1.2", `${e.id}: how_this_build_will_embody_it is absent.`);
    }
  }

  // ---- 5. every citation has a manifest entry ---------------------------
  const allow = loadAllowlist("manifest").map((a) => normaliseId(a.id ?? a.pattern));
  const cited = new Set();

  const addFrom = (text, where) => {
    for (const c of extractCitations(text)) {
      const key = normaliseId(c);
      if (!declared.has(key) && !allow.includes(key)) {
        cited.add(`${key}\u0000${where}`);
      }
    }
  };

  // build artifacts
  //
  // FALSE-POSITIVE FIX (§6.7, A30's noisy-gate constraint):
  // A residual entry names an asset the agent DECLARED IT DID NOT READ (A36).
  // Demanding a manifest entry for it would fail every honest residual and
  // train the agent to stop declaring residuals — the A35 inversion, reproduced
  // by our own gate. So: an UNOPENED residual entry is exempt. An OPENED one is
  // not, because opening it IS a read and must carry a timestamp.
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    let text = read(join(dir, f));
    if (f === "closure.md") text = stripUnopenedResidual(text);
    addFrom(text, `docs/tbc/${repoRel(dir).split("/").pop()}/${f}`);
  }
  // commit messages for this session
  addFrom(sessionCommitMessages(), "commit messages");

  const grouped = new Map();
  for (const s of cited) {
    const [id, where] = s.split("\u0000");
    if (!grouped.has(id)) grouped.set(id, new Set());
    grouped.get(id).add(where);
  }
  for (const [id, wheres] of grouped) {
    r.fail("§6.2 / A22",
      `${id} is cited but has no manifest entry.`,
      `cited in: ${[...wheres].join(", ")}\n` +
      "Open it, read it, add the entry with an in-session read_at.");
  }
});

/**
 * Remove residual entries whose opened_at is null from the citation scan.
 * Opened entries are left in — they were read, so they owe a manifest entry.
 */
function stripUnopenedResidual(md) {
  return md.replace(/```json\s*\n([\s\S]*?)```/g, (whole, body) => {
    let parsed;
    try { parsed = JSON.parse(body); } catch { return whole; }
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    if (!arr.some((e) => e && typeof e === "object" && "confidence_it_does_not_matter" in e)) {
      return whole;
    }
    const kept = arr.filter((e) => e.opened_at);
    return "```json\n" + JSON.stringify(kept, null, 2) + "\n```";
  });
}
