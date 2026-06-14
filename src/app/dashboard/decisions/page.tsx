"use client";

import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { fetchDecisions, type DecisionRecord } from "@/lib/data/decisions";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  loadDialogue,
  saveDialogue,
  clearDialogue,
} from "@/lib/dialogues/persistence";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  GitCompareArrows,
  Lightbulb,
  MessageCircleQuestion,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";
import type { CoachContextPayload } from "@/lib/coach/v5/types";
import TaskRefinementPanel from "@/components/tasks/TaskRefinementPanel";
import type { SpawnContextPayload } from "@/lib/taskSpawn/types";

interface DialogueResponse {
  engagement: string;
  addedPerspective: string;
  suggestion: { action: string; why: string };
  comparison: string;
}

type Phase = "situation" | "elicit" | "respond" | "decide";

type Decision =
  | { kind: "user"; note: string }
  | { kind: "system"; note: string }
  | { kind: "hybrid"; note: string }
  | { kind: "defer"; note: string };

/** Snapshot persisted to localStorage so refresh / nav doesn't lose work. */
interface DecisionDialogueState {
  phase: Phase;
  situation: string;
  userDiagnosis: string;
  userProposal: string;
  response: DialogueResponse | null;
  decision: Decision | null;
}

const exampleSituation = `Operations efficiency dropped 9% this week. Two critical tasks are blocked — the payment gateway integration and the v2.4 product deploy. Marcus Chen (Lead Engineer) is overloaded with 4 active tasks and 2 overdue items. The v2.4 deploy is blocked until the gateway is fixed. The board wants a status update by Friday — 3 days from now.`;

export default function DecisionsPage() {
  const companyName = useCompanyName();
  const [phase, setPhase] = useState<Phase>("situation");
  const [situation, setSituation] = useState(exampleSituation);
  const [userDiagnosis, setUserDiagnosis] = useState("");
  const [userProposal, setUserProposal] = useState("");
  // Coach v5 — one ask-token per phase so the buttons don't cross-trigger.
  const [askSituationToken, setAskSituationToken] = useState(0);
  const [askDiagnosisToken, setAskDiagnosisToken] = useState(0);
  const [askProposalToken, setAskProposalToken] = useState(0);
  // contextPayloads scope what the Coach treats as prior context for
  // each phase (same pattern as InThreadDecisionDialogue).
  const situationPayload = useMemo<CoachContextPayload>(
    () => ({ decisionSituation: situation || undefined }),
    [situation]
  );
  const diagnosisPayload = useMemo<CoachContextPayload>(
    () => ({
      decisionSituation: situation || undefined,
      decisionPriorPhases: { situation: situation || undefined },
    }),
    [situation]
  );
  const proposalPayload = useMemo<CoachContextPayload>(
    () => ({
      decisionSituation: situation || undefined,
      decisionPriorPhases: {
        situation: situation || undefined,
        userRead: userDiagnosis || undefined,
      },
    }),
    [situation, userDiagnosis]
  );
  const [response, setResponse] = useState<DialogueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<Decision | null>(null);
  const [persisting, setPersisting] = useState(false);
  const [persistMsg, setPersistMsg] = useState("");
  const [decisions, setDecisions] = useState<DecisionRecord[]>([]);
  const [decisionsAreMock, setDecisionsAreMock] = useState(true);
  // Coach is a growth-aware participant in the user's own thinking
  // here (A8) — same mirror frame (A11) applies to the user writing
  // their diagnosis as to a message they send someone else.
  const { enabled: coachEnabled } = useCoachEnabled();
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null);
  // Task Spawn Engine — set when the user persists the dialogue.
  // Required to wire the spawn panel to the source decision row so
  // the resulting task gets linked_decision_id and the §3.1 chain
  // records lineage from dialogue → action.
  const [persistedDecisionId, setPersistedDecisionId] = useState<string | null>(
    null
  );
  const [spawnPanelOpen, setSpawnPanelOpen] = useState(false);

  // Restore in-progress dialogue from localStorage on mount.
  useEffect(() => {
    const persisted = loadDialogue<DecisionDialogueState>("decision");
    if (persisted) {
      setPhase(persisted.state.phase);
      setSituation(persisted.state.situation);
      setUserDiagnosis(persisted.state.userDiagnosis);
      setUserProposal(persisted.state.userProposal);
      setResponse(persisted.state.response);
      setDecision(persisted.state.decision);
      setRestoredFrom(persisted.savedAt);
    }
    fetchDecisions().then(({ decisions, isMock }) => {
      setDecisions(decisions);
      setDecisionsAreMock(isMock);
    });
  }, []);

  // Auto-save once the user has typed anything beyond the example situation.
  useEffect(() => {
    const isPristine =
      situation === exampleSituation &&
      !userDiagnosis.trim() &&
      !userProposal.trim() &&
      !response &&
      !decision;
    if (isPristine) return;
    saveDialogue<DecisionDialogueState>("decision", {
      phase,
      situation,
      userDiagnosis,
      userProposal,
      response,
      decision,
    });
  }, [phase, situation, userDiagnosis, userProposal, response, decision]);

  const reset = () => {
    setPhase("situation");
    setSituation(exampleSituation);
    setUserDiagnosis("");
    setUserProposal("");
    setResponse(null);
    setDecision(null);
    setError("");
    setPersistMsg("");
    setRestoredFrom(null);
    setPersistedDecisionId(null);
    setSpawnPanelOpen(false);
    clearDialogue("decision");
  };

  const persistDecision = async () => {
    if (!decision || !response) return;
    setPersisting(true);
    setPersistMsg("");
    try {
      const title = (userProposal.split("\n")[0] ?? "Decision").slice(0, 80);
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation,
          userDiagnosis,
          userProposal,
          systemResponse: response,
          chosenPath: decision.kind,
          chosenNote: decision.note,
          title,
          outcome:
            decision.kind === "defer"
              ? "Deferred — understanding not yet earned"
              : decision.note,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not persist.");
      setPersistMsg(`Persisted (id ${String(data.decisionId).slice(0, 8)}…).`);
      if (typeof data.decisionId === "string") {
        setPersistedDecisionId(data.decisionId);
      }
      const refreshed = await fetchDecisions();
      setDecisions(refreshed.decisions);
      setDecisionsAreMock(refreshed.isMock);
    } catch (err) {
      setPersistMsg(
        err instanceof Error ? `Not persisted: ${err.message}` : "Not persisted."
      );
    } finally {
      setPersisting(false);
    }
  };

  const startElicit = () => {
    if (!situation.trim()) return;
    setError("");
    setPhase("elicit");
  };

  const requestSystemResponse = async () => {
    if (!userDiagnosis.trim() || !userProposal.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/decision-dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation, userDiagnosis, userProposal }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not generate a response.");
      setResponse(data);
      setPhase("respond");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Decision Dialogue"
        subtitle={`${companyName} · Guide, don't overtake`}
      />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {/* Constitution banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#FACC15]/5 border border-[#FACC15]/20">
          <Brain className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
          <p className="text-xs text-secondary leading-relaxed">
            The System will not assert a decision until you state your own diagnosis and
            proposal. This is the structural interrupt that prevents the System from
            overtaking you and turns the interaction into a dialogue instead of a directive.
            See <a href="/docs/GUIDE_DONT_OVERTAKE.md" className="text-brand underline">the rule</a>.
          </p>
        </div>

        {restoredFrom && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-xs text-primary">
              Restored from local save ({restoredFrom.slice(0, 19).replace("T", " ")}).
              Continue or reset to start fresh.
            </p>
            <button
              onClick={reset}
              className="text-xs text-primary hover:text-primary border border-emerald-500/30 hover:border-emerald-500/60 px-3 py-1 rounded-lg"
            >
              Reset dialogue
            </button>
          </div>
        )}

        {/* Phase indicator */}
        <PhaseStepper current={phase} />

        {/* Phase 1 — Situation */}
        <PhaseCard
          active={phase === "situation"}
          number="1"
          title="Situation"
          subtitle="Describe what's happening. The System is silent."
        >
          {coachEnabled && phase === "situation" && (
            <>
              <CoachPanelV5
                draft={situation}
                contextType="decision_dialogue"
                contextPayload={situationPayload}
                askCoachToken={askSituationToken}
                onAcceptRevision={(revised) => setSituation(revised)}
              />
              <div className="mb-2 flex justify-end">
                <AskCoachButton
                  disabled={!situation.trim()}
                  onAsk={() => setAskSituationToken((t) => t + 1)}
                />
              </div>
            </>
          )}
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            disabled={phase !== "situation"}
            rows={5}
            className="w-full bg-surface border border-default rounded-xl px-4 py-3 text-sm text-secondary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
          />
          {phase === "situation" && (
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={startElicit}
                disabled={!situation.trim()}
                className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </PhaseCard>

        {/* Phase 2 — Elicit */}
        {phase !== "situation" && (
          <PhaseCard
            active={phase === "elicit"}
            number="2"
            title="Your read"
            subtitle="The System will not respond until you've stated both."
          >
            <div className="space-y-4">
              <ElicitField
                icon={<CircleHelp className="w-3.5 h-3.5" />}
                label="What do you think is actually going on?"
                value={userDiagnosis}
                onChange={setUserDiagnosis}
                disabled={phase !== "elicit"}
                placeholder="Diagnose the situation in your own words. The underlying cause, not just the symptom."
                {...(coachEnabled && phase === "elicit"
                  ? {
                      coachV5: {
                        contextPayload: diagnosisPayload,
                        askToken: askDiagnosisToken,
                        onAsk: () => setAskDiagnosisToken((t) => t + 1),
                      },
                    }
                  : {})}
              />
              <ElicitField
                icon={<Lightbulb className="w-3.5 h-3.5" />}
                label="What would you do, and why?"
                value={userProposal}
                onChange={setUserProposal}
                disabled={phase !== "elicit"}
                placeholder="State your proposal. The action AND the reasoning — what makes this the right move."
                {...(coachEnabled && phase === "elicit"
                  ? {
                      coachV5: {
                        contextPayload: proposalPayload,
                        askToken: askProposalToken,
                        onAsk: () => setAskProposalToken((t) => t + 1),
                      },
                    }
                  : {})}
              />
            </div>
            {error && <p className="text-xs text-red-400 mt-3">{error}</p>}
            {phase === "elicit" && (
              <div className="mt-4 flex items-center justify-between">
                <button
                  onClick={() => setPhase("situation")}
                  className="text-xs text-muted hover:text-secondary transition-colors"
                >
                  ← back to situation
                </button>
                <button
                  onClick={requestSystemResponse}
                  disabled={
                    loading || !userDiagnosis.trim() || !userProposal.trim()
                  }
                  className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
                >
                  <MessageCircleQuestion className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
                  {loading ? "Asking the System…" : "Ask the System"}
                </button>
              </div>
            )}
          </PhaseCard>
        )}

        {/* Phase 3 — Respond */}
        {response && (
          <PhaseCard
            active={phase === "respond"}
            number="3"
            title="System response"
            subtitle="Engagement first, then perspective, then a suggestion with WHY."
          >
            <div className="space-y-5">
              <ResponseBlock
                label="Engages your diagnosis"
                color="emerald"
                body={response.engagement}
              />
              {response.addedPerspective?.trim() && (
                <ResponseBlock
                  label="Adds perspective"
                  color="blue"
                  body={response.addedPerspective}
                />
              )}
              <div className="rounded-xl border border-[#FACC15]/30 bg-[#FACC15]/5 p-5">
                <p className="text-[10px] text-brand uppercase tracking-widest mb-2">
                  Suggestion
                </p>
                <p className="text-sm font-medium text-primary mb-3 leading-snug">
                  {response.suggestion.action}
                </p>
                <p className="text-[10px] text-muted uppercase tracking-widest mb-1">
                  Why
                </p>
                <p className="text-xs text-secondary leading-relaxed">
                  {response.suggestion.why}
                </p>
              </div>
              <ResponseBlock
                label="Compared to your proposal"
                color="violet"
                body={response.comparison}
                icon={<GitCompareArrows className="w-3.5 h-3.5" />}
              />
            </div>

            {phase === "respond" && (
              <div className="mt-5 flex items-center justify-between">
                <button
                  onClick={() => setPhase("elicit")}
                  className="text-xs text-muted hover:text-secondary transition-colors"
                >
                  ← revise my read
                </button>
                <button
                  onClick={() => setPhase("decide")}
                  className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
                >
                  Decide <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </PhaseCard>
        )}

        {/* Phase 4 — Decide */}
        {phase === "decide" && response && (
          <PhaseCard
            active={true}
            number="4"
            title="Decide and record"
            subtitle="The dialogue is preserved with the outcome. The WHY survives the moment."
          >
            <div className="space-y-3">
              <DecisionChoice
                label="Go with my proposal"
                description="Your original proposal stands. The System's perspective is on record but not adopted."
                selected={decision?.kind === "user"}
                onSelect={() => setDecision({ kind: "user", note: userProposal })}
              />
              <DecisionChoice
                label="Go with the System's suggestion"
                description="Adopt the System's suggestion as-is. The why is preserved."
                selected={decision?.kind === "system"}
                onSelect={() =>
                  setDecision({ kind: "system", note: response.suggestion.action })
                }
              />
              <DecisionChoice
                label="Hybrid"
                description="Combine elements of both. Describe what you're actually doing."
                selected={decision?.kind === "hybrid"}
                onSelect={() => setDecision({ kind: "hybrid", note: "" })}
              />
              <DecisionChoice
                label="Defer — not enough understanding yet"
                description="Per Rule 0, an unearned decision is worse than no decision. Capture this state and return later."
                selected={decision?.kind === "defer"}
                onSelect={() => setDecision({ kind: "defer", note: "" })}
              />

              {decision && (
                <div className="mt-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <p className="text-sm font-medium text-primary">
                      Choice noted ({decision.kind}).
                    </p>
                  </div>
                  <p className="text-xs text-secondary">
                    The full dialogue — situation, your diagnosis, your proposal, the
                    System&apos;s response, and this choice — can be persisted now so the
                    WHY survives past the moment.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={persistDecision}
                      disabled={persisting || !supabaseEnabled}
                      className="flex items-center gap-2 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-primary font-semibold px-4 py-2 rounded-lg transition-all text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {persisting
                        ? "Persisting…"
                        : supabaseEnabled
                        ? "Persist dialogue"
                        : "Persist (live mode only)"}
                    </button>
                    <button
                      onClick={reset}
                      className="flex items-center gap-2 text-xs text-brand hover:text-primary"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Start a new dialogue
                    </button>
                    {persistedDecisionId &&
                      decision.kind !== "defer" &&
                      response && (
                        <button
                          onClick={() => setSpawnPanelOpen(true)}
                          className="flex items-center gap-2 text-xs font-semibold text-primary bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-lg"
                        >
                          <Sparkles className="w-3 h-3" />
                          Spawn task from this decision
                        </button>
                      )}
                  </div>
                  {persistMsg && (
                    <p className="mt-2 text-xs text-secondary">{persistMsg}</p>
                  )}
                </div>
              )}
            </div>
          </PhaseCard>
        )}

        {/* Decision Memory */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-primary">Decision Memory</h2>
            <span className="text-xs text-muted">
              {decisions.length} decisions stored
              {decisionsAreMock ? " (demo — no live data yet)" : ""}
            </span>
          </div>
          <div className="space-y-3">
            {decisions.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between p-3 rounded-xl bg-surface border border-default"
              >
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-primary">{d.title}</p>
                    <p className="text-xs text-muted mt-0.5">
                      {d.date} · {d.outcome}
                      {d.hasDialogue && (
                        <span className="ml-2 text-emerald-400">· dialogue preserved</span>
                      )}
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    d.executionStatus === "In Progress"
                      ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                      : d.executionStatus === "Blocked"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : d.executionStatus === "Deferred"
                      ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {d.executionStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {persistedDecisionId && decision && response && decision.kind !== "defer" && (
        <TaskRefinementPanel
          open={spawnPanelOpen}
          onClose={() => setSpawnPanelOpen(false)}
          contextType="decision"
          contextPayload={
            {
              decisionId: persistedDecisionId,
              decisionSituation: situation,
              decisionDiagnosis: userDiagnosis,
              decisionProposal: userProposal,
              decisionSystemResponse: response as unknown as Record<
                string,
                unknown
              >,
              decisionChosenPath: decision.kind,
              decisionChosenNote: decision.note,
            } satisfies SpawnContextPayload
          }
          onSaved={() => {
            // Stay on the decisions page; the toast inside the panel
            // confirms the save. Closing the panel returns the user
            // to the dialogue summary where they can spawn additional
            // tasks if the decision implied several work threads.
          }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function PhaseStepper({ current }: { current: Phase }) {
  const order: Phase[] = ["situation", "elicit", "respond", "decide"];
  const labels = {
    situation: "Situation",
    elicit: "Your read",
    respond: "System",
    decide: "Decide",
  };
  return (
    <div className="flex items-center gap-2">
      {order.map((p, i) => {
        const reached = order.indexOf(current) >= i;
        const active = current === p;
        return (
          <div key={p} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? "bg-[#FACC15]/15 border-[#FACC15]/50 text-brand"
                  : reached
                  ? "border-default text-secondary"
                  : "border-default text-muted"
              }`}
            >
              <span className="font-mono">{i + 1}</span>
              {labels[p]}
            </div>
            {i < order.length - 1 && (
              <ChevronRight className="w-3 h-3 text-muted" />
            )}
          </div>
        );
      })}
    </div>
  );
}

function PhaseCard({
  active,
  number,
  title,
  subtitle,
  children,
}: {
  active: boolean;
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`glass-card p-5 transition-opacity ${active ? "" : "opacity-60"}`}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] font-mono text-brand">PHASE {number}</span>
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
      </div>
      <p className="text-xs text-muted mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function ElicitField({
  icon,
  label,
  value,
  onChange,
  disabled,
  placeholder,
  coachV5,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
  placeholder: string;
  /** When provided, mounts CoachPanelV5 + AskCoachButton around the
   *  textarea. Undefined = no Coach surface. */
  coachV5?: {
    contextPayload: CoachContextPayload;
    askToken: number;
    onAsk: () => void;
  };
}) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-secondary mb-1.5">
        <span className="text-brand">{icon}</span>
        {label}
      </label>
      {coachV5 && (
        <CoachPanelV5
          draft={value}
          contextType="decision_dialogue"
          contextPayload={coachV5.contextPayload}
          askCoachToken={coachV5.askToken}
          onAcceptRevision={(revised) => onChange(revised)}
        />
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={3}
        placeholder={placeholder}
        className="w-full bg-surface border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
      />
      {coachV5 && (
        <div className="mt-1 flex justify-end">
          <AskCoachButton
            disabled={!value.trim() || disabled}
            onAsk={coachV5.onAsk}
          />
        </div>
      )}
    </div>
  );
}

function ResponseBlock({
  label,
  body,
  color,
  icon,
}: {
  label: string;
  body: string;
  color: "emerald" | "blue" | "violet";
  icon?: React.ReactNode;
}) {
  const styles = {
    emerald: "bg-emerald-500/5 border-emerald-500/20 text-emerald-300",
    blue: "bg-blue-500/5 border-blue-500/20 text-blue-300",
    violet: "bg-violet-500/5 border-violet-500/20 text-violet-300",
  }[color];
  return (
    <div className={`rounded-xl border p-4 ${styles}`}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-2 opacity-80">
        {icon}
        {label}
      </p>
      <p className="text-sm text-primary leading-relaxed">{body}</p>
    </div>
  );
}

function DecisionChoice({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected
          ? "border-[#FACC15]/60 bg-[#FACC15]/10"
          : "border-default bg-surface hover:border-strong"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {selected && <CheckCircle2 className="w-3.5 h-3.5 text-brand" />}
        <span className="text-sm font-medium text-primary">{label}</span>
      </div>
      <p className="text-xs text-muted leading-relaxed">{description}</p>
    </button>
  );
}
