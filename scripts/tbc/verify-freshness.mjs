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

import { join } from "node:path";
import { run, stagedFiles, git, exists, read, frontMatter, loadAllowlist, TBC_DIR } from "./lib.mjs";

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
    checkStartTimes(r, files);
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

/**
 * A BUILD CANNOT HAVE STARTED AFTER IT SHIPPED.
 *
 * Found 2026-09-21, and the shape of it is the point. `started_at` is load-bearing twice over: the
 * manifest gate rejects any `read_at` earlier than it (A22's honesty mechanism — "you cannot claim a
 * read before the session began"), and `currentBuildDir()` picks the build with the LATEST one. That
 * second use is what corrupted the first.
 *
 * Because selection goes to the latest start, every new build must declare a time later than the
 * previous build's. Declare one an hour ahead and the next honest clock reading LOSES the selection —
 * the gate validates the old dir and the new record ships unchecked, with `tbc:freshness` green
 * because it only ever asked that SOME build dir was in the diff. The sort key made inflation the only
 * way for a new record to be seen, and the drift compounds: of 26 build dirs written on 2026-09-21,
 * twenty-five declared a start LATER THAN THE COMMIT THAT SHIPPED THEM, running from 40 minutes ahead
 * to fifteen hours ahead. Evenly spaced. A counter, written in the field where a clock reading belongs.
 *
 * `pickLatestBuildName` now demotes a not-yet-started build to the name tier, which removes the
 * PRESSURE — an honest reading outranks a future-dated predecessor. This is the other half: A30's
 * terminal step, the check that fails without the author's cooperation. A corrected sort still relies
 * on the author writing a real timestamp; nothing but this notices when they do not.
 *
 * The invariant is deliberately clock-free where it can be: compare the declared start against the
 * commit that INTRODUCED the record, not against "now". A record committed yesterday claiming a start
 * an hour after its own commit is just as false today as it was then, and `<= now` stops seeing it the
 * moment that hour passes. Only a dir with no commit yet (the build in progress) falls back to `now`.
 *
 * QUIET BY CONSTRUCTION (A30's false-positive constraint): it reads one front-matter field and one
 * commit date, has no heuristic, and the 25 historical dirs are allowlisted BY NAME with their measured
 * overshoot — kept rather than rewritten, because the record is the asset even when what it records is
 * a fabrication (§3.1).
 */
function checkStartTimes(r, files) {
  const dirs = [...new Set(
    files.map((f) => f.match(/^docs\/tbc\/(\d{4}-\d{2}-\d{2}-[^/]+)\//)?.[1]).filter(Boolean)
  )];
  const allow = new Set(loadAllowlist("freshness").map((a) => a.pattern ?? a.id));

  for (const name of dirs) {
    if (allow.has(name)) continue;
    const think = join(TBC_DIR, name, "think.md");
    if (!exists(think)) continue; // a dir without a think.md is tbc:manifest's failure, not this one.

    const started = frontMatter(read(think))?.started_at;
    if (!started) continue; // tbc:manifest fails on a missing started_at; one gate per fact.

    const declared = Date.parse(String(started).trim());
    if (!Number.isFinite(declared)) continue; // likewise tbc:manifest's.

    // The commit that ADDED this record. Empty for the build in progress -> fall back to now.
    const added = git(`log --diff-filter=A -1 --format=%cI -- "docs/tbc/${name}/think.md"`, "").trim();
    const shipped = added ? Date.parse(added) : Date.now();
    if (!Number.isFinite(shipped)) continue;

    // Five minutes of grace. Authors write a rounded start ("13:30") and can commit seconds before it;
    // 2026-08-28-after-pitch-deal-value overshoots by FIFTEEN SECONDS. Failing on that is the noisy gate
    // A30 warns about -- one people learn to skip, and then the real one rides in behind it. Six of the
    // 159 historical cases are this and nothing else.
    const GRACE_MS = 5 * 60_000;
    if (declared > shipped + GRACE_MS) {
      const hours = ((declared - shipped) / 3_600_000).toFixed(1);
      r.fail("A30 / A22",
        `${name}: started_at is ${hours}h AFTER ${added ? "the commit that shipped it" : "now"}.`,
        `  declared started_at: ${started}\n` +
        `  ${added ? "record committed:    " + added : "current time:        " + new Date().toISOString()}\n\n` +
        "A build cannot have started after it finished. started_at is the instant the session\n" +
        "began; the manifest gate measures every read_at against it, so a start pushed forward\n" +
        "makes that check vacuous - any read_at is 'in session' once the session is fiction.\n\n" +
        "If the intent was to make this build win currentBuildDir(), it no longer needs to:\n" +
        "a not-yet-started dir is demoted to the name tier, so a real clock reading outranks a\n" +
        "future-dated predecessor. Write what the clock said.");
    }
  }
}
