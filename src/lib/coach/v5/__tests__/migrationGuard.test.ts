import { describe, it, expect } from "vitest";
import { isMissingColumnError, isMissingRelationError } from "../migrationGuard";

/**
 * These tests pin the fallback/fail-loud boundary. The guard exists to keep a pending migration from taking a
 * feature down; it must never widen into "swallow errors that look vaguely schema-ish" (§3.4).
 */
describe("isMissingColumnError", () => {
  const COL = "recording_saved";

  // NOTE on these two test NAMES (corrected 2026-07-17): they used to assert what Postgres/PostgREST *return*.
  // That is a claim about an external system I have not verified here (see the ⚠️ in migrationGuard.ts). What
  // these tests actually pin is what THIS PREDICATE does with each error SHAPE — which is the part that is mine
  // to guarantee, and the part a future reader needs. The shapes are recollected; the behaviour is tested.
  it("fires on an undefined-column SHAPE carrying pg's 42703", () => {
    expect(
      isMissingColumnError(
        { code: "42703", message: 'column coaching_sessions.recording_saved does not exist' },
        COL
      )
    ).toBe(true);
  });

  it("fires on a schema-cache SHAPE carrying PGRST204", () => {
    expect(
      isMissingColumnError(
        {
          code: "PGRST204",
          message: "Could not find the 'recording_saved' column of 'coaching_sessions' in the schema cache",
        },
        COL
      )
    ).toBe(true);
  });

  it("fires when the code is absent but the message is canonical", () => {
    expect(isMissingColumnError({ message: "column recording_saved does not exist" }, COL)).toBe(true);
  });

  // The important one: the guard must not mask a DIFFERENT column being missing — that's a real defect.
  it("does NOT fire when 42703 names a different column", () => {
    expect(
      isMissingColumnError({ code: "42703", message: 'column coaching_sessions.agent_id does not exist' }, COL)
    ).toBe(false);
  });

  it("does NOT fire on unrelated errors — they must stay loud", () => {
    expect(isMissingColumnError({ code: "42501", message: "permission denied for table coaching_sessions" }, COL)).toBe(false);
    expect(isMissingColumnError({ code: "PGRST301", message: "JWT expired" }, COL)).toBe(false);
    expect(isMissingColumnError({ code: "57014", message: "canceling statement due to statement timeout" }, COL)).toBe(false);
  });

  it("does NOT fire when the column is merely mentioned in an unrelated failure", () => {
    // Names the column, but nothing about it is missing — a constraint violation must not degrade to a fallback.
    expect(
      isMissingColumnError(
        { code: "23514", message: 'new row violates check constraint on recording_saved' },
        COL
      )
    ).toBe(false);
  });

  it("handles null/empty inputs without throwing", () => {
    expect(isMissingColumnError(null, COL)).toBe(false);
    expect(isMissingColumnError(undefined, COL)).toBe(false);
    expect(isMissingColumnError({}, COL)).toBe(false);
    expect(isMissingColumnError({ code: "42703", message: null }, COL)).toBe(false);
    expect(isMissingColumnError({ code: "42703", message: "column x does not exist" }, "")).toBe(false);
  });
});

describe("isMissingRelationError", () => {
  it("fires on an undefined-table SHAPE carrying pg's 42P01", () => {
    expect(
      isMissingRelationError({ code: "42P01", message: 'relation "care_live_visitors" does not exist' }),
    ).toBe(true);
  });

  it("fires on the canonical phrasing even without a code (code path may be absent)", () => {
    expect(isMissingRelationError({ message: 'relation "x" does not exist' })).toBe(true);
    expect(isMissingRelationError({ message: "Could not find the table 'public.x' in the schema cache" })).toBe(true);
  });

  it("STAYS LOUD (false) for a genuine error — must never masquerade as a pending migration", () => {
    expect(isMissingRelationError({ code: "42501", message: "permission denied for table x" })).toBe(false);
    expect(isMissingRelationError({ code: "23505", message: "duplicate key value violates unique constraint" })).toBe(false);
    expect(isMissingRelationError({ code: "500", message: "internal error" })).toBe(false);
  });

  it("false on null/undefined/empty error", () => {
    expect(isMissingRelationError(null)).toBe(false);
    expect(isMissingRelationError(undefined)).toBe(false);
    expect(isMissingRelationError({})).toBe(false);
  });

  it("when a relation name is required, only fires if the message names it", () => {
    expect(isMissingRelationError({ code: "42P01", message: 'relation "visitors" does not exist' }, "visitors")).toBe(true);
    expect(isMissingRelationError({ code: "42P01", message: 'relation "other" does not exist' }, "visitors")).toBe(false);
  });
});
