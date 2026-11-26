import { test } from "vitest";
import assert from "node:assert/strict";
import { addBusinessDays, applyAction, checkSteps, connectRate, dueAfter, engageStats, fillTemplate, FlowError, outcomeAction, replayEnrolment } from "../flows";

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

test("templates fill, and an empty placeholder stays visible", () => {
  if (fillTemplate("Hi {first_name}, about {company}", { name: "Dana Smith", company: "Acme" }) !== "Hi Dana, about Acme") throw new Error("fill");
  if (fillTemplate("Hi {first_name} at {company}", { name: "Dana", company: null }) !== "Hi Dana at [company]") throw new Error("gap");
});
test("replay: due from the step before; a stale or disallowed action is ignored", () => {
  const steps = [
    { kind: "email" as const, delay: { amount: 0, unit: "business_days" as const }, title: "Intro" },
    { kind: "call" as const, delay: { amount: 2, unit: "business_days" as const }, title: "Call" },
  ];
  const start = "2026-11-24T10:00:00Z";
  const r0 = replayEnrolment(steps, start, []);
  if (r0.stepIndex !== 0 || r0.state !== "active" || r0.dueAt?.slice(0, 10) !== "2026-11-24") throw new Error("r0");
  const r1 = replayEnrolment(steps, start, [{ stepIndex: 0, action: "complete_step", createdAt: "2026-11-25T09:00:00Z" }, { stepIndex: 0, action: "complete_step", createdAt: "2026-11-25T09:00:01Z" }]);
  if (r1.stepIndex !== 1 || r1.dueAt?.slice(0, 10) !== "2026-11-27") throw new Error("r1 " + JSON.stringify(r1));
  const r2 = replayEnrolment(steps, start, [{ stepIndex: 0, action: "resume", createdAt: "2026-11-25T09:00:00Z" }, { stepIndex: 0, action: "replied", createdAt: "2026-11-26T09:00:00Z" }]);
  if (r2.state !== "finished" || r2.dueAt !== null) throw new Error("r2");
});

test("engage stats: per flow, connect rate from outcomes, meetings and replies", () => {
  const en = [{ id: "e1", flowId: "f1", repId: "a" }, { id: "e2", flowId: "f1", repId: "b" }];
  const acts = [
    { enrolmentId: "e1", flowId: "f1", repId: "a", stepKind: "email" as const, action: "complete_step" as const, outcome: null },
    { enrolmentId: "e1", flowId: "f1", repId: "a", stepKind: "call" as const, action: "complete_step" as const, outcome: "left_voicemail" },
    { enrolmentId: "e2", flowId: "f1", repId: "b", stepKind: "call" as const, action: "meeting_booked" as const, outcome: "meeting_booked" },
    { enrolmentId: "e2", flowId: "f1", repId: "b", stepKind: null, action: "replied" as const, outcome: null },
  ];
  const [f] = engageStats(acts, en, "flow");
  if (!f || f.people !== 2 || f.stepsDone !== 3 || f.emails !== 1 || f.calls !== 2 || f.meetings !== 1 || f.replies !== 1 || f.connectRate !== 0.5) throw new Error(JSON.stringify(f));
  const byRep = engageStats(acts, en, "rep");
  if (byRep.length !== 2) throw new Error("rep rows");
});
