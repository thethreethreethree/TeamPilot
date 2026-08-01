import { describe, it, expect } from "vitest";
import { coerceJsonText } from "../coerceJson";

/**
 * coerceJsonText makes the Anthropic failover path (no response_format=json_object) as robust as the
 * DeepSeek primary for expectJson calls. The load-bearing guarantees: (1) bare JSON is a passthrough
 * (DeepSeek unaffected); (2) a fenced / prose-wrapped reply is extracted so downstream JSON.parse works;
 * (3) genuinely-unparseable text is never turned into a passing parse — it degrades exactly as today.
 */
describe("coerceJsonText", () => {
  it("passes bare JSON through unchanged (DeepSeek json_object path — must not alter it)", () => {
    const bare = '{"outcomes":[{"index":0,"determination":"followed"}]}';
    expect(coerceJsonText(bare)).toBe(bare);
    // Round-trips to the same object.
    expect(JSON.parse(coerceJsonText(bare))).toEqual(JSON.parse(bare));
  });

  it("trims surrounding whitespace but keeps the JSON parseable", () => {
    expect(JSON.parse(coerceJsonText('  \n {"a":1}\n '))).toEqual({ a: 1 });
  });

  it("strips a ```json fence (the common Anthropic wrap)", () => {
    const fenced = '```json\n{"a":1,"b":[2,3]}\n```';
    expect(JSON.parse(coerceJsonText(fenced))).toEqual({ a: 1, b: [2, 3] });
  });

  it("strips a bare ``` fence with no language tag", () => {
    expect(JSON.parse(coerceJsonText('```\n{"a":1}\n```'))).toEqual({ a: 1 });
  });

  it("extracts JSON from a prose preamble/suffix (no fence)", () => {
    const prosey = 'Here is the analysis you asked for:\n{"score":7,"note":"ok"}\nHope that helps!';
    expect(JSON.parse(coerceJsonText(prosey))).toEqual({ score: 7, note: "ok" });
  });

  it("handles a top-level ARRAY response", () => {
    expect(JSON.parse(coerceJsonText('```json\n[{"x":1},{"x":2}]\n```'))).toEqual([{ x: 1 }, { x: 2 }]);
  });

  it("does NOT invent JSON from unparseable text — returns something that still fails downstream (never worse)", () => {
    // A pure-prose reply has no JSON; the result must NOT be parseable (so the caller's try/catch degrades
    // exactly as it does today — this helper only ever helps, never masks a genuine miss).
    const out = coerceJsonText("I could not complete that request.");
    expect(() => JSON.parse(out)).toThrow();
  });

  it("leaves a truncated/malformed object unparseable (does not silently 'fix' it)", () => {
    const out = coerceJsonText('{"a":1, "b":'); // cut off mid-value
    expect(() => JSON.parse(out)).toThrow();
  });

  it("is a no-op-shaped passthrough for a non-string (defensive)", () => {
    expect(coerceJsonText(undefined as unknown as string)).toBe(undefined);
  });
});
