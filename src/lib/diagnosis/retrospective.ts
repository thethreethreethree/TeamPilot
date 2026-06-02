/**
 * Retrospective Identification (CLAUDE.md §1.2).
 *
 * "Identify problems by looking backward at the actual record of what happened —
 *  logs, prior commits, past failures, event history — not by theorizing forward."
 *
 * This module takes the raw event + signal record and finds *patterns* across it —
 * not single observations, patterns. A pattern requires:
 *   - the same kind appearing on multiple sources, OR
 *   - the same subject experiencing multiple kinds of friction over time
 *
 * Single observations are anecdotes (§3.2). They do not surface as patterns.
 */

import type {
  EventRef,
  RetrospectivePattern,
  SignalRef,
} from "./types";

type DerivePatternsArgs = {
  signals: SignalRef[];
  events: EventRef[];
  /** Minimum count for a candidate pattern to be returned. Mirrors the Gate's
   *  default `min_signals=3` so retrospective output is gate-compatible. */
  minOccurrences?: number;
};

export function deriveRetrospectivePatterns(
  args: DerivePatternsArgs
): RetrospectivePattern[] {
  const minOccurrences = args.minOccurrences ?? 3;
  const groups = new Map<string, SignalRef[]>();

  // Group signals by kind. Same kind across multiple sources is the simplest
  // pattern shape: "this keeps happening, across different things".
  for (const s of args.signals) {
    const arr = groups.get(s.kind) ?? [];
    arr.push(s);
    groups.set(s.kind, arr);
  }

  const patterns: RetrospectivePattern[] = [];

  for (const [kind, sigs] of groups) {
    if (sigs.length < minOccurrences) continue;
    const sources = new Set(sigs.map((s) => s.source));
    const sorted = [...sigs].sort(
      (a, b) =>
        new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;
    patterns.push({
      description: `Repeated "${kind}" — ${sigs.length} occurrences across ${sources.size} distinct source${
        sources.size === 1 ? "" : "s"
      }.`,
      recurringSubjects: [...sources],
      signalIds: sigs.map((s) => s.id),
      earliestObserved: first.observed_at,
      latestObserved: last.observed_at,
      occurrences: sigs.length,
      distinctSources: [...sources],
    });
  }

  // Second shape: same subject experiencing multiple distinct kinds of friction.
  const bySubject = new Map<string, SignalRef[]>();
  for (const s of args.signals) {
    const arr = bySubject.get(s.source) ?? [];
    arr.push(s);
    bySubject.set(s.source, arr);
  }

  for (const [subject, sigs] of bySubject) {
    const kinds = new Set(sigs.map((s) => s.kind));
    if (sigs.length < minOccurrences || kinds.size < 2) continue;
    const sorted = [...sigs].sort(
      (a, b) =>
        new Date(a.observed_at).getTime() - new Date(b.observed_at).getTime()
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) continue;
    patterns.push({
      description: `Subject ${subject} has accumulated ${sigs.length} signals across ${kinds.size} distinct kinds — sustained friction, not one bad event.`,
      recurringSubjects: [subject],
      signalIds: sigs.map((s) => s.id),
      earliestObserved: first.observed_at,
      latestObserved: last.observed_at,
      occurrences: sigs.length,
      distinctSources: [subject],
    });
  }

  // Sort patterns by latest activity — most recent friction first, but only after
  // it has accumulated enough occurrences to count as a pattern. (Recency-first
  // for the same count.)
  patterns.sort((a, b) =>
    a.latestObserved < b.latestObserved ? 1 : -1
  );

  return patterns;
}
