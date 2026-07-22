import { describe, it, expect } from "vitest";
import { buildSalesMomentsSystemPrompt, buildSalesMomentsUserMessage } from "../salesMomentsPrompt";
import type { TranscriptSegment } from "@/lib/data/salesCoach";

/**
 * Sales "key moments" prompt. The model must reference moments by SEGMENT NUMBER [n], never a fabricated
 * timestamp (§3.4). So the transcript assembly must number every segment by its seq and label speakers as
 * REP/CUSTOMER. Pure module, was untested.
 */

const seg = (seq: number, speaker: string, text: string): TranscriptSegment =>
  ({ seq, speaker, text }) as unknown as TranscriptSegment;

describe("buildSalesMomentsUserMessage", () => {
  it("numbers each segment by its seq and labels REP/CUSTOMER (§3.4 — reference by [n], not time)", () => {
    const out = buildSalesMomentsUserMessage({
      segments: [seg(1, "agent", "morning!"), seg(2, "customer", "what's the price?")],
    });
    expect(out).toContain("[1] REP: morning!");
    expect(out).toContain("[2] CUSTOMER: what's the price?");
  });

  it("renders the context line (in-person vs online) and outcome when present", () => {
    const inPerson = buildSalesMomentsUserMessage({
      context: "in_person",
      outcome: "booked follow-up",
      segments: [seg(1, "agent", "hi")],
    });
    expect(inPerson).toContain("in-person, door-to-door");
    expect(inPerson).toContain("Outcome: booked follow-up");

    const online = buildSalesMomentsUserMessage({ context: "video", segments: [seg(1, "agent", "hi")] });
    expect(online).toContain("online video call");
  });

  it("omits the header entirely when there's no context or outcome", () => {
    const out = buildSalesMomentsUserMessage({ segments: [seg(1, "agent", "hi")] });
    expect(out).not.toContain("Context:");
    expect(out).not.toContain("Outcome:");
    expect(out.startsWith("TRANSCRIPT")).toBe(true);
  });
});

describe("buildSalesMomentsSystemPrompt", () => {
  it("returns a substantial prompt, and honors a corpus override", () => {
    expect(buildSalesMomentsSystemPrompt().length).toBeGreaterThan(100);
    expect(buildSalesMomentsSystemPrompt("CUSTOM-CORPUS-SENTINEL-7781")).toContain("CUSTOM-CORPUS-SENTINEL-7781");
  });
});
