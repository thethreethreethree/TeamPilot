"use client";

import TopBar from "@/components/layout/TopBar";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  AlertTriangle,
  Brain as BrainIcon,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  Lock,
  RefreshCw,
  ShieldOff,
  Sparkles,
  Unlock,
} from "lucide-react";
import { useEffect, useState } from "react";

interface BrainState {
  brain: {
    version: number;
    systemPromptAddendum: string;
    knownPatterns: Array<{ claim: string; confidence: string; derived_from: string }>;
    disabledSuggestions: Array<{ suggestion: string; reason: string }>;
    validatedMethods: Array<{ method: string; why: string }>;
    lastLearningAt: string | null;
    lastLearningSummary: string | null;
    updatedAt: string;
  };
  gate: {
    guidanceEnabled: boolean;
    guidanceEnabledAt: string | null;
    guidanceUnlockAt: string | null;
    reason?: string;
  };
  evolution: Array<{
    id: string;
    kind: string;
    claim: string;
    reasoning: string;
    confidence: string;
    brainVersionBefore: number | null;
    brainVersionAfter: number | null;
    createdAt: string;
  }>;
}

export default function BrainPage() {
  const [state, setState] = useState<BrainState | null>(null);
  const [loading, setLoading] = useState(true);
  const [learning, setLearning] = useState(false);
  const [learnMessage, setLearnMessage] = useState("");
  const [unlockOpen, setUnlockOpen] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/brain");
      if (res.ok) {
        const data = (await res.json()) as BrainState;
        setState(data);
      } else {
        setState(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const triggerLearning = async () => {
    setLearning(true);
    setLearnMessage("");
    try {
      const res = await fetch("/api/brain/learn", { method: "POST" });
      const data = await res.json();
      setLearnMessage(data.summary ?? data.error ?? "Done.");
      await refresh();
    } catch (err) {
      setLearnMessage(
        err instanceof Error ? err.message : "Learning cycle failed."
      );
    } finally {
      setLearning(false);
    }
  };

  useEffect(() => {
    if (supabaseEnabled) refresh();
    else setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar
        title="Company Brain"
        subtitle="What the System has learned about this team · §3.4, §3.6"
      />

      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#5470ff]/5 border border-[#5470ff]/20">
          <BrainIcon className="w-4 h-4 text-[#7a96ff] mt-0.5 flex-shrink-0" />
          <p className="text-xs text-[#8895c4] leading-relaxed">
            The brain accumulates per-company learning from the §3.1 chain. Only
            outcomes that have <strong>held</strong> (§3.5) and problems explicitly{" "}
            <strong>dismissed</strong> count toward validated learning. Acceptance is not
            consequence. Every change is on the immutable audit trail below.
          </p>
        </div>

        {!supabaseEnabled && (
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-300 mx-auto mb-2" />
            <p className="text-sm text-yellow-100 mb-1">Live mode required</p>
            <p className="text-xs text-[#5a6399] max-w-md mx-auto">
              The brain is a per-company DB record. Configure Supabase to use this surface.
            </p>
          </div>
        )}

        {supabaseEnabled && loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-[#5a6399] py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading brain…
          </div>
        )}

        {supabaseEnabled && !loading && !state && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-[#e8eaf6] mb-2">No brain available.</p>
            <p className="text-xs text-[#5a6399]">
              Sign in and complete onboarding to initialize this company&apos;s brain.
            </p>
          </div>
        )}

        {state && (
          <>
            {/* Control gate */}
            <GateCard
              gate={state.gate}
              onUnlock={() => setUnlockOpen(true)}
            />

            {/* Brain summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Stat
                label="Brain version"
                value={`v${state.brain.version}`}
                icon={<BrainIcon className="w-3.5 h-3.5" />}
              />
              <Stat
                label="Validated methods"
                value={state.brain.validatedMethods.length}
                icon={<CheckCircle2 className="w-3.5 h-3.5" />}
              />
              <Stat
                label="Disabled suggestions"
                value={state.brain.disabledSuggestions.length}
                icon={<ShieldOff className="w-3.5 h-3.5" />}
              />
              <Stat
                label="Known patterns"
                value={state.brain.knownPatterns.length}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              />
            </div>

            {/* Learning cycle trigger */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-sm font-semibold text-[#e8eaf6]">
                    Learning cycle
                  </h2>
                  <p className="text-xs text-[#5a6399] mt-1">
                    Distills recent <strong>held</strong> resolutions and dismissed
                    problems into structured brain updates. Conservative by design — empty
                    cycles are correct when the chain has not produced validated evidence.
                  </p>
                </div>
                <button
                  onClick={triggerLearning}
                  disabled={learning}
                  className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs flex-shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${learning ? "animate-spin" : ""}`} />
                  {learning ? "Running…" : "Run learning cycle"}
                </button>
              </div>
              {learnMessage && (
                <p className="text-xs text-[#8895c4] mt-2">{learnMessage}</p>
              )}
              {state.brain.lastLearningAt && (
                <p className="text-[10px] text-[#5a6399] mt-2 font-mono">
                  Last run: {state.brain.lastLearningAt.slice(0, 19).replace("T", " ")} ·{" "}
                  {state.brain.lastLearningSummary}
                </p>
              )}
            </div>

            {/* System prompt addendum preview */}
            {state.brain.systemPromptAddendum && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-[#5470ff]" />
                  <h2 className="text-sm font-semibold text-[#e8eaf6]">
                    System prompt addendum (injected into every LLM call)
                  </h2>
                </div>
                <pre className="text-xs text-[#8895c4] whitespace-pre-wrap leading-relaxed bg-[#12141f] border border-[#252840] rounded-xl p-4 max-h-72 overflow-y-auto">
{state.brain.systemPromptAddendum}
                </pre>
              </div>
            )}

            {/* Brain contents */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <BrainList
                title="Validated methods"
                icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                items={state.brain.validatedMethods.map((m) => ({
                  primary: m.method,
                  secondary: m.why,
                }))}
                emptyText="Nothing validated yet. Methods land here once they have produced held resolutions."
              />
              <BrainList
                title="Disabled suggestions"
                icon={<ShieldOff className="w-4 h-4 text-yellow-400" />}
                items={state.brain.disabledSuggestions.map((d) => ({
                  primary: d.suggestion,
                  secondary: d.reason,
                }))}
                emptyText="No disabled suggestions yet. They land here when a problem with a System-proposed action is explicitly dismissed."
              />
              <BrainList
                title="Known patterns"
                icon={<Sparkles className="w-4 h-4 text-blue-400" />}
                items={state.brain.knownPatterns.map((p) => ({
                  primary: p.claim,
                  secondary: `${p.confidence} · ${p.derived_from}`,
                }))}
                emptyText="No patterns distilled yet."
              />
            </div>

            {/* Evolution audit trail */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6] mb-3">
                Evolution audit ({state.evolution.length} entries)
              </h2>
              {state.evolution.length === 0 ? (
                <p className="text-xs text-[#5a6399] py-4">
                  No evolution events yet. Each entry below would represent one
                  brain update, immutable on the record (per §3.1).
                </p>
              ) : (
                <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {state.evolution.map((e) => (
                    <li
                      key={e.id}
                      className="p-3 bg-[#12141f] border border-[#252840] rounded-xl"
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#252840] text-[#8895c4]">
                          {e.kind}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-widest font-medium ${
                            e.confidence === "high"
                              ? "text-emerald-300"
                              : e.confidence === "medium"
                              ? "text-blue-300"
                              : "text-[#5a6399]"
                          }`}
                        >
                          {e.confidence}
                        </span>
                        <span className="text-[10px] text-[#3a3f5c] font-mono">
                          v{e.brainVersionBefore} → v{e.brainVersionAfter}
                        </span>
                      </div>
                      <p className="text-sm text-[#e8eaf6]">{e.claim}</p>
                      <p className="text-xs text-[#8895c4] mt-1 leading-relaxed">
                        {e.reasoning}
                      </p>
                      <p className="text-[10px] text-[#3a3f5c] mt-1 font-mono">
                        {e.createdAt.slice(0, 19).replace("T", " ")}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {unlockOpen && (
        <UnlockModal
          onClose={() => setUnlockOpen(false)}
          onUnlocked={() => {
            setUnlockOpen(false);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function GateCard({
  gate,
  onUnlock,
}: {
  gate: BrainState["gate"];
  onUnlock: () => void;
}) {
  if (gate.guidanceEnabled) {
    return (
      <div className="glass-card p-4 border-emerald-500/30">
        <div className="flex items-center gap-2 mb-1">
          <Unlock className="w-4 h-4 text-emerald-400" />
          <p className="text-sm font-medium text-emerald-200">
            AI guidance enabled
          </p>
        </div>
        <p className="text-xs text-[#8895c4]">
          {gate.guidanceEnabledAt
            ? `Enabled ${gate.guidanceEnabledAt.slice(0, 10)}.`
            : "Control window has cleared."}
        </p>
      </div>
    );
  }
  return (
    <div className="glass-card p-4 border-yellow-500/30 bg-yellow-500/5">
      <div className="flex items-center gap-2 mb-1">
        <Lock className="w-4 h-4 text-yellow-300" />
        <p className="text-sm font-medium text-yellow-200">
          AI guidance suppressed (§3.4 control window)
        </p>
      </div>
      <p className="text-xs text-[#8895c4] mb-3">{gate.reason}</p>
      <button
        onClick={onUnlock}
        className="text-xs text-yellow-200 hover:text-white border border-yellow-500/40 hover:border-yellow-500/70 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
      >
        <Unlock className="w-3 h-3" /> Unlock early (with reason)
      </button>
    </div>
  );
}

function UnlockModal({
  onClose,
  onUnlocked,
}: {
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (reason.trim().length < 20) {
      setError("Reason must be ≥20 chars.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/brain/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unlock failed.");
      onUnlocked();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="glass-card max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[#e8eaf6]">
            Unlock AI guidance early
          </h2>
          <button onClick={onClose} className="text-[#5a6399] hover:text-white text-lg">
            ×
          </button>
        </div>
        <p className="text-xs text-[#8895c4] mb-3 leading-relaxed">
          §3.4 reserves Month 1 as a control window — the AI is silent so the team&apos;s
          baseline can be captured honestly. Unlocking early is an explicit override. The
          reason is preserved on the brain&apos;s audit trail for §7.5 review of whether
          early-unlock cohorts produced worse outcomes than control-respecting ones.
        </p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Why does this team need the control window overridden? Be specific — this is on the record."
          className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3 py-2.5 text-sm text-[#e8eaf6] focus:outline-none focus:border-[#5470ff]/50 resize-none"
        />
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-3">
          <button onClick={onClose} className="text-xs text-[#5a6399] hover:text-[#8895c4] px-3 py-2">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting}
            className="flex items-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 disabled:opacity-40 text-yellow-200 font-semibold px-4 py-2 rounded-lg transition-all text-xs"
          >
            {submitting ? "Unlocking…" : "Unlock with reason"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-1.5 text-[10px] text-[#5a6399] uppercase tracking-widest mb-1">
        <span className="text-[#7a96ff]">{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-bold text-[#e8eaf6]">{value}</p>
    </div>
  );
}

function BrainList({
  title,
  icon,
  items,
  emptyText,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ primary: string; secondary: string }>;
  emptyText: string;
}) {
  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-sm font-semibold text-[#e8eaf6]">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-[#5a6399] leading-relaxed">{emptyText}</p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {items.map((item, i) => (
            <li key={i} className="p-2.5 bg-[#12141f] border border-[#252840] rounded-lg">
              <p className="text-xs text-[#e8eaf6]">{item.primary}</p>
              <p className="text-[10px] text-[#5a6399] mt-1 leading-relaxed">
                {item.secondary}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Hush unused-icon warnings for icons reserved for future variants.
void Clock;
