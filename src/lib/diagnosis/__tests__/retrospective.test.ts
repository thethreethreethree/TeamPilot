import { describe, expect, it } from "vitest";
import { deriveRetrospectivePatterns } from "../retrospective";
import type { SignalRef } from "../types";

function signal(
  id: string,
  kind: string,
  source: string,
  observed_at: string
): SignalRef {
  return { id, kind, source, observed_at };
}

describe("deriveRetrospectivePatterns", () => {
  it("returns an empty patterns array when there are no signals", () => {
    const out = deriveRetrospectivePatterns({ signals: [], events: [] });
    expect(out).toEqual([]);
  });

  it("produces no pattern when fewer than minOccurrences signals share a kind", () => {
    const signals: SignalRef[] = [
      signal("s1", "missed_deadline", "task:a", "2026-01-01T00:00:00Z"),
      signal("s2", "missed_deadline", "task:b", "2026-01-02T00:00:00Z"),
    ];
    // Default minOccurrences = 3
    const out = deriveRetrospectivePatterns({ signals, events: [] });
    expect(out).toEqual([]);
  });

  it("produces a pattern when 3+ signals of same kind span 2+ distinct sources, with correct earliest/latestObserved", () => {
    const signals: SignalRef[] = [
      signal("s1", "missed_deadline", "task:a", "2026-01-03T00:00:00Z"),
      signal("s2", "missed_deadline", "task:b", "2026-01-01T00:00:00Z"),
      signal("s3", "missed_deadline", "task:c", "2026-01-05T00:00:00Z"),
    ];
    const out = deriveRetrospectivePatterns({ signals, events: [] });
    // There should be exactly one kind-pattern. (No subject-pattern, since
    // each subject only has one signal of a single kind.)
    expect(out).toHaveLength(1);
    const p = out[0]!;
    expect(p.occurrences).toBe(3);
    expect(p.distinctSources.sort()).toEqual(["task:a", "task:b", "task:c"]);
    expect(p.earliestObserved).toBe("2026-01-01T00:00:00Z");
    expect(p.latestObserved).toBe("2026-01-05T00:00:00Z");
    expect(p.description).toContain("missed_deadline");
  });

  it("produces a 'sustained friction' subject pattern when one subject has 2+ kinds and 3+ signals", () => {
    // Same source 'task:hot' accumulates 3 signals across 2 distinct kinds.
    const signals: SignalRef[] = [
      signal("s1", "missed_deadline", "task:hot", "2026-01-01T00:00:00Z"),
      signal("s2", "blocked", "task:hot", "2026-01-02T00:00:00Z"),
      signal("s3", "blocked", "task:hot", "2026-01-03T00:00:00Z"),
    ];
    const out = deriveRetrospectivePatterns({ signals, events: [] });
    // There should be at least one subject-shape pattern referring to task:hot.
    const subjectPattern = out.find((p) =>
      p.description.includes("sustained friction")
    );
    expect(subjectPattern).toBeDefined();
    expect(subjectPattern!.recurringSubjects).toEqual(["task:hot"]);
    expect(subjectPattern!.occurrences).toBe(3);
    expect(subjectPattern!.earliestObserved).toBe("2026-01-01T00:00:00Z");
    expect(subjectPattern!.latestObserved).toBe("2026-01-03T00:00:00Z");
  });

  it("respects the minOccurrences override parameter", () => {
    // With only 2 signals, default min=3 would yield no pattern. With override
    // min=2, the kind-grouping should produce one.
    const signals: SignalRef[] = [
      signal("s1", "context_switch", "person:a", "2026-01-01T00:00:00Z"),
      signal("s2", "context_switch", "person:b", "2026-01-02T00:00:00Z"),
    ];
    const noOverride = deriveRetrospectivePatterns({ signals, events: [] });
    expect(noOverride).toEqual([]);

    const withOverride = deriveRetrospectivePatterns({
      signals,
      events: [],
      minOccurrences: 2,
    });
    expect(withOverride.length).toBeGreaterThanOrEqual(1);
    expect(withOverride[0]!.occurrences).toBe(2);
  });
});
