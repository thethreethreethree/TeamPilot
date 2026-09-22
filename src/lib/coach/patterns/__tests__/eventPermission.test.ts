import { describe, it, expect } from "vitest";
import { canAppend, isNote, PATTERN_EVENT_KINDS, BODY_REQUIRED } from "../eventPermission";

/**
 * Who may write what into the coaching log.
 *
 * `pattern_events` has no RLS insert policy, so this table IS the access rule — there is no
 * database behind it to catch a mistake. What these tests pin is each thing the split protects:
 *
 *   · a rep marking their own pattern coached, which makes the Stalled rule unfalsifiable
 *   · a rep closing their own pattern, which is the streak rule bypassed
 *   · a manager ticking "rep reviewed" on someone's behalf, which is A10 inverted
 *   · a refusal that tells the caller whose pattern it was
 */

const MANAGER = { isManager: true, ownsPattern: false };
const REP = { isManager: false, ownsPattern: true };
const STRANGER = { isManager: false, ownsPattern: false };

describe("what a manager may record", () => {
  it.each(["coached", "drill_assigned", "note", "fixed"])("allows %s", (kind) => {
    expect(canAppend(kind, MANAGER)).toEqual({ allowed: true, kind });
  });

  it("does NOT let a manager acknowledge on the rep's behalf", () => {
    // The Ⓡ marker and "Rep reviewed 2/2" exist to record that the REP saw it. A manager who can
    // tick it turns the tile into a record of their own opinion (A10 inverted).
    expect(canAppend("rep_reviewed", MANAGER).allowed).toBe(false);
  });

  it("does not let a manager dispute a clip on the rep's behalf either", () => {
    expect(canAppend("clip_disputed", MANAGER).allowed).toBe(false);
  });
});

describe("what a rep may record on their own pattern", () => {
  it.each(["rep_reviewed", "note", "clip_disputed"])("allows %s", (kind) => {
    expect(canAppend(kind, REP)).toEqual({ allowed: true, kind });
  });

  it("does NOT let a rep mark their own pattern coached", () => {
    // "Coached 7+ days ago with no change" is a claim that a human intervened. A rep who can
    // assert the intervention can clear their own Stalled status by saying so.
    expect(canAppend("coached", REP).allowed).toBe(false);
  });

  it("does NOT let a rep assign themselves a drill", () => {
    expect(canAppend("drill_assigned", REP).allowed).toBe(false);
  });

  it("does NOT let a rep close their own pattern", () => {
    // The streak rule exists so a pattern closes on evidence rather than on assertion.
    expect(canAppend("fixed", REP).allowed).toBe(false);
  });
});

describe("a manager on their OWN pattern", () => {
  const BOTH = { isManager: true, ownsPattern: true };

  it("may acknowledge it, because they are the rep here", () => {
    // Managers run pitches in this product and are ranked beside their reps. Denying this would
    // leave a manager the only person who cannot answer their own coaching.
    expect(canAppend("rep_reviewed", BOTH).allowed).toBe(true);
  });

  it("still gets the manager actions too", () => {
    expect(canAppend("coached", BOTH).allowed).toBe(true);
  });
});

describe("somebody else's pattern", () => {
  it("refuses every kind to a rep who does not own it", () => {
    for (const kind of PATTERN_EVENT_KINDS) {
      expect(canAppend(kind, STRANGER).allowed).toBe(false);
    }
  });

  it("gives ONE refusal message, so a refusal cannot be read as an answer", () => {
    // Two messages would let a rep tell "this pattern is not mine" from "this pattern does not
    // exist" — the 404-vs-403 leak, one layer up.
    const a = canAppend("note", STRANGER);
    const b = canAppend("coached", STRANGER);
    expect(a).toEqual(b);
    expect(a.allowed === false && a.reason).toBe("That is not yours to record.");
  });
});

describe("an unknown kind", () => {
  it("is refused rather than passed to a CHECK constraint", () => {
    // 0258's CHECK would reject it with a 500 after the route had decided it was fine. Same list,
    // enforced early, so the caller gets a sentence instead of a database error.
    expect(canAppend("promoted", MANAGER)).toEqual({ allowed: false, reason: "Unknown action." });
  });

  it("covers exactly the six kinds the migration accepts", () => {
    expect([...PATTERN_EVENT_KINDS].sort()).toEqual(
      ["clip_disputed", "coached", "drill_assigned", "fixed", "note", "rep_reviewed"].sort()
    );
  });
});

describe("what counts as a coaching note", () => {
  it("is the presence of a body, not the kind", () => {
    // "Mark as coached" carrying an instruction is one row that is both a Ⓒ marker and a note.
    expect(isNote({ body: "Say the opener out loud 10 times." })).toBe(true);
    expect(isNote({ body: null })).toBe(false);
  });

  it("treats whitespace as no body", () => {
    expect(isNote({ body: "   \n " })).toBe(false);
  });

  it("names the kinds that are meaningless without words", () => {
    expect(BODY_REQUIRED.has("note")).toBe(true);
    expect(BODY_REQUIRED.has("clip_disputed")).toBe(true);
    // Coaching happened whether or not the manager typed anything about it.
    expect(BODY_REQUIRED.has("coached")).toBe(false);
  });
});
