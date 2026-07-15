import { describe, expect, it } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody, DialogueDecisionSchema, RippleTraceSchema } from "../validate";

/**
 * readBody guards the input of every POST route: malformed JSON and
 * schema-invalid bodies must be rejected with a 400 (not reach the handler),
 * and a valid body must pass through as typed data. This is a security-relevant
 * choke point, so its three outcomes are pinned here.
 */
const Schema = z.object({ name: z.string(), count: z.number().int() });

function jsonReq(body: string): NextRequest {
  return new NextRequest("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("readBody", () => {
  it("returns typed data for a valid body", async () => {
    const out = await readBody(jsonReq(JSON.stringify({ name: "a", count: 3 })), Schema);
    expect(out).not.toBeInstanceOf(NextResponse);
    expect(out).toEqual({ name: "a", count: 3 });
  });

  it("400s on malformed JSON", async () => {
    const out = await readBody(jsonReq("this is not json"), Schema);
    expect(out).toBeInstanceOf(NextResponse);
    const res = out as NextResponse;
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/valid JSON/i);
  });

  it("400s with field issues on a schema mismatch", async () => {
    const out = await readBody(
      jsonReq(JSON.stringify({ name: 123, count: 1.5 })),
      Schema
    );
    expect(out).toBeInstanceOf(NextResponse);
    const res = out as NextResponse;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/validation failed/i);
    const paths = body.issues.map((i: { path: string }) => i.path);
    expect(paths).toContain("name"); // wrong type
    expect(paths).toContain("count"); // not an int
  });
});

/**
 * §3.3 GUIDE-DON'T-OVERTAKE is enforced at this schema: the decision-dialogue route
 * CANNOT run until the user has articulated their OWN situation + diagnosis + proposal.
 * The `.min(20)` on all three is the structural interrupt (class 48) — it makes "ask the
 * user first" a hard API contract, not discretion. If someone weakens these to `.min(1)`
 * / `.optional()`, the System could respond before the human has thought — the exact §3.3
 * overtake this schema exists to prevent. These tests pin the contract so that weakening
 * fails CI, not just review.
 */
describe("DialogueDecisionSchema — §3.3 ask-first is a hard contract", () => {
  const ok = { situation: "S".repeat(20), userDiagnosis: "D".repeat(20), userProposal: "P".repeat(20) };

  it("accepts once the user has articulated situation + diagnosis + proposal (>=20 chars each)", () => {
    expect(DialogueDecisionSchema.safeParse(ok).success).toBe(true);
  });

  it("REJECTS a too-short userDiagnosis — the System may not respond until the user states their own read", () => {
    expect(DialogueDecisionSchema.safeParse({ ...ok, userDiagnosis: "too short" }).success).toBe(false);
  });

  it("REJECTS a too-short userProposal — the user must offer their own solution first", () => {
    expect(DialogueDecisionSchema.safeParse({ ...ok, userProposal: "nope" }).success).toBe(false);
  });

  it("REJECTS a MISSING userDiagnosis or userProposal (ask-first is mandatory, not optional)", () => {
    expect(DialogueDecisionSchema.safeParse({ situation: ok.situation, userProposal: ok.userProposal }).success).toBe(false);
    expect(DialogueDecisionSchema.safeParse({ situation: ok.situation, userDiagnosis: ok.userDiagnosis }).success).toBe(false);
  });

  it("pins the 20-char articulation floor: exactly 20 passes, 19 fails", () => {
    expect(DialogueDecisionSchema.safeParse({ ...ok, userDiagnosis: "x".repeat(20) }).success).toBe(true);
    expect(DialogueDecisionSchema.safeParse({ ...ok, userDiagnosis: "x".repeat(19) }).success).toBe(false);
  });
});

describe("RippleTraceSchema — the diagnosis floor before an action is proposed", () => {
  const ok = { problemTitle: "T", diagnosis: "D".repeat(40), candidateAction: "A" };
  it("accepts a >=40-char diagnosis", () => {
    expect(RippleTraceSchema.safeParse(ok).success).toBe(true);
  });
  it("REJECTS a diagnosis under 40 chars — a candidate action needs a real diagnosis behind it", () => {
    expect(RippleTraceSchema.safeParse({ ...ok, diagnosis: "D".repeat(39) }).success).toBe(false);
  });
});
