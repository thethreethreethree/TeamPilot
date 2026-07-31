import { describe, it, expect } from "vitest";
import { mirrorChipText, type CoachCitation } from "../heuristics";

/**
 * mirrorChipText builds the Coach chip's user-facing text. It was the one untested
 * pure function in heuristics.ts (the detectors are covered elsewhere). It encodes a
 * THESIS property, not just copy: the Coach MIRRORS (A11 / §3.3 guide-don't-overtake) —
 * it surfaces an observation + an open question and lets the writer render the verdict,
 * and it frames recurrence as GROWTH ("that awareness IS the practice"), never as
 * SURVEILLANCE ("3 times in this thread"). These tests lock that behaviour so a future
 * copy edit can't silently (a) break the n=1 silence, (b) drift to surveillance framing,
 * or (c) drop a citation's text.
 */

const ALL_IDS: CoachCitation["id"][] = [
  "nvc-evaluation",
  "voss-bare-assertion",
  "stone-identity-collision",
  "coach-blame-projection",
  "coach-emotional-escalation",
  "coach-hot-state",
  "coach-aggressive-language",
];

describe("mirrorChipText — recurrence framing (growth, not surveillance)", () => {
  it("is SILENT on the first occurrence (n=1 → recurrenceFrame null)", () => {
    for (const id of ALL_IDS) {
      expect(mirrorChipText(id, 1).recurrenceFrame).toBeNull();
    }
  });

  it("names the recurrence on n>=2 (non-null) and frames it as practice/awareness, never surveillance", () => {
    for (const id of ALL_IDS) {
      const two = mirrorChipText(id, 2).recurrenceFrame;
      const many = mirrorChipText(id, 4).recurrenceFrame;
      expect(two).not.toBeNull();
      expect(many).not.toBeNull();
      // Growth-framing: n>=3 references the count AND the "awareness/practice" frame.
      expect(many).toMatch(/\b4\b/);
      expect(many!.toLowerCase()).toMatch(/practice|awareness|noticing/);
      // Surveillance-shaped phrasings the v4.0 redesign explicitly moved AWAY from.
      for (const frame of [two!, many!]) {
        expect(frame.toLowerCase()).not.toMatch(/times in this thread|flagged|violation|you keep/);
      }
    }
  });
});

describe("mirrorChipText — mirror discipline (observation + open question, per id)", () => {
  it("returns a distinct non-empty label + question for every citation id", () => {
    const labels = new Set<string>();
    for (const id of ALL_IDS) {
      const { label, question } = mirrorChipText(id, 1);
      expect(label.trim().length).toBeGreaterThan(0);
      expect(question.trim().length).toBeGreaterThan(0);
      labels.add(label);
    }
    // Each id has its own label (no accidental copy-paste collapse to one text).
    expect(labels.size).toBe(ALL_IDS.length);
  });

  it("keeps the question a QUESTION (invites the writer's verdict — A11), for both n=1 and n>=2", () => {
    for (const id of ALL_IDS) {
      expect(mirrorChipText(id, 1).question.trim()).toMatch(/\?$/);
      expect(mirrorChipText(id, 3).question.trim()).toMatch(/\?$/);
    }
  });

  it("uses a DIFFERENT question for the first occurrence vs a recurrence (the count changes the invitation, not a verdict)", () => {
    for (const id of ALL_IDS) {
      expect(mirrorChipText(id, 1).question).not.toBe(mirrorChipText(id, 2).question);
    }
  });

  it("labels are first-person 'I noticed…' mirror voice (v4.0), not clinical taxonomy", () => {
    // The v4.0 redesign moved from taxonomic labels ("Absolute / judgmental phrasing")
    // to first-person noticing. Lock that the label reads as the System noticing, not diagnosing.
    for (const id of ALL_IDS) {
      const label = mirrorChipText(id, 1).label.toLowerCase();
      expect(label).toMatch(/^i(?:'m| )|noticed|picking up/);
    }
  });
});
