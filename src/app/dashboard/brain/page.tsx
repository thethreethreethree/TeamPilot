"use client";

import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { supabaseEnabled } from "@/lib/supabase/client";
import Modal from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Field";
import { LearningVisibleSection } from "@/components/brain/LearningVisibleSection";
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
      let data: { summary?: string; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        // JSON parse failure means the route returned non-JSON
        // (HTML error page, empty body, etc.). Distinguish from
        // a structured server-side rejection.
        if (!res.ok) {
          setLearnMessage(
            `Learning cycle failed — server returned ${res.status}.`
          );
          return;
        }
      }
      if (!res.ok) {
        setLearnMessage(
          data.error ?? `Learning cycle failed (status ${res.status}).`
        );
        return;
      }
      setLearnMessage(data.summary ?? "Done.");
      await refresh();
    } catch (err) {
      setLearnMessage(
        err instanceof Error
          ? `Learning cycle failed — ${err.message}`
          : "Learning cycle failed (network error)."
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
    <div className="min-h-screen bg-base">
      <TopBar
        title="Company Brain"
        subtitle="What the System has learned about this team · §3.4, §3.6"
      />

      <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
        {/* §3.6 — Learning Visible. Surfaces what the System has
            noticed about this team from the §3.1 chain: Coach pattern
            observations, decision durability, topic resolutions,
            chain growth vs prior period. Mounted at the top so the
            user sees evidence of accumulating learning before the
            brain-internals scroll below. */}
        <LearningVisibleSection />

        <div className="flex items-start gap-3 p-3 rounded-xl bg-ember-400/5 border border-ember-400/20">
          <BrainIcon className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
          <p className="text-xs text-secondary leading-relaxed">
            The brain accumulates per-company learning from the §3.1 chain. Only
            outcomes that have <strong>held</strong> (§3.5) and problems explicitly{" "}
            <strong>dismissed</strong> count toward validated learning. Acceptance is not
            consequence. Every change is on the immutable audit trail below.
          </p>
        </div>

        {!supabaseEnabled && (
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-300 mx-auto mb-2" />
            <p className="text-sm text-primary mb-1">Live mode required</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              The brain is a per-company DB record. Configure Supabase to use this surface.
            </p>
          </div>
        )}

        {supabaseEnabled && loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading brain…
          </div>
        )}

        {supabaseEnabled && !loading && !state && (
          <div className="glass-card p-6 text-center">
            <p className="text-sm text-primary mb-2">No brain available.</p>
            <p className="text-xs text-muted">
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
                  <h2 className="text-sm font-semibold text-primary">
                    Learning cycle
                  </h2>
                  <p className="text-xs text-muted mt-1">
                    Distills recent <strong>held</strong> resolutions and dismissed
                    problems into structured brain updates. Conservative by design — empty
                    cycles are correct when the chain has not produced validated evidence.
                  </p>
                </div>
                <LearningHint
                  category="Brain · §1.6"
                  title="Run learning cycle"
                  whatItIs="Manually triggers the learning cycle — the System reads the team's accumulated HELD resolutions and DISMISSED problems from the recent window and distills them into structured brain updates. Conservative by design: most cycles return zero updates because the chain hasn't produced validated evidence yet."
                  why="The Brain shapes every AI call on this tenant. Without periodic learning cycles it stays static and gradually drifts from the team's actual patterns. The cycle is conservative because the wrong shape of learning (over-fitting to a single dismissed problem, for example) would teach the Brain to behave worse, not better. Empty cycles ARE the correct output when the chain hasn't earned a real lesson."
                  how="Run it after a meaningful batch of resolutions has accumulated (typically every 2-4 weeks of normal operation). Read the output. If it's empty, that's honest. If it has updates, they get applied to the Brain composition layer and influence future AI outputs."
                  principle="A learning system that learns when it has nothing to learn is worse than one that stays silent. The cycle's conservatism is the feature."
                >
                  <button
                    onClick={triggerLearning}
                    disabled={learning}
                    className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs flex-shrink-0"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${learning ? "animate-spin" : ""}`} />
                    {learning ? "Running…" : "Run learning cycle"}
                  </button>
                </LearningHint>
              </div>
              {learnMessage && (
                <p className="text-xs text-secondary mt-2">{learnMessage}</p>
              )}
              {state.brain.lastLearningAt && (
                <p className="text-[10px] text-muted mt-2 font-mono">
                  Last run: {state.brain.lastLearningAt.slice(0, 19).replace("T", " ")} ·{" "}
                  {state.brain.lastLearningSummary}
                </p>
              )}
            </div>

            {/* System prompt addendum preview */}
            {state.brain.systemPromptAddendum && (
              <div className="glass-card p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-4 h-4 text-brand" />
                  <h2 className="text-sm font-semibold text-primary">
                    System prompt addendum (injected into every LLM call)
                  </h2>
                </div>
                <pre className="text-xs text-secondary whitespace-pre-wrap leading-relaxed bg-surface border border-default rounded-xl p-4 max-h-72 overflow-y-auto">
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
              <h2 className="text-sm font-semibold text-primary mb-3">
                Evolution audit ({state.evolution.length} entries)
              </h2>
              {state.evolution.length === 0 ? (
                <p className="text-xs text-muted py-4">
                  No evolution events yet. Each entry below would represent one
                  brain update, immutable on the record (per §3.1).
                </p>
              ) : (
                <ul className="space-y-2 max-h-96 overflow-y-auto pr-2">
                  {state.evolution.map((e) => (
                    <li
                      key={e.id}
                      className="p-3 bg-surface border border-default rounded-xl"
                    >
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface-raised text-secondary">
                          {e.kind}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-widest font-medium ${
                            e.confidence === "high"
                              ? "text-emerald-300"
                              : e.confidence === "medium"
                              ? "text-blue-300"
                              : "text-muted"
                          }`}
                        >
                          {e.confidence}
                        </span>
                        <span className="text-[10px] text-muted font-mono">
                          v{e.brainVersionBefore} → v{e.brainVersionAfter}
                        </span>
                      </div>
                      <p className="text-sm text-primary">{e.claim}</p>
                      <p className="text-xs text-secondary mt-1 leading-relaxed">
                        {e.reasoning}
                      </p>
                      <p className="text-[10px] text-muted mt-1 font-mono">
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
          <p className="text-sm font-medium text-primary">
            AI guidance enabled
          </p>
        </div>
        <p className="text-xs text-secondary">
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
        <p className="text-sm font-medium text-primary">
          AI guidance suppressed (§3.4 control window)
        </p>
      </div>
      <p className="text-xs text-secondary mb-3">{gate.reason}</p>
      <button
        onClick={onUnlock}
        className="text-xs text-primary hover:text-primary border border-yellow-500/40 hover:border-yellow-500/70 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5"
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
      setError(
        `Reason needs at least 20 characters (currently ${reason.trim().length}). This lands on the audit trail — be specific.`
      );
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
    <Modal open onClose={onClose} title="Unlock AI guidance early" size="md">
      <div aria-busy={submitting}>
        <p className="text-xs text-secondary mb-3 leading-relaxed">
          §3.4 reserves Month 1 as a control window — the AI is silent so the
          team&apos;s baseline can be captured honestly. Unlocking early is an
          explicit override. The reason is preserved on the brain&apos;s audit
          trail for §7.5 review of whether early-unlock cohorts produced worse
          outcomes than control-respecting ones.
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Why does this team need the control window overridden? Be specific — this is on the record."
        />
        <div className="flex items-center justify-end mt-1">
          <p
            className={`text-[10px] tabular-nums ${
              reason.trim().length < 20 ? "text-muted" : "text-emerald-400"
            }`}
          >
            {reason.trim().length} / 20+ chars
          </p>
        </div>
        {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
        <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-base/95 backdrop-blur-sm border-t border-default flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-xs text-muted hover:text-secondary px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting || reason.trim().length < 20}
            className="flex items-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 disabled:opacity-40 text-primary font-semibold px-4 py-2 rounded-lg transition-all text-xs"
          >
            {submitting ? "Unlocking…" : "Unlock with reason"}
          </button>
        </div>
      </div>
    </Modal>
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
      <div className="flex items-center gap-1.5 text-[10px] text-muted uppercase tracking-widest mb-1">
        <span className="text-brand">{icon}</span>
        {label}
      </div>
      <p className="text-2xl font-bold text-primary">{value}</p>
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
        <h3 className="text-sm font-semibold text-primary">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted leading-relaxed">{emptyText}</p>
      ) : (
        <ul className="space-y-2 max-h-80 overflow-y-auto pr-2">
          {items.map((item, i) => (
            <li key={i} className="p-2.5 bg-surface border border-default rounded-lg">
              <p className="text-xs text-primary">{item.primary}</p>
              <p className="text-[10px] text-muted mt-1 leading-relaxed">
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
