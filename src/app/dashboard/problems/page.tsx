"use client";

import TopBar from "@/components/layout/TopBar";
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
  Loader2,
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
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FACC15]/5 border border-[#FACC15]/20">
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
          <button
            onClick={() => setCreating(true)}
            disabled={!supabaseEnabled}
            className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New problem hypothesis
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
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

  const dismiss = async () => {
    const reason = prompt(
      "Why is this being dismissed? (preserved on the record for retrospective learning)"
    );
    if (!reason) return;
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
                onClick={surface}
                disabled={busy}
                className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-[#FACC15]/30 hover:border-[#FACC15]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
              >
                <ShieldCheck className="w-3 h-3" /> Try to surface
              </button>
              <button
                onClick={dismiss}
                disabled={busy}
                className="text-xs text-muted hover:text-red-400 disabled:opacity-40"
              >
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>
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
            className="font-mono"
          />
        </Field>
        <Field label="Title" required>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="One-line hypothesis title"
          />
        </Field>
        <Field label="Diagnosis (the WHY — ≥80 chars to pass the gate)">
          <Textarea
            value={diagnosis}
            onChange={(e) => setDiagnosis(e.target.value)}
            rows={4}
          />
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
                    className="accent-[#FACC15]"
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

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="text-xs text-muted hover:text-secondary px-3 py-2">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              {submitting ? "Creating…" : "Create draft"}
              {!submitting && <CheckCircle2 className="w-3.5 h-3.5" />}
            </button>
          </div>
      </div>
    </Modal>
  );
}

// Hush unused import warning for StatusBadge — kept available for status row variant.
void StatusBadge;
