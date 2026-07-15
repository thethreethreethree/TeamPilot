import { describe, it, expect } from "vitest";
import { deriveNotifyRecipients } from "../recipients";

/**
 * Pins the 2026-07-16 push-delivery fix: recipients are engaged users (sent a
 * message OR active participant) minus the sender. THE regression this guards:
 * a participant who hasn't sent a message must still be notified — reverting to
 * authors-only would drop them (the "added someone, messaged them, they got
 * nothing" bug).
 */
describe("deriveNotifyRecipients", () => {
  it("THE FIX: includes a participant who has NOT sent a message", () => {
    const r = deriveNotifyRecipients({
      authorIds: ["sender"], // only the sender has posted
      participantIds: ["sender", "added-but-silent"], // B was added, never posted
      senderId: "sender",
    });
    expect(r).toEqual(["added-but-silent"]); // B is notified, sender is not
  });

  it("never notifies the sender of their own message", () => {
    const r = deriveNotifyRecipients({
      authorIds: ["sender", "a"],
      participantIds: ["sender", "a", "b"],
      senderId: "sender",
    });
    expect(r).not.toContain("sender");
    expect(new Set(r)).toEqual(new Set(["a", "b"]));
  });

  it("dedups across authors and participants", () => {
    const r = deriveNotifyRecipients({
      authorIds: ["a", "a", "b"],
      participantIds: ["a", "b", "c"],
      senderId: "z",
    });
    expect(r.sort()).toEqual(["a", "b", "c"]);
  });

  it("drops null/undefined ids without crashing", () => {
    const r = deriveNotifyRecipients({
      authorIds: [null, "a", undefined],
      participantIds: [undefined, "b", null],
      senderId: "z",
    });
    expect(r.sort()).toEqual(["a", "b"]);
  });

  it("returns empty when the only engaged user is the sender", () => {
    expect(
      deriveNotifyRecipients({ authorIds: ["sender"], participantIds: ["sender"], senderId: "sender" })
    ).toEqual([]);
  });
});
