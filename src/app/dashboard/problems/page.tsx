"use client";

import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { SkeletonCard } from "@/components/ui/Skeleton";
import StatusBadge from "@/components/ui/StatusBadge";
import { fetchProblems, type ProblemRecord, type ProblemsMode } from "@/lib/data/problems";
import { fetchSignals } from "@/lib/data/signals";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  evaluateUnderstandingGate,
  describeGapToGate,
  type GateEvaluation,
} from "@/lib/diagnosis";
import Modal from "@/components/ui/Modal";
import { Field, Input, Textarea } from "@/components/ui/Field";
import {
  CheckCircle2,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-surface-raised text-secondary border border-strong",
  surfaceable: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  surfaced: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  dismissed: "bg-surface-raised text-muted border border-strong",
};

export default function ProblemsPage() {
  const [problems, setProblems] = useState<ProblemRecord[]>([]);
  const [mode, setMode] = useState<ProblemsMode>("live-empty");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const res = await fetchProblems();
    setProblems(res.problems);
    setMode(res.mode);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1" && supabaseEnabled) {
      setCreating(true);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Problems"
        subtitle="Hypotheses waiting on the Understanding Gate · §3.2"
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-ember-400/5 border border-ember-400/20">
          <ShieldCheck className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
          <p className="text-xs text-secondary leading-relaxed">
            A problem may not be surfaced until it links to ≥3 signals from ≥2 distinct
            sources AND a diagnosis of ≥80 chars is stated. The gate is enforced at the
            database layer — application code cannot bypass it.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {problems.length} hypothesis{problems.length === 1 ? "" : "es"} on file
          </p>
          <LearningHint
            category="Chain · §3.2"
            title="New problem hypothesis"
            whatItIs="Opens the problem-draft modal. A hypothesis is the team's articulated read of a pattern: title + diagnosis (the WHY, ≥80 chars) + linked supporting signals. The Understanding Gate evaluates live as you fill the form — you see exactly what's still missing before it can surface."
            why="The word 'hypothesis' is deliberate. A team that names problems before earning the right to name them produces work that addresses symptoms — and the same symptom comes back the next cycle. The draft state is the discipline of 'state your read in a form the gate can evaluate.' Some drafts will earn surface; some won't. Both outcomes are useful."
            how="Click when you see a pattern that's bothering you. Write the title in your own words. Write the diagnosis — the WHY behind the pattern, in ≥80 chars. Link the signals that point at it. If the gate says 'would hold,' look at the reason. Don't force surface by padding the diagnosis — sharpen it, or gather more signal."
            principle="A hypothesis is more honest than a 'problem.' You're stating your read; the gate decides whether the team should attend to it."
          >
            <button
              onClick={() => setCreating(true)}
              disabled={!supabaseEnabled}
              className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              New problem hypothesis
            </button>
          </LearningHint>
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
            <p className="text-sm text-primary mb-2">No problems yet.</p>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              A problem is a pattern you&apos;ve seen enough times to name.
              Start one above — write what you&apos;re observing and link
              the supporting signals. Until you have evidence, your
              hypothesis stays a draft; the system asks for proof before
              it tells your team this is real.
            </p>
          </div>
        )}

        {problems.length > 0 && (
          <div className="space-y-3">
            {problems.map((p) => (
              <ProblemRow key={p.id} problem={p} onChanged={refresh} />
            ))}
          </div>
        )}
      </div>

      {creating && (
        <CreateProblemModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function ProblemRow({
  problem,
  onChanged,
}: {
  problem: ProblemRecord;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Dismissal capture is now a structured modal, not window.prompt().
  // prompt() is OS-styled (breaks brand consistency), can't validate,
  // can't be tested, and isn't usable on most modern mobile keyboards.
  // Audit 2026-06-19.
  const [dismissalOpen, setDismissalOpen] = useState(false);
  const [dismissalReason, setDismissalReason] = useState("");

  const surface = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/problems", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: problem.id, status: "surfaced" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.gateHold
            ? `Gate refused: ${data.error}`
            : data.error ?? "Could not surface."
        );
        return;
      }
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const submitDismissal = async () => {
    const reason = dismissalReason.trim();
    if (reason.length < 10) {
      setError(
        `Dismissal reason needs ≥10 characters (currently ${reason.length}). The record is permanent — flesh it out.`
      );
      return;
    }
    setBusy(true);
    setError("");
    const res = await fetch("/api/problems", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: problem.id,
        status: "dismissed",
        dismissalReason: reason,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Could not dismiss.");
    } else {
      setDismissalOpen(false);
      setDismissalReason("");
    }
    setBusy(false);
    onChanged();
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-primary">{problem.title}</p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${
                STATUS_BADGE[problem.status] ?? STATUS_BADGE.draft
              }`}
            >
              {problem.status}
            </span>
            <span className="text-[10px] text-muted font-mono">{problem.kind}</span>
          </div>
          <p className="text-xs text-muted mt-1">
            {problem.signalCount} signal{problem.signalCount === 1 ? "" : "s"} linked ·{" "}
            diagnosis: {problem.diagnosis ? problem.diagnosis.length : 0} chars
          </p>
          {problem.diagnosis && (
            <p className="text-xs text-secondary mt-2 leading-relaxed line-clamp-2">
              {problem.diagnosis}
            </p>
          )}
          {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {problem.status === "draft" && (
            <>
              <button
                type="button"
                onClick={surface}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-ember-400/30 hover:border-ember-400/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
              >
                <ShieldCheck className="w-3 h-3" /> Try to surface
              </button>
              <button
                type="button"
                onClick={() => setDismissalOpen(true)}
                disabled={busy}
                className="text-xs text-muted hover:text-red-400 disabled:opacity-40"
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
      {dismissalOpen && (
        <Modal
          open
          onClose={() => {
            if (!busy) {
              setDismissalOpen(false);
              setDismissalReason("");
              setError("");
            }
          }}
          title="Dismiss this hypothesis"
          size="md"
        >
          <p className="text-xs text-secondary mb-3 leading-relaxed">
            Dismissals land on the §3.1 chain as permanent events. The
            reason is preserved for retrospective learning. Be specific
            — &quot;not a real problem&quot; doesn&apos;t teach the next
            audit.
          </p>
          <Textarea
            value={dismissalReason}
            onChange={(e) => setDismissalReason(e.target.value)}
            rows={4}
            placeholder="Why is this being dismissed? Be concrete."
            autoFocus
          />
          <div className="flex items-center justify-between mt-1">
            <p className="text-[10px] text-muted">Minimum 10 characters.</p>
            <p
              className={`text-[10px] tabular-nums ${
                dismissalReason.trim().length < 10
                  ? "text-muted"
                  : "text-emerald-400"
              }`}
            >
              {dismissalReason.trim().length} / 10+
            </p>
          </div>
          {error && (
            <p className="text-[11px] text-red-400 mt-2" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => {
                setDismissalOpen(false);
                setDismissalReason("");
                setError("");
              }}
              disabled={busy}
              className="text-xs text-muted hover:text-secondary px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void submitDismissal()}
              disabled={busy || dismissalReason.trim().length < 10}
              className="bg-red-500/15 hover:bg-red-500/25 disabled:opacity-40 text-red-300 font-semibold px-3 py-2 rounded-lg text-xs transition-colors"
            >
              {busy ? "Dismissing…" : "Dismiss with reason"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CreateProblemModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [kind, setKind] = useState("operational_bottleneck");
  const [title, setTitle] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [allSignals, setAllSignals] = useState<
    { id: string; kind: string; source: string }[]
  >([]);
  const [selectedSignalIds, setSelectedSignalIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSignals({ sinceDays: 60 }).then((res) =>
      setAllSignals(
        res.signals.map((s) => ({ id: s.id, kind: s.kind, source: s.source }))
      )
    );
  }, []);

  const toggleSignal = (id: string) => {
    setSelectedSignalIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const gate: GateEvaluation = useMemo(() => {
    const selected = allSignals.filter((s) => selectedSignalIds.has(s.id));
    return evaluateUnderstandingGate({
      signalCount: selected.length,
      distinctSources: selected.map((s) => s.source),
      diagnosis,
    });
  }, [allSignals, selectedSignalIds, diagnosis]);

  const submit = async () => {
    if (!title.trim()) {
      setError("Title required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title,
          diagnosis: diagnosis || null,
          signalIds: [...selectedSignalIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Create failed.");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="New problem hypothesis" size="xl">
      <div className="space-y-3" aria-busy={submitting}>
        <Field label="Kind">
          <Input
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            autoComplete="off"
            placeholder="e.g. operational_bottleneck, financial_risk"
            className="font-mono"
          />
        </Field>
        <Field label="Title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="One-line hypothesis title"
            autoComplete="off"
          />
        </Field>
        <Field label="Diagnosis (the WHY — ≥80 chars to pass the gate)">
          <Textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={4}
          />
          <div className="flex items-center justify-end mt-1">
            <p
              className={`text-[10px] tabular-nums ${
                diagnosis.trim().length < 80 ? "text-muted" : "text-emerald-400"
              }`}
            >
              {diagnosis.trim().length} / 80+ chars
            </p>
          </div>
        </Field>
        <Field
          label={`Link supporting signals (${allSignals.length} available)`}
        >
          <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-surface border border-default rounded-lg">
            {allSignals.length === 0 ? (
              <p className="text-xs text-muted p-2">
                No signals available yet. Create tasks to generate events that
                derive into signals.
              </p>
            ) : (
              allSignals.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-xs text-secondary cursor-pointer hover:bg-surface-raised p-1.5 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedSignalIds.has(s.id)}
                    onChange={() => toggleSignal(s.id)}
                    className="accent-ember-400"
                  />
                  <span className="font-mono">
                    <span className="text-brand">{s.kind}</span>{" "}
                    <span className="text-muted">@ {s.source}</span>
                  </span>
                </label>
              ))
            )}
          </div>
        </Field>

          {/* Live gate preview */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={`p-3 rounded-xl border ${
              gate.passes
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-yellow-500/5 border-yellow-500/20"
            }`}
          >
            {/* Full natural-language verdict for screen readers — visible UI
                breaks the same content into chips/badges. */}
            <span className="sr-only">
              {gate.passes ? "Understanding gate would pass. " : "Understanding gate would hold. "}
              {gate.reason}
            </span>
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck
                aria-hidden="true"
                className={`w-4 h-4 ${
                  gate.passes ? "text-emerald-400" : "text-yellow-400"
                }`}
              />
              <p
                className={`text-[10px] uppercase tracking-widest ${
                  gate.passes ? "text-emerald-300" : "text-yellow-300"
                }`}
              >
                {gate.passes ? "gate would pass" : "gate would hold"}
              </p>
            </div>
            {!gate.passes && (
              <p className="text-[11px] text-primary">{describeGapToGate(gate)}</p>
            )}
            <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-muted">
              <div>
                signals:{" "}
                <span className="text-secondary font-mono">{gate.signalCount}</span> /{" "}
                <span className="font-mono">{gate.threshold.minSignals}</span>
              </div>
              <div>
                sources:{" "}
                <span className="text-secondary font-mono">
                  {gate.distinctSourceCount}
                </span>{" "}
                / <span className="font-mono">{gate.threshold.minDistinctSources}</span>
              </div>
              <div>
                chars:{" "}
                <span className="text-secondary font-mono">
                  {gate.diagnosisCharCount}
                </span>{" "}
                / <span className="font-mono">{gate.threshold.minDiagnosisChars}</span>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-base/95 backdrop-blur-sm border-t border-default flex items-center justify-end gap-2 mt-3">
            <button type="button" onClick={onClose} className="text-xs text-muted hover:text-secondary px-3 py-2">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              {submitting ? "Creating…" : "Create draft"}
              {!submitting && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />}
            </button>
          </div>
      </div>
    </Modal>
  );
}

// Hush unused import warning for StatusBadge — kept available for status row variant.
void StatusBadge;
