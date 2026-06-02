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
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  ShieldCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const STATUS_BADGE: Record<string, string> = {
  draft: "bg-[#252840] text-[#8895c4] border border-[#3a3f5c]",
  surfaceable: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  surfaced: "bg-violet-500/15 text-violet-300 border border-violet-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  dismissed: "bg-[#252840] text-[#5a6399] border border-[#3a3f5c]",
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

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar
        title="Problems"
        subtitle="Hypotheses waiting on the Understanding Gate · §3.2"
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#5470ff]/5 border border-[#5470ff]/20">
          <ShieldCheck className="w-4 h-4 text-[#7a96ff] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#8895c4] leading-relaxed">
            A problem may not be surfaced until it links to ≥3 signals from ≥2 distinct
            sources AND a diagnosis of ≥80 chars is stated. The gate is enforced at the
            database layer — application code cannot bypass it.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-[#5a6399]">
            {problems.length} hypothesis{problems.length === 1 ? "" : "es"} on file
          </p>
          <button
            onClick={() => setCreating(true)}
            disabled={!supabaseEnabled}
            className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            New problem hypothesis
          </button>
        </div>

        {!supabaseEnabled && (
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-300 mx-auto mb-2" />
            <p className="text-sm text-yellow-100 mb-1">Live mode required</p>
            <p className="text-xs text-[#5a6399] max-w-md mx-auto">
              Problems are stateful records gated by the DB Understanding Gate trigger.
              Configure Supabase keys in <code>.env.local</code> to use this surface.
            </p>
          </div>
        )}

        {supabaseEnabled && loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-[#5a6399] py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </div>
        )}

        {supabaseEnabled && !loading && mode === "live-empty" && (
          <div className="glass-card p-8 text-center">
            <p className="text-sm text-[#e8eaf6] mb-2">No hypotheses yet.</p>
            <p className="text-xs text-[#5a6399] max-w-md mx-auto leading-relaxed">
              Start one above. A hypothesis begins as a draft — you link supporting
              signals and write the WHY. The gate evaluates the change when you try to
              transition to <code>surfaceable</code> or <code>surfaced</code>.
            </p>
          </div>
        )}

        {supabaseEnabled && problems.length > 0 && (
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
            <p className="text-sm font-medium text-[#e8eaf6]">{problem.title}</p>
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-medium ${
                STATUS_BADGE[problem.status] ?? STATUS_BADGE.draft
              }`}
            >
              {problem.status}
            </span>
            <span className="text-[10px] text-[#5a6399] font-mono">{problem.kind}</span>
          </div>
          <p className="text-xs text-[#5a6399] mt-1">
            {problem.signalCount} signal{problem.signalCount === 1 ? "" : "s"} linked ·{" "}
            diagnosis: {problem.diagnosis ? problem.diagnosis.length : 0} chars
          </p>
          {problem.diagnosis && (
            <p className="text-xs text-[#8895c4] mt-2 leading-relaxed line-clamp-2">
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
                className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-40"
              >
                <ShieldCheck className="w-3 h-3" /> Try to surface
              </button>
              <button
                onClick={dismiss}
                disabled={busy}
                className="text-xs text-[#5a6399] hover:text-red-400 disabled:opacity-40"
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#e8eaf6]">New problem hypothesis</h2>
          <button onClick={onClose} className="text-[#5a6399] hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#8895c4] mb-1.5 block">Kind</label>
            <input
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className="form-input font-mono"
            />
          </div>
          <div>
            <label className="text-xs text-[#8895c4] mb-1.5 block">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="One-line hypothesis title"
              className="form-input"
            />
          </div>
          <div>
            <label className="text-xs text-[#8895c4] mb-1.5 block">
              Diagnosis (the WHY — ≥80 chars to pass the gate)
            </label>
            <textarea
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              rows={4}
              className="form-input resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-[#8895c4] mb-1.5 block">
              Link supporting signals ({allSignals.length} available)
            </label>
            <div className="max-h-48 overflow-y-auto space-y-1 p-2 bg-[#12141f] border border-[#252840] rounded-lg">
              {allSignals.length === 0 ? (
                <p className="text-xs text-[#5a6399] p-2">
                  No signals available yet. Create tasks to generate events that derive into
                  signals.
                </p>
              ) : (
                allSignals.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 text-xs text-[#8895c4] cursor-pointer hover:bg-[#1a1d2e] p-1.5 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSignalIds.has(s.id)}
                      onChange={() => toggleSignal(s.id)}
                      className="accent-[#5470ff]"
                    />
                    <span className="font-mono">
                      <span className="text-[#7a96ff]">{s.kind}</span>{" "}
                      <span className="text-[#5a6399]">@ {s.source}</span>
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Live gate preview */}
          <div
            className={`p-3 rounded-xl border ${
              gate.passes
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-yellow-500/5 border-yellow-500/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck
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
              <p className="text-[11px] text-yellow-200">{describeGapToGate(gate)}</p>
            )}
            <div className="grid grid-cols-3 gap-2 mt-2 text-[10px] text-[#5a6399]">
              <div>
                signals:{" "}
                <span className="text-[#8895c4] font-mono">{gate.signalCount}</span> /{" "}
                <span className="font-mono">{gate.threshold.minSignals}</span>
              </div>
              <div>
                sources:{" "}
                <span className="text-[#8895c4] font-mono">
                  {gate.distinctSourceCount}
                </span>{" "}
                / <span className="font-mono">{gate.threshold.minDistinctSources}</span>
              </div>
              <div>
                chars:{" "}
                <span className="text-[#8895c4] font-mono">
                  {gate.diagnosisCharCount}
                </span>{" "}
                / <span className="font-mono">{gate.threshold.minDiagnosisChars}</span>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="text-xs text-[#5a6399] hover:text-[#8895c4] px-3 py-2">
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              {submitting ? "Creating…" : "Create draft"}
              {!submitting && <CheckCircle2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        <style jsx global>{`
          .form-input {
            width: 100%;
            background: #12141f;
            border: 1px solid #252840;
            border-radius: 0.5rem;
            padding: 0.625rem 0.875rem;
            font-size: 0.8125rem;
            color: #e8eaf6;
            outline: none;
            transition: border-color 0.15s;
          }
          .form-input::placeholder { color: #3a3f5c; }
          .form-input:focus { border-color: rgba(84, 112, 255, 0.5); }
        `}</style>
      </div>
    </div>
  );
}

// Hush unused import warning for StatusBadge — kept available for status row variant.
void StatusBadge;
