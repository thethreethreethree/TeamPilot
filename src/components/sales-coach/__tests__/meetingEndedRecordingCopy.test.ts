import { describe, it, expect } from "vitest";
import { meetingEndedRecordingCopy } from "../MeetingCoachingPanel";

/**
 * Audit M4: the post-meeting screen must never promise a review over a recording that didn't save. This locks the
 * three honest states so the copy can't silently regress to the old unconditional "the recording is saving now".
 */
describe("meetingEndedRecordingCopy — honest post-meeting recording state (audit M4)", () => {
  it("false (nothing saved) → a WARN that the review may be unavailable, never a promise", () => {
    const c = meetingEndedRecordingCopy(false);
    expect(c.tone).toBe("warn");
    expect(c.text).toMatch(/may be unavailable/i);
    expect(c.text).not.toMatch(/will be ready|is ready/i); // no false promise
  });

  it("true (durable) → an info that the review is ready", () => {
    const c = meetingEndedRecordingCopy(true);
    expect(c.tone).toBe("info");
    expect(c.text).toMatch(/saved/i);
    expect(c.text).toMatch(/is ready/i);
  });

  it("null (still uploading) → honest optimism (saving now)", () => {
    const c = meetingEndedRecordingCopy(null);
    expect(c.tone).toBe("info");
    expect(c.text).toMatch(/saving now/i);
  });
});
