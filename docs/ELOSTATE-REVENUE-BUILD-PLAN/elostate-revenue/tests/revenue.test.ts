import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateWarnings, rankOf, noPower, DEFAULT_SETTINGS, type DealFacts } from "../src/lib/revenue/warnings.ts";
import { activityScore, activityLevel, transition, PlaybookError, winLoss, accountKey, looseKey } from "../src/lib/revenue/rules.ts";

const base: DealFacts = {
  status: "open", createdOn: "2026-11-01", closeDate: "2026-12-20", stageId: "s2", stageEnteredOn: "2026-11-10",
  calls: [{ on: "2026-11-20", customerSpoke: true }],
  contacts: [{ rank: "vp", lastActiveOn: "2026-11-20" }, { rank: "manager", lastActiveOn: "2026-11-20" }],
  pricingMentioned: true,
};
const kinds = (d: DealFacts, today: string, s = DEFAULT_SETTINGS) => evaluateWarnings(d, today, s).map((w) => w.kind);

test("a healthy open deal raises no warning", () => assert.deepEqual(kinds(base, "2026-11-25"), []));
test("won and lost deals never warn", () => {
  assert.deepEqual(kinds({ ...base, status: "won", calls: [] }, "2027-03-01"), []);
  assert.deepEqual(kinds({ ...base, status: "lost", calls: [] }, "2027-03-01"), []);
});
test("no activity fires at the threshold, not a day before", () => {
  assert.ok(!kinds(base, "2026-12-03").includes("no_activity"));
  assert.ok(kinds(base, "2026-12-04").includes("no_activity"));
});
test("ghosted: calls happened but the customer stopped speaking", () => {
  const d = { ...base, calls: [{ on: "2026-11-10", customerSpoke: true }, { on: "2026-11-24", customerSpoke: false }] };
  assert.ok(kinds(d, "2026-11-25").includes("ghosted"));
  assert.ok(!kinds(base, "2026-11-25").includes("ghosted"));
});
test("overdue once the close date has passed", () => {
  assert.ok(!kinds(base, "2026-12-20").includes("overdue"));
  assert.ok(kinds(base, "2026-12-21").includes("overdue"));
});
test("few contacts only after the grace period", () => {
  const d = { ...base, contacts: [{ rank: "vp" as const, lastActiveOn: "2026-11-20" }] };
  assert.ok(!kinds({ ...d, createdOn: "2026-11-20" }, "2026-11-25").includes("few_contacts"));
  assert.ok(kinds(d, "2026-11-25").includes("few_contacts"));
});
test("no power near close; an active VP prevents it; unknown titles never fire it", () => {
  const juniors = [{ rank: "manager" as const, lastActiveOn: "2026-12-01" }, { rank: "individual" as const, lastActiveOn: "2026-12-01" }];
  assert.ok(kinds({ ...base, contacts: juniors }, "2026-12-05").includes("no_power"));
  assert.ok(!kinds(base, "2026-12-05").includes("no_power"));
  assert.equal(noPower([{ rank: "unknown", lastActiveOn: null }], "2026-12-05", 30), false);
});
test("pricing not mentioned close to the close date", () => {
  assert.ok(kinds({ ...base, pricingMentioned: false }, "2026-12-05").includes("pricing_not_mentioned"));
  assert.ok(!kinds({ ...base, pricingMentioned: false, closeDate: "2027-03-01" }, "2026-12-05").includes("pricing_not_mentioned"));
});
test("stalled only for a stage with a limit", () => {
  assert.ok(!kinds(base, "2026-11-25").includes("stalled"));
  assert.ok(kinds(base, "2026-11-25", { ...DEFAULT_SETTINGS, stalledDays: { s2: 10 } }).includes("stalled"));
  assert.ok(!kinds(base, "2026-11-19", { ...DEFAULT_SETTINGS, stalledDays: { s2: 10 } }).includes("stalled"));
});
test("titles map to ranks; an unclear title stays unknown", () => {
  assert.equal(rankOf("Chief Revenue Officer"), "c_level");
  assert.equal(rankOf("VP of Sales"), "vp");
  assert.equal(rankOf("Head of Ops"), "director");
  assert.equal(rankOf("Sales Manager"), "manager");
  assert.equal(rankOf("Account Representative"), "individual");
  assert.equal(rankOf("Wizard"), "unknown");
  assert.equal(rankOf(""), "unknown");
});

test("activity: recent two-way calls score high, nothing scores inactive", () => {
  const today = "2026-11-25";
  assert.equal(activityLevel(activityScore([], today, 90)), "inactive");
  assert.equal(activityLevel(activityScore(["2026-11-24", "2026-11-10", "2026-10-25", "2026-10-05"], today, 90)), "high");
  assert.equal(activityLevel(activityScore(["2026-09-01"], today, 90)), "low");
  assert.ok(activityScore(["2026-11-24", "2026-11-23"], today, 90) > activityScore(["2026-11-24"], today, 90));
  assert.ok(activityScore(["2026-11-24", "2026-11-23", "2026-11-22"], today, 90) - activityScore(["2026-11-24", "2026-11-23"], today, 90)
    < activityScore(["2026-11-24", "2026-11-23"], today, 90) - activityScore(["2026-11-24"], today, 90), "diminishing returns");
});

test("playbook: a person writes before anyone validates; editing un-validates", () => {
  const owner = { isOwner: true, isManager: false };
  assert.equal(transition("empty", "ai_suggest", owner), "ai_found");
  assert.equal(transition("ai_found", "write", owner), "noted");
  assert.equal(transition("noted", "validate", owner), "validated");
  assert.equal(transition("validated", "write", owner), "noted");
  assert.throws(() => transition("ai_found", "validate", owner), PlaybookError);
  assert.throws(() => transition("noted", "validate", { isOwner: false, isManager: false }), PlaybookError);
});

test("win/loss shows nothing below the minimum, and a side too small to judge is null", () => {
  const few = Array.from({ length: 99 }, (_, i) => ({ won: i % 2 === 0, tags: [] }));
  assert.deepEqual(winLoss(few), { enough: false, closed: 99, needed: 100 });
  const deals = Array.from({ length: 100 }, (_, i) => ({ won: i < 40, tags: i < 30 ? ["pricing"] : i < 35 ? ["rare"] : [] }));
  const r = winLoss(deals);
  assert.ok(r.enough);
  if (!r.enough) return;
  assert.equal(r.rate, 0.4);
  const pricing = r.rows.find((x) => x.tag === "pricing")!;
  assert.equal(pricing.rateWith, 1);
  assert.equal(r.rows.find((x) => x.tag === "rare")!.rateWith, null);
});

test("account keys: case and punctuation ignored, legal suffixes kept apart", () => {
  assert.equal(accountKey("  ACME, Inc. "), accountKey("acme inc"));
  assert.notEqual(accountKey("Acme"), accountKey("Acme Inc"));
  assert.equal(looseKey("Acme Inc"), looseKey("acme"));
  assert.equal(accountKey("Café Ünïon"), "cafe union");
});
