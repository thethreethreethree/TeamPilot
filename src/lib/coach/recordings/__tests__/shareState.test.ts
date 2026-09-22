import { describe, it, expect } from "vitest";
import { shareState, type ShareEvent } from "../shareState";

/**
 * A recording played to the rest of the team is the rep's call, and this derivation is the only
 * thing that decides whether the button is live.
 *
 * What these tests pin is the set of ways a permission log can be read as a yes when it is not:
 *
 *   · a request counted as consent, so asking is granting
 *   · a revocation overwritten by a manager asking again
 *   · the newest row winning by insertion order rather than by time
 *   · a decline read as "not yet answered", which renders the same as never having asked
 */

const ev = (kind: ShareEvent["kind"], createdAt: string, over: Partial<ShareEvent> = {}): ShareEvent => ({
  kind,
  actorId: kind === "requested" ? "mgr" : "rep",
  createdAt,
  ...over,
});

describe("nothing has happened", () => {
  it("is not shareable and says so plainly", () => {
    expect(shareState([])).toEqual({
      shareable: false,
      status: "none",
      requestedAt: null,
      answeredAt: null,
      note: null,
    });
  });
});

describe("asking is not getting", () => {
  it("a request alone is pending, never shareable", () => {
    // The failure this guards: a manager presses the button, a row appears, and the clip plays.
    const s = shareState([ev("requested", "2026-09-20T10:00:00Z", { note: "Great rebuttal" })]);
    expect(s.shareable).toBe(false);
    expect(s.status).toBe("pending");
    expect(s.note).toBe("Great rebuttal");
  });

  it("two requests are still just pending", () => {
    const s = shareState([ev("requested", "2026-09-20T10:00:00Z"), ev("requested", "2026-09-21T10:00:00Z")]);
    expect(s.shareable).toBe(false);
    expect(s.requestedAt).toBe("2026-09-21T10:00:00Z");
  });
});

describe("the rep's answer", () => {
  it("a grant makes it shareable", () => {
    const s = shareState([ev("requested", "2026-09-20T10:00:00Z"), ev("granted", "2026-09-20T11:00:00Z")]);
    expect(s).toMatchObject({ shareable: true, status: "granted", answeredAt: "2026-09-20T11:00:00Z" });
  });

  it("a decline is a settled no, distinct from never having been asked", () => {
    // "declined" and "none" both render as a dark button; only one of them should offer to ask.
    const s = shareState([
      ev("requested", "2026-09-20T10:00:00Z"),
      ev("declined", "2026-09-20T11:00:00Z", { note: "Rather not, it was a rough one" }),
    ]);
    expect(s).toMatchObject({ shareable: false, status: "declined" });
    expect(s.note).toBe("Rather not, it was a rough one");
  });

  it("a revocation stops playback", () => {
    const s = shareState([
      ev("requested", "2026-09-20T10:00:00Z"),
      ev("granted", "2026-09-20T11:00:00Z"),
      ev("revoked", "2026-09-25T09:00:00Z"),
    ]);
    expect(s).toMatchObject({ shareable: false, status: "revoked" });
  });

  it("a grant after a decline is honoured — people change their minds", () => {
    const s = shareState([
      ev("declined", "2026-09-20T11:00:00Z"),
      ev("requested", "2026-09-21T09:00:00Z"),
      ev("granted", "2026-09-21T10:00:00Z"),
    ]);
    expect(s.shareable).toBe(true);
  });
});

describe("a manager cannot clear an answer by asking again", () => {
  it("a request after a revocation leaves the clip silent", () => {
    // The attack this closes is not malicious, it is ordinary: ask twice, see "pending", and read
    // pending as "the old no is gone". Playback must stay off until the rep answers the new ask.
    const s = shareState([
      ev("granted", "2026-09-20T11:00:00Z"),
      ev("revoked", "2026-09-25T09:00:00Z"),
      ev("requested", "2026-09-26T09:00:00Z"),
    ]);
    expect(s.shareable).toBe(false);
    expect(s.status).toBe("pending");
  });

  it("a request after a GRANT does not silence a clip that is already allowed", () => {
    // The mirror case. Asking again about a recording the rep already cleared must not revoke it.
    const s = shareState([
      ev("granted", "2026-09-20T11:00:00Z"),
      ev("requested", "2026-09-26T09:00:00Z"),
    ]);
    expect(s.shareable).toBe(true);
    expect(s.status).toBe("pending");
  });
});

describe("order comes from the clock, not the array", () => {
  it("replays out-of-order rows by created_at", () => {
    const s = shareState([
      ev("revoked", "2026-09-25T09:00:00Z"),
      ev("granted", "2026-09-20T11:00:00Z"),
    ]);
    expect(s.shareable).toBe(false);
  });

  it("resolves a request and an answer sharing a timestamp toward the answer", () => {
    // A request and an answer stamped in the same millisecond can only be a request being
    // answered. What makes that true is the STRICT `>` in askedSince, not a sort tie-break — a
    // tie-break was tried, survived its mutant, and was deleted as provably inert. This test
    // guards the behaviour; loosening `>` to `>=` makes it fail.
    const s = shareState([
      ev("granted", "2026-09-20T10:00:00Z"),
      ev("requested", "2026-09-20T10:00:00Z"),
    ]);
    expect(s.status).toBe("granted");
    expect(s.shareable).toBe(true);
  });
});
