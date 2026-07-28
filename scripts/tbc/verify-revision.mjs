#!/usr/bin/env node
// scripts/tbc/verify-revision.mjs
//
// SPEC: the permanent structural fix for the recurring class the founder named
// critical (2026-07-29): "a revision reported DONE while a subset was never
// implemented." Root cause (recorded in
// docs/tbc/2026-07-29-sales-coach-revision-completion/closure.md, RES-01):
//   (a) capturing every discrete change from a marked-up image/PDF is lossy —
//       struck REMOVALS are easy to miss vs additions;
//   (b) no item-by-item traceability from the instruction to the build, so a
//       partial build LOOKS complete;
//   (c) an interruption leaves no durable record of what's left + its risks, so
//       on resume the remainder is lost and the partial is treated as done.
//
// THE FIX — two enforced structures:
//   1. docs/BUILD-STATE.md — the durable unfinished-work + risks ledger, the one
//      file a resume reads first. It must ALWAYS exist (defends (c)).
//   2. docs/tbc/<dir>/revision.md — when a build is a founder revision, it lists
//      EVERY atomic requested change as {id, verb, item, disposition}. Closure
//      cannot pass with an un-dispositioned item, a "done" without evidence, or a
//      "deferred" without a reason (defends (a) + (b): partial completion becomes
//      a VISIBLE structural state, not an invisible one).
//
// A33 (precision or nothing): "this build WAS a founder revision" is not
// mechanically detectable without false positives — so the manifest is enforced
// when PRESENT and the hole is NAMED when absent, rather than red-ing every
// non-revision build. The enforceable core (all-declared-items-dispositioned) is
// precise and green when honest. A36: the ledger + manifest ARE the residual
// queue for revision scope, read from the top, not written as a disclaimer.

import { join } from "node:path";
import { exists, read, run, currentBuildDir, jsonBlocks, rawJsonBlocks, repoRel, REPO } from "./lib.mjs";

const VALID = new Set(["done", "deferred"]);

run("tbc:revision", (r) => {
  // ---- 1. the durable resume ledger must exist (defends interruption) --------
  const ledger = join(REPO, "docs", "BUILD-STATE.md");
  if (!exists(ledger)) {
    r.fail("REV-1",
      "docs/BUILD-STATE.md (the durable unfinished-work + risks ledger) is missing.",
      "It is the single file a RESUME reads first after an interruption. It must\n" +
      "always exist so no unfinished work is ever silently lost.");
    return;
  }

  const dir = currentBuildDir();
  if (!dir) {
    r.note("no build directory — revision gate binds at a build's closure.");
    return;
  }
  const rel = repoRel(dir);

  const revPath = join(dir, "revision.md");
  const closurePath = join(dir, "closure.md");

  // ---- 2. the revision manifest is enforced only when declared (A33) ---------
  if (!exists(revPath)) {
    r.note(`${rel}: no revision.md — build not declared a founder-revision (honest hole per A33).`);
    return;
  }

  const rev = read(revPath);

  // malformed json is an un-checkable manifest — fail loudly, don't skip it.
  const raw = rawJsonBlocks(rev);
  const parsedBlocks = jsonBlocks(rev);
  if (raw.length !== parsedBlocks.length) {
    r.fail("REV-2", `${raw.length - parsedBlocks.length} json block(s) in ${rel}/revision.md failed to parse.`,
      "A manifest that does not parse cannot prove completeness.");
    return;
  }

  const items = parsedBlocks
    .flatMap((b) => (Array.isArray(b) ? b : [b]))
    .filter((e) => e && typeof e === "object" && "id" in e && "item" in e);

  if (items.length === 0) {
    r.fail("REV-2", `${rel}/revision.md declares no requested-change items.`,
      "List every atomic change the founder asked for — ESPECIALLY each struck /\n" +
      "removed item from a marked-up image — as {id, verb, item, disposition}.\n" +
      "The lossy-capture failure (missing a strike) is defeated by enumerating first.");
    return;
  }
  r.note(`${items.length} requested-change item(s) in ${rel}/revision.md`);

  // ---- 3. every declared item must be honestly dispositioned -----------------
  const atClosure = exists(closurePath);
  for (const e of items) {
    const d = String(e.disposition ?? "").toLowerCase();
    if (!VALID.has(d)) {
      r.fail("REV-3",
        `revision item "${e.id}" has no valid disposition (got "${e.disposition ?? ""}").`,
        `item: ${e.item}\n` +
        "Every requested change must be done|deferred. This is the structural block\n" +
        "on 'reported done while partial' — an un-dispositioned item cannot close.");
      continue;
    }
    if (d === "done" && !e.evidence) {
      r.fail("REV-4",
        `revision item "${e.id}" is "done" but records no evidence.`,
        "A38: done is a check you can point to — a grep, a test, a read-path. Name it.");
    }
    if (d === "deferred" && !e.defer_reason) {
      r.fail("REV-5",
        `revision item "${e.id}" is "deferred" but records no defer_reason.`,
        "A deferred item is only honest with a reason + its risk. Record both here and\n" +
        "in docs/BUILD-STATE.md's unfinished queue so the resume sees it.");
    }
  }

  // ---- 4. at closure, deferred items must be visible in the resume ledger ----
  if (atClosure) {
    const deferred = items.filter((e) => String(e.disposition).toLowerCase() === "deferred");
    if (deferred.length) {
      const ledgerText = read(ledger);
      const missing = deferred.filter((e) => !ledgerText.includes(String(e.id)));
      if (missing.length) {
        r.fail("REV-6",
          `deferred item(s) not carried into docs/BUILD-STATE.md: ${missing.map((e) => e.id).join(", ")}`,
          "A closure that defers work must leave that work in the durable ledger, or an\n" +
          "interruption loses it — the exact failure this mechanism exists to prevent.");
      } else {
        r.note(`${deferred.length} deferred item(s) all present in docs/BUILD-STATE.md.`);
      }
    }
  }
});
