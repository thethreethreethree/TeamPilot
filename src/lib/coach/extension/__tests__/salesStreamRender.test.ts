import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Behavioral test for the two pure streaming-render helpers SHIPPED in extension-sales/content.js —
 * `replyBeforeMarker` (show everything before the ===REASONING=== marker as the forming reply, hiding a
 * PARTIAL marker mid-stream so the rep never sees "===REAS") and `stripDashesLive` (clean AI-tell dashes in
 * the live view). content.js is a browser IIFE (no export), so we EXTRACT the shipped functions from source
 * and eval them — the test then exercises the real code, not a copy. Detection-true: breaking the partial-
 * marker hiding, or widening the dash strip to single hyphens, fails a case below.
 */

const CONTENT = readFileSync(join(process.cwd(), "extension-sales", "content.js"), "utf-8");

function load(): {
  replyBeforeMarker: (t: string) => string;
  stripDashesLive: (t: string) => string;
} {
  const marker = CONTENT.match(/const REASONING_MARKER = "([^"]+)";/);
  const reply = CONTENT.match(/function replyBeforeMarker\(text\) \{[\s\S]*?\n {2}\}/);
  const strip = CONTENT.match(/function stripDashesLive\(text\) \{[\s\S]*?\n {2}\}/);
  if (!marker || !reply || !strip) throw new Error("could not extract the streaming-render helpers from content.js");
  const src = `const REASONING_MARKER = "${marker[1]}";\n${reply[0]}\n${strip[0]}\nreturn { replyBeforeMarker, stripDashesLive };`;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  return new Function(src)() as ReturnType<typeof load>;
}

describe("content.js streaming render — replyBeforeMarker (partial-marker hiding)", () => {
  const { replyBeforeMarker } = load();

  it("returns the reply before a COMPLETE marker (trailing whitespace trimmed)", () => {
    expect(replyBeforeMarker("All good, hope you're well. ===REASONING=== warm open")).toBe(
      "All good, hope you're well."
    );
  });

  it("HIDES a partial marker forming at the end (rep never sees '===REAS')", () => {
    expect(replyBeforeMarker("All good, hope you're well. ===REAS")).toBe("All good, hope you're well. ");
    expect(replyBeforeMarker("Draft so far ===")).toBe("Draft so far ");
  });

  it("returns the whole text when no marker (or partial) is present", () => {
    expect(replyBeforeMarker("Just a normal drafted reply, still streaming")).toBe(
      "Just a normal drafted reply, still streaming"
    );
  });
});

describe("content.js streaming render — stripDashesLive", () => {
  const { stripDashesLive } = load();

  it("replaces em/en and double dashes with a comma in the live view", () => {
    expect(stripDashesLive("Happy to help — what's next?")).toBe("Happy to help, what's next?");
    expect(stripDashesLive("Wait -- one more thing")).toBe("Wait, one more thing");
  });

  it("leaves a normal single hyphen alone (day-to-day, ranges)", () => {
    expect(stripDashesLive("Our day-to-day is 9-5")).toBe("Our day-to-day is 9-5");
  });
});

describe("content.js streaming render — C.A.R.E twin shares the same partial-marker logic (coverage covers both)", () => {
  it("replyBeforeMarkerCare (C.A.R.E) is logic-identical to replyBeforeMarker (Sales)", () => {
    // C.A.R.E's co-pilot stream renders with replyBeforeMarkerCare; it must hide a partial marker the same way,
    // so the behavioral cases above cover both. Detection-true: a change to one not mirrored to the other fails.
    const care = readFileSync(join(process.cwd(), "extension", "content.js"), "utf-8");
    const salesFn = CONTENT.match(/function replyBeforeMarker\(text\) \{[\s\S]*?\n {2}\}/)?.[0] ?? "";
    const careFn = care.match(/function replyBeforeMarkerCare\(text\) \{[\s\S]*?\n {2}\}/)?.[0] ?? "";
    const norm = (s: string, name: string) =>
      s.replace(new RegExp(name, "g"), "X").replace(/_CARE\b/g, "").replace(/\/\/[^\n]*/g, "").replace(/\s+/g, " ").trim();
    expect(salesFn).not.toBe("");
    expect(careFn).not.toBe("");
    expect(norm(careFn, "replyBeforeMarkerCare")).toBe(norm(salesFn, "replyBeforeMarker"));
  });
});
