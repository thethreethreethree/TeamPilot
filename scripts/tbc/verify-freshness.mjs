#!/usr/bin/env node
// scripts/tbc/verify-freshness.mjs
//
// SPEC: F4 fix (AMD-008 install audit; founder decision 2026-07-28 = option 1).
//
// THE HOLE: currentBuildDir() returns the lexically-greatest EXISTING dir under
// docs/tbc/. Once the install dir is permanently committed, every future run
// finds a valid latest dir and the other gates pass — INCLUDING a new code
// change that created no build artifacts of its own. The "every substantive
// build needs its own docs/tbc/<date>-<slug>/" mandate then rests on the
// author voluntarily creating a dir, which is the exact A38 discretionary-
// invocation failure the protocol exists to eliminate.
//
// THE FIX: when the change touches an enforced code path (src/scripts/
// migrations), require the SAME change to add/modify a dated build dir — unless
// the commit carries a `TBC-Exempt: <reason>` trailer for a genuinely trivial
// edit (typo, comment, formatting). Precise by construction, so it is a real
// gate (A30) and not a noisy one (A33): it fires only on code-without-a-build.

import { run, stagedFiles, git, exists, read } from "./lib.mjs";

const ENFORCED = /^(src|scripts|migrations)\//;
const BUILD_DIR = /^docs\/tbc\/\d{4}-\d{2}-\d{2}-[^/]+\//;
const EXEMPT = /(^|\n)\s*TBC-Exempt:\s*\S/;

run("tbc:freshness", (r) => {
  // Where are the changed files + the commit message?
  //   commit-msg hook: the STAGED diff + the message file passed as argv[2].
  //   check / CI:      the branch's committed range vs the base (no staged diff).
  const msgFile = process.argv[2];
  let files = stagedFiles();
  let msg = msgFile && exists(msgFile) ? read(msgFile) : "";

  if (files.length === 0) {
    const base = process.env.TBC_BASE ?? "origin/main";
    files = git(`diff --name-only ${base}...HEAD`)
      .split("\n").map((s) => s.trim()).filter(Boolean);
    if (!msg) msg = git(`log ${base}..HEAD --pretty=%B`);
  }

  if (files.length === 0) {
    r.note("no staged or committed-range changes to evaluate.");
    return;
  }

  const enforced = files.filter((f) => ENFORCED.test(f));
  if (enforced.length === 0) {
    r.note(`${files.length} changed file(s); none on an enforced path (src/scripts/migrations).`);
    return;
  }

  if (files.some((f) => BUILD_DIR.test(f))) {
    r.note(`${enforced.length} enforced-path change(s) ship a TBC build directory.`);
    return;
  }
  if (EXEMPT.test(msg)) {
    r.note(`${enforced.length} enforced-path change(s) carry a TBC-Exempt trailer.`);
    return;
  }

  r.fail("F4",
    `${enforced.length} change(s) on an enforced path have no TBC build directory and no TBC-Exempt trailer.`,
    "Enforced paths: src/, scripts/, migrations/.\n" +
    "Changed:\n  " + enforced.slice(0, 12).join("\n  ") + "\n\n" +
    "A substantive code change requires its own docs/tbc/<YYYY-MM-DD>-<slug>/ build\n" +
    "(THINK -> BUILD -> CHECK -> CLOSE). For a genuinely trivial change (typo,\n" +
    "comment, formatting), add a commit trailer:  TBC-Exempt: <one-line reason>.\n" +
    "This closes F4: otherwise the committed install dir permanently satisfies\n" +
    "currentBuildDir() and a new build can skip TBC entirely (A38).");
});
