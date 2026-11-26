import { test } from "node:test";
import assert from "node:assert/strict";
import { addBusinessDays, applyAction, checkSteps, connectRate, dueAfter, FlowError, outcomeAction } from "../src/lib/engage/flows.ts";

test("steps: a valid flow passes; bad ones are refused", () => {
  assert.doesNotThrow(() => checkSteps([{ kind: "email", delay: { amount: 0, unit: "business_days" }, title: "Intro" }]));
  assert.throws(() => checkSteps([]), FlowError);
  assert.throws(() => checkSteps([{ kind: "email", delay: { amount: 31, unit: "business_days" }, title: "x" }]), FlowError);
  assert.throws(() => checkSteps([{ kind: "fax" as never, delay: { amount: 1, unit: "hours" }, title: "x" }]), FlowError);
  assert.throws(() => checkSteps([{ kind: "call", delay: { amount: 1, unit: "hours" }, title: " " }]), FlowError);
});

test("business days skip weekends; 0 moves a weekend to Monday", () => {
  assert.equal(addBusinessDays("2026-11-27T10:00:00Z", 1).slice(0, 10), "2026-11-30"); // Fri + 1 → Mon
  assert.equal(addBusinessDays("2026-11-28T10:00:00Z", 0).slice(0, 10), "2026-11-30"); // Sat → Mon
  assert.equal(addBusinessDays("2026-11-24T10:00:00Z", 3).slice(0, 10), "2026-11-27"); // Tue + 3 → Fri
});

test("due after: hours or business days from the step before", () => {
  assert.equal(dueAfter("2026-11-27T10:00:00Z", { kind: "call", delay: { amount: 4, unit: "hours" }, title: "x" }), "2026-11-27T14:00:00.000Z");
  assert.equal(dueAfter("2026-11-27T10:00:00Z", { kind: "call", delay: { amount: 2, unit: "business_days" }, title: "x" }).slice(0, 10), "2026-12-01");
});

test("enrolment: steps advance and finish; reply and meeting finish; opt-out removes; ended can't change", () => {
  assert.deepEqual(applyAction("active", 0, 3, "complete_step"), { state: "active", stepIndex: 1 });
  assert.deepEqual(applyAction("active", 2, 3, "complete_step"), { state: "finished", stepIndex: 3 });
  assert.deepEqual(applyAction("active", 1, 3, "replied"), { state: "finished", stepIndex: 1 });
  assert.deepEqual(applyAction("paused", 1, 3, "meeting_booked"), { state: "finished", stepIndex: 1 });
  assert.deepEqual(applyAction("active", 1, 3, "opted_out"), { state: "removed", stepIndex: 1 });
  assert.throws(() => applyAction("finished", 3, 3, "resume"), FlowError);
  assert.throws(() => applyAction("paused", 1, 3, "complete_step"), FlowError);
  assert.throws(() => applyAction("active", 1, 3, "resume"), FlowError);
});

test("outcomes: connect rate and what they do", () => {
  assert.equal(connectRate(["left_voicemail", "follow_up", "busy", "meeting_booked"]), 0.5);
  assert.equal(connectRate([]), null);
  assert.equal(connectRate(["unknown_key"]), null);
  assert.equal(outcomeAction("meeting_booked"), "meeting_booked");
  assert.equal(outcomeAction("opt_out"), "opted_out");
  assert.equal(outcomeAction("busy"), "complete_step");
});
