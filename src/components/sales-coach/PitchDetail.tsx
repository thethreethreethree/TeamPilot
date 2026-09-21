"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Play, Flag, MessageSquare, Clock } from "lucide-react";
import { BONUSES_BY_ID, VIOLATIONS_BY_ID, type SectionId } from "@/lib/coach/pitchScore/rubric";
import type { StoredPitch, PitchElementRow } from "@/lib/coach/pitchScore/readPitchScore";

/**
 * Pitch detail — one scored pitch, with the evidence behind every point.
 *
 * Built to page 3 of the rep dashboard boards, which I opened and read: a score card, base by
 * section, an expandable per-section element list (grade badge, what the AI heard, the moment in
 * the recording, the points), bonuses earned, violations, and Dispute at the foot. The caption on
 * that page states the rule this component follows — *"Every section opens to this view: grade,
 * what the AI heard, and the moment in the recording."*
 *
 * THE DESIGN IS THE DELIVERABLE, NOT POLISH (§1.5.4). The founder specified the grade colouring,
 * and a grade a rep reads at a glance is information, not decoration. So HIT/PARTIAL/MISSED carry
 * colour — but colour is never the ONLY channel: every badge also says the word, because a
 * red/green distinction is invisible to roughly one man in twelve and the grade is the point of
 * the row.
 *
 * WHY EVERY NUMBER HERE IS READ, NEVER COMPUTED. Section totals come from `pitch.sectionPoints`,
 * the scorer's stored verdict. Summing the element rows instead is the obvious implementation and
 * it is wrong on every objection-free pitch, where Delivery was scored out of 27 and scaled to 35
 * — the screen would contradict the score printed at the top of itself. Migration 0254 exists to
 * make that impossible; re-deriving here would undo it.
 */

const GRADE_STYLE: Record<PitchElementRow["grade"], { label: string; cls: string }> = {
  // Saturated, not pale: pale tints (text-*-100/200) read on dark and vanish on light, which is
  // the leak the theme audit exists to catch.
  hit: { label: "HIT", cls: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 border-emerald-600/40" },
  partial: { label: "PARTIAL", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40" },
  missed: { label: "MISSED", cls: "bg-zinc-500/10 text-muted border-default" },
};

/** m:ss for a play target. Matches how the prompt hands timestamps to the model. */
function mmss(totalSeconds: number): string {
  return `${Math.floor(totalSeconds / 60)}:${String(Math.floor(totalSeconds % 60)).padStart(2, "0")}`;
}

function PlayChip({
  timestampS,
  onSeek,
}: {
  timestampS: number | null;
  onSeek?: (seconds: number) => void;
}) {
  // No timestamp, no chip. An invented one sends the rep to the wrong moment and makes the
  // evidence read as a lie — generatePitchScore refuses to estimate for the same reason.
  if (timestampS == null) return null;
  const label = mmss(timestampS);
  if (!onSeek) {
    // Nothing can play it (no audio on this pitch). Show WHEN it happened without pretending to
    // be a button — a control that does nothing is worse than a plain fact.
    return <span className="text-[11px] tabular-nums text-muted px-2 py-1">{label}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => onSeek(timestampS)}
      aria-label={`Play from ${label}`}
      className="shrink-0 inline-flex items-center gap-1 rounded-full border border-brand/50 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-brand hover:bg-brand/10"
    >
      <Play className="w-3 h-3" aria-hidden />
      {label}
    </button>
  );
}

export function PitchDetail({
  pitch,
  onSeek,
  onDispute,
}: {
  pitch: StoredPitch;
  /** Provided only when the recording can actually be played. */
  onSeek?: (seconds: number) => void;
  /** Provided only when the dispute route is reachable for this viewer. */
  onDispute?: (item: { itemId?: string; timestampS?: number }) => void;
}) {
  const [openSection, setOpenSection] = useState<SectionId | null>(null);

  const bySection = useMemo(() => {
    const map = new Map<SectionId, PitchElementRow[]>();
    for (const e of pitch.elements) {
      if (!e.section) continue;
      const list = map.get(e.section) ?? [];
      list.push(e);
      map.set(e.section, list);
    }
    return map;
  }, [pitch.elements]);

  // An element whose id the current rubric no longer knows. Kept and shown, because its points
  // are inside `base` and hiding the row leaves points on screen that nothing accounts for.
  const retired = pitch.elements.filter((e) => !e.section);

  const bonuses = pitch.events.filter((e) => e.type === "bonus");
  const violations = pitch.events.filter((e) => e.type === "violation");
  const rejected = pitch.events.filter((e) => e.type === "rejected_bonus");

  return (
    <div className="space-y-5">
      {/* ── Score ─────────────────────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-default bg-surface p-5">
        <p className="text-[10px] uppercase tracking-widest text-muted">Pitch score</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <p className="text-5xl font-bold text-brand tabular-nums">{pitch.total}</p>
          {pitch.band && (
            <span className="rounded-full border border-brand/50 px-3 py-1 text-xs font-semibold text-brand">
              {pitch.band}
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Base" value={`${pitch.base}`} />
          <Stat label="Bonus" value={`+${pitch.bonus}`} tone="up" />
          <Stat label="Violations" value={pitch.violations ? `−${pitch.violations}` : "0"} tone={pitch.violations ? "down" : undefined} />
        </div>

        {/*
          The qualifying verdict, consumed rather than re-derived. Storing the REASON was made
          impossible to skip by a CHECK constraint in 0252, precisely so this line can never be a
          bare "Not counted" that leaves a rep guessing why their pitch did not count.
        */}
        <p className={`mt-4 text-[11px] ${pitch.qualifying ? "text-muted" : "text-amber-700 dark:text-amber-400"}`}>
          {pitch.qualifying ? "Counted toward the leaderboard" : `Not counted — ${pitch.notQualifyingReason}`}
        </p>
      </section>

      {/* ── Base by section ───────────────────────────────────────────────────────────── */}
      <section>
        <h3 className="text-[10px] uppercase tracking-widest text-muted mb-2">Base by section</h3>

        {pitch.sectionPoints.length === 0 ? (
          // Scored before 0254, so no stored section verdict. Saying so beats summing the element
          // rows, which would disagree with the score above on any objection-free pitch.
          <p className="rounded-xl border border-default bg-surface p-4 text-[11px] text-muted">
            This pitch was scored before section totals were recorded. The element grades below are
            complete; only the per-section breakdown is unavailable. Re-score it to fill this in.
          </p>
        ) : (
          <div className="rounded-xl border border-default bg-surface divide-y divide-default overflow-hidden">
            {pitch.sectionPoints.map((section) => {
              const elements = bySection.get(section.id) ?? [];
              const isOpen = openSection === section.id;
              return (
                <div key={section.id}>
                  <button
                    type="button"
                    onClick={() => setOpenSection(isOpen ? null : section.id)}
                    aria-expanded={isOpen}
                    disabled={elements.length === 0}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left disabled:opacity-60"
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {elements.length > 0 &&
                        (isOpen ? (
                          <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden />
                        ))}
                      <span className="text-sm font-medium text-primary truncate">{section.label}</span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums">
                      <span className="font-semibold text-primary">{section.points}</span>
                      <span className="text-muted"> / {section.maxPoints}</span>
                    </span>
                  </button>

                  {isOpen && elements.length > 0 && (
                    <ul className="border-t border-default bg-base/40">
                      {elements.map((el) => (
                        <li key={el.elementId} className="flex items-start gap-3 px-4 py-3 border-b border-default last:border-0">
                          <span
                            className={`shrink-0 mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold border ${GRADE_STYLE[el.grade].cls}`}
                          >
                            {GRADE_STYLE[el.grade].label}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13px] font-medium text-primary">{el.label}</span>
                            {el.evidence && (
                              <span className="block text-[11px] text-secondary leading-snug">{el.evidence}</span>
                            )}
                          </span>
                          <PlayChip timestampS={el.timestampS} onSeek={onSeek} />
                          <span className="shrink-0 w-10 text-right text-[13px] font-semibold tabular-nums text-primary">
                            {el.points}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {pitch.deliveryScaled && (
          // Without this line, a rep adds the Delivery element rows, gets a smaller number than
          // the section shows, and concludes the score is wrong. It is not — it is scaled, and
          // the reason is in their favour.
          <p className="mt-2 text-[11px] text-muted leading-snug">
            No objection came up, so Objection handling was not scored and the other Delivery
            skills were scaled up. A smooth pitch is not penalised.
          </p>
        )}

        {retired.length > 0 && (
          <p className="mt-2 text-[11px] text-muted">
            {retired.length} element{retired.length === 1 ? "" : "s"} from an older rubric version
            still count toward this pitch&apos;s base.
          </p>
        )}
      </section>

      {/* ── Bonuses ───────────────────────────────────────────────────────────────────── */}
      {bonuses.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-muted mb-2">Bonuses earned</h3>
          <ul className="rounded-xl border border-default bg-surface divide-y divide-default overflow-hidden">
            {bonuses.map((b, i) => (
              <li key={`${b.itemId}-${i}`} className="flex items-start gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-primary">
                    {BONUSES_BY_ID.get(b.itemId)?.label ?? b.itemId}
                  </span>
                  {b.evidence && <span className="block text-[11px] text-secondary leading-snug">{b.evidence}</span>}
                  {b.confidence != null && (
                    <span className="block text-[10px] text-muted">
                      Heard in the audio · {Math.round(b.confidence * 100)}% confidence
                    </span>
                  )}
                </span>
                <PlayChip timestampS={b.timestampS} onSeek={onSeek} />
                <span className="shrink-0 w-10 text-right text-[13px] font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  +{b.points}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/*
        Bonuses the scorer HEARD and did not award. This is the whole reason the confidence
        survives to the database: "the AI didn't see it" is not an answer a manager can settle,
        and "it heard it at 62%, below the 80% floor" is.
      */}
      {rejected.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-muted mb-2">Heard, not awarded</h3>
          <ul className="rounded-xl border border-default bg-surface divide-y divide-default overflow-hidden">
            {rejected.map((r, i) => (
              <li key={`${r.itemId}-${i}`} className="flex items-start gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-secondary">
                    {BONUSES_BY_ID.get(r.itemId)?.label ?? r.itemId}
                  </span>
                  <span className="block text-[11px] text-muted leading-snug">
                    {r.confidence != null
                      ? `Only ${Math.round(r.confidence * 100)}% sure, so it was not awarded.`
                      : "Not confident enough to award."}
                    {r.evidence ? ` ${r.evidence}` : ""}
                  </span>
                </span>
                <PlayChip timestampS={r.timestampS} onSeek={onSeek} />
                {onDispute && (
                  <button
                    type="button"
                    onClick={() => onDispute({ itemId: r.itemId, ...(r.timestampS != null ? { timestampS: r.timestampS } : {}) })}
                    className="shrink-0 text-[11px] font-semibold text-brand hover:underline"
                  >
                    Dispute
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Violations ────────────────────────────────────────────────────────────────── */}
      {violations.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-muted mb-2">Violations</h3>
          <ul className="rounded-xl border border-red-600/30 bg-red-600/5 divide-y divide-red-600/20 overflow-hidden">
            {violations.map((v, i) => (
              <li key={`${v.itemId}-${i}`} className="flex items-start gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-primary">
                    {VIOLATIONS_BY_ID.get(v.itemId)?.label ?? v.itemId}
                  </span>
                  {v.evidence && <span className="block text-[11px] text-secondary leading-snug">{v.evidence}</span>}
                </span>
                <PlayChip timestampS={v.timestampS} onSeek={onSeek} />
                <span className="shrink-0 w-10 text-right text-[13px] font-semibold tabular-nums text-red-700 dark:text-red-400">
                  −{v.points}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── The rep's own disputes, and what came back ────────────────────────────────── */}
      {pitch.disputes.length > 0 && (
        <section>
          <h3 className="text-[10px] uppercase tracking-widest text-muted mb-2">Your disputes</h3>
          <ul className="space-y-2">
            {pitch.disputes.map((d) => (
              <li key={d.id} className="rounded-xl border border-default bg-surface p-4">
                <p className="text-[12px] font-medium text-primary">
                  You disputed{" "}
                  <span className="text-brand">{d.itemLabel ?? "the whole score"}</span>
                </p>
                <p className="mt-1 text-[11px] text-secondary leading-snug whitespace-pre-wrap">{d.note}</p>

                {d.answer ? (
                  <div className="mt-3 rounded-lg border border-default bg-base/40 p-3">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted">
                      <MessageSquare className="w-3 h-3" aria-hidden />
                      Your manager replied
                    </p>
                    <p className="mt-1 text-[12px] text-primary whitespace-pre-wrap">{d.answer.note}</p>
                  </div>
                ) : (
                  /*
                    Waiting is a real state and it is said out loud. Showing the dispute with no
                    status reads as "nothing happened", which is what a rep concludes when a
                    complaint disappears — and concluding that once is enough to stop them filing
                    a second one, which costs the scorer the only correction signal it has.
                  */
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
                    <Clock className="w-3 h-3" aria-hidden />
                    Waiting on your manager. The score stays as it is until they respond.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Dispute ───────────────────────────────────────────────────────────────────── */}
      {onDispute && (
        <section>
          <button
            type="button"
            onClick={() => onDispute({})}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-brand/50 px-4 py-3 text-sm font-semibold text-brand hover:bg-brand/10"
          >
            <Flag className="w-4 h-4" aria-hidden />
            Dispute a score
          </button>
          <p className="mt-2 text-center text-[11px] text-muted">
            Goes to your manager with the timestamp. Changes are logged.
          </p>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" }) {
  const toneCls =
    tone === "up"
      ? "text-emerald-700 dark:text-emerald-400"
      : tone === "down"
        ? "text-red-700 dark:text-red-400"
        : "text-primary";
  return (
    <div className="rounded-lg border border-default bg-base/40 px-2 py-2">
      <p className={`text-base font-semibold tabular-nums ${toneCls}`}>{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}
