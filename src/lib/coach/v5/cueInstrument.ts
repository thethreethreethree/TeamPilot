/**
 * Live-cue instrumentation (A2 — design backwards from the §4 readout; the
 * measurement is the first design constraint, not a follow-up). Every live cue
 * records an end-to-end latency breakdown + its relevance signals, so the
 * founder's live test yields a readout that PROVES or disproves the fluidity
 * gain (§3.5 — measure consequence, not "it felt fast"; §4/A4 — the latency↔
 * relevance thresholds are answered by this data, not pre-decided).
 *
 * Pure + dependency-free so the math is unit-testable; the hook supplies
 * performance.now() marks and logs formatCueMetric(trace).
 */

export type CueImportance = "low" | "medium" | "high";
export type CueMode = "in_person" | "video" | "unknown";

/** Perf marks along the real pipeline (all performance.now() ms). */
export type CueTrace = {
  /** the moment the cue decision point is reached (turn settled / prospect
   *  turn-end) — the clock the agent actually experiences delay against. */
  triggeredAt: number;
  /** when the cue LLM round-trip started (with parallelism this is ~triggeredAt;
   *  without it, ~triggeredAt + settle). */
  llmStartedAt?: number;
  /** when the cue LLM returned. */
  llmEndedAt?: number;
  /** when TTS playback of the cue began (i.e., the cue reached the ear). */
  deliveredAt?: number;
  importance?: CueImportance | null;
  phase?: string;
  trigger?: string;
  delivered: boolean;
  /** why a cue was NOT delivered (suppressed by the gate, out-ranked, cooldown,
   *  turn continued, error) — the relevance/robustness half of the readout. */
  suppressReason?: string;
  mode?: CueMode;
};

export type CueLatency = {
  /** triggeredAt → llmStartedAt: time spent before the LLM even began (settle,
   *  queueing). With parallelism this trends toward 0. */
  queueMs: number | null;
  /** llmStartedAt → llmEndedAt: the cue LLM round-trip (the dominant cost). */
  llmMs: number | null;
  /** llmEndedAt → deliveredAt: TTS + delivery. */
  ttsMs: number | null;
  /** triggeredAt → deliveredAt: the END-TO-END delay the agent experiences.
   *  This is the number "no delay" targets. Null until delivered. */
  totalMs: number | null;
};

function diff(a: number | undefined, b: number | undefined): number | null {
  if (typeof a !== "number" || typeof b !== "number") return null;
  const d = b - a;
  return d >= 0 ? Math.round(d) : null;
}

export function computeCueLatency(t: CueTrace): CueLatency {
  return {
    queueMs: diff(t.triggeredAt, t.llmStartedAt),
    llmMs: diff(t.llmStartedAt, t.llmEndedAt),
    ttsMs: diff(t.llmEndedAt, t.deliveredAt),
    totalMs: diff(t.triggeredAt, t.deliveredAt),
  };
}

/** One-line readout for the console during a live test. Deterministic + pure so
 *  the founder (and a test) can rely on its shape. */
export function formatCueMetric(t: CueTrace): string {
  const l = computeCueLatency(t);
  const ms = (n: number | null) => (n === null ? "—" : `${n}ms`);
  const head = t.delivered
    ? `DELIVERED total=${ms(l.totalMs)}`
    : `suppressed(${t.suppressReason ?? "unknown"})`;
  return (
    `[cue-metric] ${head} ` +
    `queue=${ms(l.queueMs)} llm=${ms(l.llmMs)} tts=${ms(l.ttsMs)} ` +
    `importance=${t.importance ?? "—"} phase=${t.phase ?? "—"} ` +
    `trigger=${t.trigger ?? "—"} mode=${t.mode ?? "unknown"}`
  );
}

/**
 * Rolling session summary — the readout that answers "is it fluid?" across a
 * call: median end-to-end latency + delivery/suppression counts. Pure over an
 * array of finished traces.
 */
export function summarizeCues(traces: ReadonlyArray<CueTrace>): {
  delivered: number;
  suppressed: number;
  medianTotalMs: number | null;
  p90TotalMs: number | null;
} {
  const totals = traces
    .map((t) => computeCueLatency(t).totalMs)
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  const pct = (p: number): number | null => {
    if (totals.length === 0) return null;
    const idx = Math.min(totals.length - 1, Math.floor(p * totals.length));
    return totals[idx]!;
  };
  return {
    delivered: traces.filter((t) => t.delivered).length,
    suppressed: traces.filter((t) => !t.delivered).length,
    medianTotalMs: pct(0.5),
    p90TotalMs: pct(0.9),
  };
}
