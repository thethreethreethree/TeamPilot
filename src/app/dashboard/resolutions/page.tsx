"use client";

import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { SkeletonCard } from "@/components/ui/Skeleton";
import {
  fetchResolutions,
  type ResolutionRecord,
  type ResolutionsMode,
} from "@/lib/data/resolutions";
import Modal from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import ExportMenu from "@/components/ui/ExportMenu";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FileMentionAutocomplete } from "@/components/files/FileMentionAutocomplete";
import { renderInline } from "@/lib/chat/markdown";

const DURABILITY_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }
> = {
  held: {
    label: "Held",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: CheckCircle2,
  },
  reopened: {
    label: "Reopened",
    color: "text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: XCircle,
  },
  partial: {
    label: "Partial",
    color: "text-yellow-300",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: AlertTriangle,
  },
  unknown: {
    label: "Unknown",
    color: "text-secondary",
    bg: "bg-surface-raised",
    border: "border-strong",
    icon: Eye,
  },
};

export default function ResolutionsPage() {
  const [resolutions, setResolutions] = useState<ResolutionRecord[]>([]);
  const [mode, setMode] = useState<ResolutionsMode>("live-empty");
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState<ResolutionRecord | null>(null);

  const refresh = async () => {
    setLoading(true);
    const res = await fetchResolutions();
    setResolutions(res.resolutions);
    setMode(res.mode);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const reviewed = resolutions.filter((r) => r.durability !== null);
  const heldRate =
    reviewed.length === 0
      ? null
      : reviewed.filter((r) => r.durability === "held").length / reviewed.length;

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Resolutions"
        subtitle="Past decisions + their actual outcomes · consequence measurement"
      />

      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        <LearningHint
          as="block"
          category="Chain · §3.5"
          title="The Resolutions ledger"
          whatItIs="Every closed problem has a row here: action taken, reasoning (≥40 chars), expected outcome, observed outcome, durability state. Action and reasoning are immutable from the moment of capture. Outcome and durability get filled later, when enough time has passed to actually see whether the resolution held."
          why="This is the only place in the System where consequence is measured against expectation honestly. Other tools track 'we did X' and stop. This one tracks 'we did X expecting Y, and we got Z' — which is the only data that can tell you whether the team is getting better at the work. The held rate stat on Command Center is derived from this page."
          how="Open a resolution row periodically (especially ones older than 7 days). Walk through: did the expected outcome match the observed one? Did the underlying problem reopen? Record held / reopened / partial / inconclusive. The discipline is in the recording — the closure was the easy part."
          principle="Measure consequence, not agreement. A resolution everyone loved that didn't hold is failure. A resolution someone resisted that did hold is success."
        >
          <div className="flex items-start gap-3 p-3 rounded-xl bg-ember-400/5 border border-ember-400/20">
            <Sparkles className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
            <p className="text-xs text-secondary leading-relaxed">
              Every closed problem produced a resolution. The action and reasoning are
              immutable; the observed outcome and durability are filled later, after enough
              time has passed to see whether the resolution held. This is what §3.5 calls
              measuring consequence, not agreement.
            </p>
          </div>
        </LearningHint>

        {/* Summary + export */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="grid grid-cols-3 gap-3 md:gap-4 flex-1 min-w-0">
            <LearningHint
              category="Resolutions · Volume"
              title="Total resolutions"
              whatItIs="The all-time count of closed problems that produced a captured resolution. Every row on this page represents one count."
              why="A team's playbook size matters less than people think. A small team with 30 high-quality, durable resolutions outperforms a larger team with 300 shallow ones. The raw count is context, not a verdict — use it alongside Held rate to read the real signal."
              how="Watch the trend, not the absolute number. A flat count means the team isn't closing problems with reasoning attached. A growing count without a holding Held rate means the team is closing things that don't stick. The honest team grows count AND Held rate together."
              principle="Count without quality is vanity. Quality without count is a one-off. The pair is what compounds."
            >
              <Stat label="Total resolutions" value={resolutions.length} color="text-primary" />
            </LearningHint>
            <LearningHint
              category="Resolutions · Review"
              title="Reviewed"
              whatItIs="Of all captured resolutions, the count that have been reviewed for durability — meaning the observed outcome has been filled in and durability (held / partial / reopened / inconclusive) recorded."
              why="A resolution without a review is half a resolution. The capture moment records the team's expectation; the review moment compares that expectation against what actually happened. The §3.5 measure-consequence discipline lives in the review step. A team that captures but doesn't review is performing learning, not doing it."
              how="If Reviewed is much smaller than Total, that's the team's first action item — walk through unreviewed resolutions whose durability window has elapsed (7 days post-decided is the canonical check) and record what actually held. The Resolutions list highlights overdue reviews."
              principle="Review is where the team decides whether the work was real. Skipping it means the team never finds out."
            >
              <Stat label="Reviewed" value={reviewed.length} color="text-blue-400" />
            </LearningHint>
            <LearningHint
              category="Resolutions · §3.5"
              title="Held rate"
              whatItIs="Of resolutions that have been reviewed, the percentage where durability was marked HELD (the underlying problem did not reopen within the durability window). The single most honest measure of the team's operational learning."
              why="Every other team-metric (close rate, response time, tickets per day) measures the team's activity. Held rate measures whether the work actually worked. It's the only metric that resists the productivity-theater failure mode — you can't game it by closing more things, because closing things faster makes them more likely to reopen, which DECREASES Held rate."
              how="Track held rate over time. A flat or declining held rate means the team is closing problems that don't stick — usually a symptom of skipped diagnosis. The fix isn't to close fewer things; it's to invest more in the WHY (the diagnosis + reasoning) before closing."
              principle="The single number that resists vanity. If only one metric survived for the team, this is the one to keep."
            >
              <Stat
                label="Held rate"
                value={heldRate === null ? "—" : `${Math.round(heldRate * 100)}%`}
                color={heldRate === null ? "text-muted" : "text-emerald-400"}
              />
            </LearningHint>
          </div>
          <ExportMenu
            entity="resolutions"
            disabled={!supabaseEnabled || mode === "demo-fixtures"}
            disabledReason="Export requires live mode (your data, not demo fixtures)."
          />
        </div>

        {loading && (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        )}

        {!loading && mode === "live-empty" && (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-primary mb-2">No resolutions yet.</p>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              Resolutions are recorded by closing a problem in the Living Diagnosis
              flow. Once one exists, you can come back here to fill in what actually
              happened.
            </p>
          </div>
        )}

        {!loading && resolutions.length > 0 && (
          <div className="space-y-3">
            {resolutions.map((r) => (
              <ResolutionRow
                key={r.id}
                resolution={r}
                onReview={() => mode !== "demo-fixtures" && setReviewing(r)}
              />
            ))}
          </div>
        )}
      </div>

      {reviewing && (
        <ReviewModal
          resolution={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => {
            setReviewing(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ResolutionRow({
  resolution,
  onReview,
}: {
  resolution: ResolutionRecord;
  onReview: () => void;
}) {
  const dur = resolution.durability
    ? DURABILITY_META[resolution.durability]
    : null;
  const Icon = dur?.icon;
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-3 flex-col sm:flex-row">
        <div className="min-w-0 flex-1 w-full">
          <p className="text-sm font-medium text-primary break-words">
            {resolution.problemTitle ?? "—"}
          </p>
          <p className="text-xs text-secondary mt-1 leading-relaxed break-words">
            <span className="text-muted uppercase tracking-widest text-[10px]">action</span>{" "}
            {renderInline(resolution.actionTaken, `act-${resolution.id}`)}
          </p>
          <p className="text-xs text-secondary mt-1 leading-relaxed break-words">
            <span className="text-muted uppercase tracking-widest text-[10px]">why</span>{" "}
            {renderInline(resolution.reasoning, `why-${resolution.id}`)}
          </p>
          {resolution.expectedOutcome && (
            <p className="text-xs text-secondary mt-1 leading-relaxed">
              <span className="text-muted uppercase tracking-widest text-[10px]">expected</span>{" "}
              {renderInline(resolution.expectedOutcome, `exp-${resolution.id}`)}
            </p>
          )}
          {resolution.observedOutcome && (
            <p className="text-xs text-primary/80 mt-1 leading-relaxed">
              <span className="text-emerald-300/80 uppercase tracking-widest text-[10px]">observed</span>{" "}
              {renderInline(resolution.observedOutcome, `obs-${resolution.id}`)}
            </p>
          )}
          <p className="text-[10px] text-muted mt-2 font-mono">
            decided {resolution.decidedAt.slice(0, 10)}
            {resolution.reviewedAt &&
              ` · reviewed ${resolution.reviewedAt.slice(0, 10)}`}
          </p>
        </div>
        <div className="flex sm:flex-col items-start sm:items-end gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap">
          {dur && Icon ? (
            <span
              className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${dur.color} ${dur.bg} ${dur.border}`}
            >
              <Icon className="w-3 h-3" /> {dur.label}
            </span>
          ) : (
            <LearningHint
              category="Resolution · §3.5 review"
              title="Review outcome"
              whatItIs="Opens the durability review modal for this resolution. Lets you record what ACTUALLY happened (observed outcome, ≥20 chars) and pick a durability state — HELD (problem didn't reopen), PARTIAL (some closure, some leakage), REOPENED (the fix didn't stick), INCONCLUSIVE (window expired without enough signal). The review is recorded once and then locked (§3.1) — you don't edit a prior review. Review AFTER the durability window, when the signal actually exists."
              why="The capture moment recorded WHAT the team did and the expected outcome. The review moment compares that expectation against reality. §3.5 says only this comparison counts as validated learning — acceptance, click-through, or close rate are vanity. Review is the load-bearing measurement."
              how="Wait until enough time has passed for the underlying problem to credibly come back (typically 7 days for support, 28 days for operational decisions). Then click. Write what actually happened, plainly. Pick the durability state honestly — even when partial or reopened. The honest record is what makes the System smarter."
              principle="The review is where vanity becomes consequence. Skipping it means the team never finds out whether the work worked."
            >
              <button
                type="button"
                onClick={onReview}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-ember-400/30 hover:border-ember-400/60 px-3 py-1.5 rounded-lg transition-all"
              >
                Review outcome
              </button>
            </LearningHint>
          )}
        </div>
      </div>
    </div>
  );
}

function ReviewModal({
  resolution,
  onClose,
  onSaved,
}: {
  resolution: ResolutionRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [observedOutcome, setObservedOutcome] = useState(resolution.observedOutcome ?? "");
  // No default durability: the review is write-once (§3.1), so "unknown/inconclusive"
  // must be a CONSCIOUS choice (§3.5), never an accidental lock from a hasty Save on a
  // pre-selected value. Empty until the reviewer deliberately picks one.
  const [durability, setDurability] = useState<string>(resolution.durability ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const outcomeRef = useRef<HTMLTextAreaElement | null>(null);

  const DURABILITY_CHOICES = ["held", "partial", "reopened", "unknown"];
  const durabilityChosen = DURABILITY_CHOICES.includes(durability);
  const MIN_OUTCOME_CHARS = 20;
  const submit = async () => {
    if (observedOutcome.trim().length < MIN_OUTCOME_CHARS) {
      setError(
        `Observed outcome needs at least ${MIN_OUTCOME_CHARS} characters — currently ${observedOutcome.trim().length}.`
      );
      return;
    }
    if (!durabilityChosen) {
      setError(
        "Pick a durability state — even 'inconclusive' is a conscious call. This review is recorded once and can't be edited later."
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/resolutions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: resolution.id, observedOutcome, durability }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Review outcome" size="lg">
      <div className="mb-3 p-3 bg-surface border border-default rounded-xl">
        <p className="text-xs text-muted uppercase tracking-widest mb-1">action</p>
        <p className="text-sm text-primary">
          {renderInline(resolution.actionTaken, `modal-act-${resolution.id}`)}
        </p>
      </div>
      <div className="space-y-3" aria-busy={submitting}>
        <Field label={`What actually happened? (≥${MIN_OUTCOME_CHARS} chars)`}>
          <div className="relative">
            <FileMentionAutocomplete
              textareaRef={outcomeRef}
              value={observedOutcome}
              onChange={setObservedOutcome}
            />
            <Textarea
              ref={outcomeRef}
              value={observedOutcome}
              onChange={(e) => setObservedOutcome(e.target.value)}
              rows={4}
              placeholder="Concrete observation — not 'it worked', but what specifically changed in the world. Type @file to cite a file."
            />
          </div>
          <div className="mt-1 flex items-center justify-end">
            <p
              className={`text-[10px] tabular-nums ${
                observedOutcome.trim().length < MIN_OUTCOME_CHARS
                  ? "text-muted"
                  : "text-emerald-400"
              }`}
            >
              {observedOutcome.trim().length} / {MIN_OUTCOME_CHARS}+
            </p>
          </div>
        </Field>
        <Field label="Durability">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Durability outcome">
            {(["held", "partial", "reopened", "unknown"] as const).map((d) => {
              const meta = DURABILITY_META[d];
              if (!meta) return null;
              const Icon = meta.icon;
              const isSelected = durability === d;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => setDurability(d)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                    isSelected
                      ? `${meta.bg} ${meta.border} ${meta.color} ring-2 ring-current/30`
                      : "border-default text-muted hover:border-strong"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {meta.label}
                  {isSelected && (
                    <span
                      aria-hidden
                      className="ml-auto text-[10px] uppercase tracking-widest font-bold"
                    >
                      selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-base/95 backdrop-blur-sm border-t border-default flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted hover:text-secondary px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || observedOutcome.trim().length < MIN_OUTCOME_CHARS || !durabilityChosen}
            className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
          >
            {submitting ? "Saving…" : "Save outcome"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
