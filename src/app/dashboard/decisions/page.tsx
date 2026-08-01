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
import { useEffect, useMemo, useRef, useState } from "react";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";
import { LearningHint } from "@/components/learning/LearningHint";
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
  // Set when this dialogue was seeded from a C.A.R.E conversation
  // (?fromCareConversation=<id>). Drives the "seeded from…" banner.
  const [seededFrom, setSeededFrom] = useState<string | null>(null);
  // Task Spawn Engine — set when the user persists the dialogue.
  // Required to wire the spawn panel to the source decision row so
  // the resulting task gets linked_decision_id and the §3.1 chain
  // records lineage from dialogue → action.
  /** Scroll the Spawn-task button into view after persistence
   *  succeeds. Per audit (Agent 3): users persisted the dialogue,
   *  saw 'Persisted', and lost the connection to the now-visible
   *  Spawn affordance below. Auto-scroll fixes the continuity gap. */
  const spawnButtonRef = useRef<HTMLButtonElement | null>(null);
  // Synchronous re-entrancy latches: `persisting`/`loading` are React state, applied on the NEXT render, so a
  // double-click fires both handlers before the button disables. persistDecision writes IMMUTABLE decision +
  // decision_dialogue rows (0003 immutability trigger) — a double-write is unrecoverable Decision-Memory
  // corruption. A ref flips synchronously so the 2nd call bails.
  const persistingRef = useRef(false);
  const loadingRef = useRef(false);
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

  // Seed from a C.A.R.E conversation when arriving via
  // "Open as Decision Dialogue" (?fromCareConversation=<id>).
  //
  // The explicit click means "start a dialogue about THIS conversation," so the
  // seed wins over any restored draft: we clear the persisted dialogue and pre-load
  // the Situation phase with the customer's actual words (§3.3 — the decision stays
  // grounded in what was asked, not a paraphrase). We strip the query param afterward
  // (replaceState) so a later refresh doesn't re-seed over the agent's own edits, and
  // run the fetch only once on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const convId = new URLSearchParams(window.location.search).get(
      "fromCareConversation"
    );
    if (!convId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/care/conversations/${encodeURIComponent(convId)}/decision-seed`
        );
        if (!res.ok) {
          if (!cancelled)
            setError(
              "Couldn't load that conversation's context — starting a blank dialogue."
            );
          return;
        }
        const seed = (await res.json()) as {
          situation: string;
          sourceLabel: string;
        };
        if (cancelled) return;
        clearDialogue("decision");
        setPhase("situation");
        setSituation(seed.situation);
        setUserDiagnosis("");
        setUserProposal("");
        setResponse(null);
        setDecision(null);
        setRestoredFrom(null);
        setSeededFrom(seed.sourceLabel || "a C.A.R.E conversation");
      } catch {
        if (!cancelled)
          setError("Couldn't reach the server — starting a blank dialogue.");
      } finally {
        // Drop the param either way so refresh doesn't clobber later edits.
        window.history.replaceState(null, "", window.location.pathname);
      }
    })();
    return () => {
      cancelled = true;
    };
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
    // Already persisted this dialogue → a second click (the button re-enables after success) must not write a
    // DUPLICATE immutable decision + dialogue. This is the no-race trigger; the ref below covers the double-click.
    if (persistedDecisionId) return;
    if (persistingRef.current) return;
    persistingRef.current = true;
    setPersisting(true);
    setPersistMsg("");
    try {
      // Fall to the situation, then a generic label — the defer/hybrid paths often leave userProposal empty,
      // and `?? "Decision"` did NOT catch that (empty string isn't nullish) → a blank-titled row on the chain.
      const title = (
        userProposal.split("\n")[0]?.trim() ||
        situation.split("\n")[0]?.trim() ||
        "Decision"
      ).slice(0, 80);
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
        // Scroll the user's eye to the now-visible Spawn task
        // button. Without this, persistMsg surfaces success but
        // the next-action affordance lives off-screen.
        requestAnimationFrame(() => {
          spawnButtonRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        });
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
      persistingRef.current = false;
    }
  };

  const startElicit = () => {
    if (!situation.trim()) return;
    setError("");
    setPhase("elicit");
  };

  const requestSystemResponse = async () => {
    if (!userDiagnosis.trim() || !userProposal.trim()) return;
    if (loadingRef.current) return; // latch: a double-click must not fire two LLM requests whose results race
    loadingRef.current = true;
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
      loadingRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Decision Dialogue"
        subtitle={`${companyName} · Guide, don't overtake`}
      />

      <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
        {/* Constitution banner */}
        <div className="flex items-start gap-3 p-3 rounded-xl bg-ember-400/5 border border-ember-400/20">
          <Brain className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
          <p className="text-xs text-secondary leading-relaxed">
            The System will not assert a decision until you state your own diagnosis and
            proposal. This is the structural interrupt that prevents the System from
            overtaking you and turns the interaction into a dialogue instead of a directive.
            See <a href="/docs/GUIDE_DONT_OVERTAKE.md" className="text-brand underline">the rule</a>.
          </p>
        </div>

        {seededFrom && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-ember-400/5 border border-ember-400/20">
            <p className="text-xs text-primary">
              Seeded from a C.A.R.E conversation — <span className="text-secondary">{seededFrom}</span>.
              The Situation below carries the customer&apos;s own words; edit before you weigh in.
            </p>
            <button
              onClick={reset}
              className="text-xs text-primary hover:text-primary border border-ember-400/30 hover:border-ember-400/60 px-3 py-1 rounded-lg flex-shrink-0"
            >
              Clear
            </button>
          </div>
        )}
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
        <LearningHint
          as="block"
          category="Decision · Phase 1"
          title="Situation"
          whatItIs="The first phase of a Decision Dialogue. Describe the situation in your own words — what's happening, what triggered the need for a decision, what's at stake. The System is silent during this phase by design."
          why="Most decisions in teams start with the symptom and never name the underlying situation cleanly. The act of writing the situation down — before any analysis, before the System speaks — is the discipline. It forces clarity about what you're actually deciding about. Half of bad decisions are bad because the team was answering the wrong question; the situation phase prevents that failure mode."
          how="Write 2-5 sentences. Be concrete: dates, names, dollar amounts, specific events. Avoid framing-as-conclusion ('Marcus is overloaded' is a conclusion; 'Marcus has 4 active tasks and 2 overdue' is the situation). When you can describe the situation without using the words you'd use to recommend the answer, you've earned the right to continue."
          principle="The situation is the question you're actually answering. Get it wrong and every later phase compounds the error."
        ><PhaseCard
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
            className="w-full bg-surface border border-default rounded-xl px-4 py-3 text-sm text-secondary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
          />
          {phase === "situation" && (
            <div className="mt-3 flex items-center justify-end">
              <button
                onClick={startElicit}
                disabled={!situation.trim()}
                className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </PhaseCard></LearningHint>

        {/* Phase 2 — Elicit */}
        {phase !== "situation" && (
          <LearningHint
            as="block"
            category="Decision · Phase 2 · §3.3"
            title="Your read"
            whatItIs="The second phase. You state your diagnosis (what you think is actually going on) and your proposal (what you would do, and why). Both required. The System will NOT respond until you've stated both — this is structural, not a UI nudge."
            why="This is the load-bearing phase of the whole Dialogue. Most products let the AI speak first, which means the human anchors on the AI's framing rather than producing their own. ELOSTATE inverts that: you reason first, the System responds second. The result is that your judgment gets exercised and recorded BEFORE the System influences it. The §3.3 guide-don't-overtake discipline lives here."
            how="Write your real diagnosis — what you ACTUALLY think the situation is about. Don't pre-shape it for what you think the System will say. Then write your proposal: the action AND the reasoning. 'I would X because Y' is the shape. The System sees both before responding."
            principle="The System asks first, suggests second, never asserts. The reasoning is transferred to the human, not retained by the machine."
          ><PhaseCard
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
                  className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
                >
                  <MessageCircleQuestion className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
                  {loading ? "Asking the System…" : "Ask the System"}
                </button>
              </div>
            )}
          </PhaseCard></LearningHint>
        )}

        {/* Phase 3 — Respond */}
        {response && (
          <LearningHint
            as="block"
            category="Decision · Phase 3 · §3.3"
            title="System response"
            whatItIs="The third phase. The System responds in four parts: (1) Engages your diagnosis — names what it agrees with from what YOU said. (2) Adds perspective — surfaces something you may not have considered. (3) Offers a suggestion WITH explicit WHY. (4) Compares its suggestion to your proposal directly."
            why="The structure forbids the System from leading with 'here's what you should do.' It MUST engage your diagnosis first — anchoring the response in your reasoning, not its own. The suggestion comes with the WHY because the reasoning is the transferable asset; the action without reasoning is unrepeatable. The comparison is explicit so you can see where the System's view diverges from yours and judge accordingly."
            how="Read engagement first. If the System doesn't engage your actual diagnosis (just restates the situation), the response is hollow — push back. The added perspective is the highest-value part; consider it carefully. The suggestion with WHY is what you'll weigh in Phase 4. Don't accept it as a default."
            principle="The System's response is a perspective offered, not an answer asserted. You still decide."
          ><PhaseCard
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
              <div className="rounded-xl border border-ember-400/30 bg-ember-400/5 p-5">
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
                  className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
                >
                  Decide <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </PhaseCard></LearningHint>
        )}

        {/* Phase 4 — Decide */}
        {phase === "decide" && response && (
          <LearningHint
            as="block"
            category="Decision · Phase 4 · §3.5"
            title="Decide and record"
            whatItIs="The fourth phase. Four options: adopt YOUR proposal, adopt the SYSTEM's suggestion, hybrid (combine both), or defer (not enough understanding yet). The choice + reasoning gets recorded on the chain. Decisions become events; events become signals; the whole Dialogue survives the moment."
            why="Most decisions in teams evaporate the moment they're made. The reasoning is in someone's head, the choice is in a Slack message, the outcome is in someone else's spreadsheet. None of it connects. Decision Dialogue persists ALL OF IT structurally — your reasoning, the System's perspective, the chosen path, the why. Three months from now when the outcome lands (or doesn't), the audit trail is intact."
            how="Pick the option that matches what you actually decided — not the one you think looks best. Defer is a first-class option per §0 — an unearned decision is worse than no decision. Add a brief note if your choice needs context. Hit save. The Dialogue gets persisted; the System closes the loop by surfacing this decision when similar ones come back up."
            principle="A decision without recorded reasoning is a decision without a future. The Dialogue captures the WHY so it can be defended, learned from, and updated — months from now, not just in the moment."
          ><PhaseCard
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
                      disabled={persisting || !!persistedDecisionId || !supabaseEnabled}
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
                      type="button"
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
                          ref={spawnButtonRef}
                          type="button"
                          onClick={() => setSpawnPanelOpen(true)}
                          className="flex items-center gap-2 text-xs font-semibold text-primary bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-lg ring-1 ring-ember-400/30"
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
          </PhaseCard></LearningHint>
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
            {decisions.length === 0 && (
              <div className="text-center py-10 px-6">
                <p className="text-sm text-primary mb-2">
                  No decisions captured yet.
                </p>
                <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                  Use the dialogue above to walk through your first
                  decision — the situation, the options, your reasoning,
                  what you chose. The dialogue gets preserved so future
                  you (or your team) can see why this call was made, not
                  just what.
                </p>
              </div>
            )}
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
                  ? "bg-ember-400/15 border-ember-400/50 text-brand"
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
      className={`glass-card p-4 md:p-5 transition-opacity ${active ? "" : "opacity-60"}`}
    >
      <div className="flex items-baseline gap-2 mb-1 flex-wrap">
        <span className="text-[10px] font-mono text-brand">PHASE {number}</span>
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
      </div>
      <p className="text-xs text-muted mb-4 break-words">{subtitle}</p>
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
        className="w-full bg-surface border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
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
          ? "border-ember-400/60 bg-ember-400/10"
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
