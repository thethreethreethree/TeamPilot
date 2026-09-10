/**
 * The skill score, and the promise it keeps.
 *
 * The app told a rep, on the screen, that the review would score whether they
 * applied the skill they chose — and then dropped the scorecard the server sent.
 * These tests pin the reading of that scorecard, and the one place where showing
 * the server's honest number would mislead: a skill that never came up.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  NOT_ATTEMPTED_BODY,
  practiceScoreView,
  readScorecard,
} from "@/lib/practice-scorecard";

const CARD = {
  focus: "Objection handling",
  applied: true,
  score: 74,
  nextRep: "Name the price sooner.",
};

test("the scorecard is read from where the route puts it, not from the top level", () => {
  // The dissect bug exactly: the route wraps, the app read the top level and
  // found nothing. A reader that ignores the wrapper passes nothing here.
  assert.equal(readScorecard({ scorecard: CARD })?.focus, "Objection handling");
  assert.equal(readScorecard(CARD), null, "an unwrapped payload was accepted");
});

test("a scored run shows the skill, the number and the same band words as a real session", () => {
  const v = practiceScoreView({ scorecard: CARD });
  assert.equal(v.kind, "scored");
  if (v.kind !== "scored") return;
  assert.equal(v.focus, "Objection handling");
  assert.equal(v.score, 74);
  // 74 is 'solid' on the session scale. A second private vocabulary would give
  // a rep two different words for the same number.
  assert.equal(v.band, "Solid");
  assert.equal(v.nextRep, "Name the price sooner.");
});

test("a skill the rep never used shows NO number — a score on nothing reads as a grade on them", () => {
  const v = practiceScoreView({
    scorecard: { ...CARD, applied: false, score: 14 },
  });
  assert.equal(v.kind, "not-attempted");
  // The assertion that bites: a view that leaked the 14 through would fail here.
  assert.ok(
    !JSON.stringify(v).includes("14"),
    "the unapplied score reached the screen",
  );
  if (v.kind !== "not-attempted") return;
  assert.equal(v.focus, "Objection handling");
  assert.equal(
    v.nextRep,
    "Name the price sooner.",
    "the way back in was dropped",
  );
});

test("the not-attempted copy states the cause and does not read as a failure", () => {
  assert.match(NOT_ATTEMPTED_BODY, /nothing to score yet/);
  assert.ok(
    !/failed|poor|bad|you did not do well/i.test(NOT_ATTEMPTED_BODY),
    "absence was dressed as failure",
  );
});

test("applied must be a real boolean — a missing flag is an unknown shape, not a false", () => {
  // Guessing false here would tell a rep who DID use the skill that they never
  // got to it, which is worse than showing nothing.
  assert.equal(
    readScorecard({ scorecard: { focus: "X", score: 80, nextRep: "" } }),
    null,
  );
});

test("a score with no skill name is not shown, because nobody can read what it measured", () => {
  assert.equal(
    practiceScoreView({ scorecard: { ...CARD, focus: "   " } }).kind,
    "none",
  );
});

test("a malformed scorecard never takes down the review beside it", () => {
  for (const payload of [
    null,
    undefined,
    {},
    { scorecard: null },
    { scorecard: "nope" },
    { scorecard: [] },
  ]) {
    assert.equal(
      practiceScoreView(payload).kind,
      "none",
      `threw or misread ${JSON.stringify(payload)}`,
    );
  }
});

test("an out-of-range or unparseable score is clamped rather than shown raw", () => {
  assert.equal(
    readScorecard({ scorecard: { ...CARD, score: 140 } })?.score,
    100,
  );
  assert.equal(readScorecard({ scorecard: { ...CARD, score: -8 } })?.score, 0);
  assert.equal(
    readScorecard({ scorecard: { ...CARD, score: 71.6 } })?.score,
    72,
  );
  assert.equal(readScorecard({ scorecard: { ...CARD, score: "x" } })?.score, 0);
});
