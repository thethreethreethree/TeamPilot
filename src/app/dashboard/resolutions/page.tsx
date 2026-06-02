"use client";

import TopBar from "@/components/layout/TopBar";
import {
  fetchResolutions,
  type ResolutionRecord,
  type ResolutionsMode,
} from "@/lib/data/resolutions";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Loader2,
  Sparkles,
  XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";

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
    color: "text-[#8895c4]",
    bg: "bg-[#252840]",
    border: "border-[#3a3f5c]",
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
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar
        title="Resolutions"
        subtitle="Past decisions + their actual outcomes · §3.5 consequence measurement"
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#5470ff]/5 border border-[#5470ff]/20">
          <Sparkles className="w-4 h-4 text-[#7a96ff] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#8895c4] leading-relaxed">
            Every closed problem produced a resolution. The action and reasoning are
            immutable; the observed outcome and durability are filled later, after enough
            time has passed to see whether the resolution held. This is what §3.5 calls
            measuring consequence, not agreement.
          </p>
        </div>

        {!supabaseEnabled && (
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-300 mx-auto mb-2" />
            <p className="text-sm text-yellow-100 mb-1">Live mode required</p>
            <p className="text-xs text-[#5a6399] max-w-md mx-auto">
              Resolutions are produced by closing problems in the Living Diagnosis flow.
              Configure Supabase keys to use this surface.
            </p>
          </div>
        )}

        {supabaseEnabled && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
              <Stat label="Total resolutions" value={resolutions.length} color="text-[#e8eaf6]" />
              <Stat label="Reviewed" value={reviewed.length} color="text-blue-400" />
              <Stat
                label="Held rate"
                value={heldRate === null ? "—" : `${Math.round(heldRate * 100)}%`}
                color={heldRate === null ? "text-[#5a6399]" : "text-emerald-400"}
              />
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs text-[#5a6399] py-10">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            )}

            {!loading && mode === "live-empty" && (
              <div className="glass-card p-8 text-center">
                <p className="text-sm text-[#e8eaf6] mb-2">No resolutions yet.</p>
                <p className="text-xs text-[#5a6399] max-w-md mx-auto leading-relaxed">
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
                    onReview={() => setReviewing(r)}
                  />
                ))}
              </div>
            )}
          </>
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#e8eaf6]">
            {resolution.problemTitle ?? "—"}
          </p>
          <p className="text-xs text-[#8895c4] mt-1 leading-relaxed">
            <span className="text-[#5a6399] uppercase tracking-widest text-[10px]">action</span>{" "}
            {resolution.actionTaken}
          </p>
          <p className="text-xs text-[#8895c4] mt-1 leading-relaxed">
            <span className="text-[#5a6399] uppercase tracking-widest text-[10px]">why</span>{" "}
            {resolution.reasoning}
          </p>
          {resolution.expectedOutcome && (
            <p className="text-xs text-[#8895c4] mt-1 leading-relaxed">
              <span className="text-[#5a6399] uppercase tracking-widest text-[10px]">expected</span>{" "}
              {resolution.expectedOutcome}
            </p>
          )}
          {resolution.observedOutcome && (
            <p className="text-xs text-emerald-200/80 mt-1 leading-relaxed">
              <span className="text-emerald-300/80 uppercase tracking-widest text-[10px]">observed</span>{" "}
              {resolution.observedOutcome}
            </p>
          )}
          <p className="text-[10px] text-[#3a3f5c] mt-2 font-mono">
            decided {resolution.decidedAt.slice(0, 10)}
            {resolution.reviewedAt &&
              ` · reviewed ${resolution.reviewedAt.slice(0, 10)}`}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {dur && Icon ? (
            <span
              className={`flex items-center gap-1.5 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border ${dur.color} ${dur.bg} ${dur.border}`}
            >
              <Icon className="w-3 h-3" /> {dur.label}
            </span>
          ) : (
            <button
              onClick={onReview}
              className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all"
            >
              Review outcome
            </button>
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
  const [durability, setDurability] = useState<string>(resolution.durability ?? "unknown");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (observedOutcome.trim().length < 20) {
      setError("Observed outcome must be ≥20 characters.");
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#e8eaf6]">Review outcome</h2>
          <button onClick={onClose} className="text-[#5a6399] hover:text-white text-lg">
            ×
          </button>
        </div>
        <div className="mb-3 p-3 bg-[#12141f] border border-[#252840] rounded-xl">
          <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-1">action</p>
          <p className="text-sm text-[#e8eaf6]">{resolution.actionTaken}</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#8895c4] mb-1.5 block">
              What actually happened? (≥20 chars)
            </label>
            <textarea
              value={observedOutcome}
              onChange={(e) => setObservedOutcome(e.target.value)}
              rows={4}
              placeholder="Concrete observation — not 'it worked', but what specifically changed in the world."
              className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf6] focus:outline-none focus:border-[#5470ff]/50 resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-[#8895c4] mb-1.5 block">Durability</label>
            <div className="grid grid-cols-2 gap-2">
              {(["held", "partial", "reopened", "unknown"] as const).map((d) => {
                const meta = DURABILITY_META[d];
                return (
                  <button
                    key={d}
                    onClick={() => setDurability(d)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all ${
                      durability === d
                        ? `${meta.bg} ${meta.border} ${meta.color}`
                        : "border-[#252840] text-[#5a6399] hover:border-[#3a3f5c]"
                    }`}
                  >
                    <meta.icon className="w-3.5 h-3.5" />
                    {meta.label}
                  </button>
                );
              })}
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
              {submitting ? "Saving…" : "Save outcome"}
            </button>
          </div>
        </div>
      </div>
    </div>
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
      <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
