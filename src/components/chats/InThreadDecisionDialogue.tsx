"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  GitCompareArrows,
  Lightbulb,
  MessageCircleQuestion,
  RotateCcw,
  X,
} from "lucide-react";
import {
  decideTopicDecision,
  requestTopicDecisionSystemResponse,
  saveTopicDecision,
  type TopicDecision,
  type TopicDecisionChosenPath,
} from "@/lib/data/topicDecisions";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import { LearningHint } from "@/components/learning/LearningHint";
import type { CoachContextPayload } from "@/lib/coach/v5/types";

/**
 * InThreadDecisionDialogue — renders the 4-phase Decision Dialogue
 * inline in a chat topic.
 *
 * Constitutional positioning (§3.3): The dialogue is the structural
 * interrupt that prevents the System from overtaking the user.
 * Surfacing it INSIDE the conversation rather than on a separate page
 * means the discipline runs where decisions actually get made — in
 * the thread the team is using. The conversation history sits above
 * the card as the working context.
 *
 * State strategy: the dialogue row is the source of truth. Local
 * state mirrors the typed text so the textarea feels responsive; a
 * debounced save flushes to the server. Phase advancement is a
 * deliberate user action (Continue button), not auto-advance — the
 * server validates the gating fields are non-empty.
 *
 * Coach (§A11 mirror frame): mounted on every user-input textarea
 * with a subject scoped to the dialogue id so the mirror chip's count
 * is meaningful WITHIN this dialogue, not bled across topics.
 */

const SAVE_DEBOUNCE_MS = 800;

export function InThreadDecisionDialogue({
  decision,
  coachOn,
  iAmAdmin,
  onChange,
  onOpenNew,
  onDismissFolded,
}: {
  decision: TopicDecision;
  /** Either company-wide or per-topic Coach flag — same logic the
   *  composer uses. The dialogue surface uses one flag end-to-end. */
  coachOn: boolean;
  iAmAdmin: boolean;
  /** Called whenever the dialogue row mutates so the parent page can
   *  refresh the message stream (each phase advance posts a system
   *  message that needs to render). */
  onChange: (next: TopicDecision) => void;
  /** Folded-decided view "Open new dialogue" handler. */
  onOpenNew: () => void;
  /** Folded-decided view dismiss handler — hides the card client-side
   *  for this session. The decision row itself stays on the chain;
   *  this is a UI-only "I've seen it" affordance. */
  onDismissFolded?: () => void;
}) {
  // ─── Local draft state — mirrors the row, debounce-saved ────
  const [situation, setSituation] = useState(decision.situation);
  const [userDiagnosis, setUserDiagnosis] = useState(decision.userDiagnosis);
  const [userProposal, setUserProposal] = useState(decision.userProposal);
  const [chosenNote, setChosenNote] = useState(decision.chosenNote);
  const [chosenPath, setChosenPath] =
    useState<TopicDecisionChosenPath | null>(decision.chosenPath);

  // ─── Async ──────────────────────────────────────────────────
  const [advancing, setAdvancing] = useState(false);
  const [askingSystem, setAskingSystem] = useState(false);
  const [deciding, setDeciding] = useState(false);
  const [error, setError] = useState("");

  // Coach v5 Ask-Coach tokens — one per field that mounts the Coach.
  // Incrementing a token triggers an active analysis on that specific
  // field's Coach panel without affecting the others.
  const [askSituationToken, setAskSituationToken] = useState(0);
  const [askDiagnosisToken, setAskDiagnosisToken] = useState(0);
  const [askProposalToken, setAskProposalToken] = useState(0);

  // Coach v5 contextPayload builders — each field has its own context
  // because what counts as "prior content" depends on the phase. The
  // Coach reading the Situation field has nothing prior (it's the
  // first thing being written); reading Diagnosis has the Situation as
  // context; reading Proposal has both Situation + Diagnosis.
  const situationContextPayload = useMemo<CoachContextPayload>(
    () => ({
      decisionSituation: situation || undefined,
    }),
    [situation]
  );
  const diagnosisContextPayload = useMemo<CoachContextPayload>(
    () => ({
      decisionSituation: situation || undefined,
      decisionPriorPhases: {
        situation: situation || undefined,
      },
    }),
    [situation]
  );
  const proposalContextPayload = useMemo<CoachContextPayload>(
    () => ({
      decisionSituation: situation || undefined,
      decisionPriorPhases: {
        situation: situation || undefined,
        userRead: userDiagnosis || undefined,
      },
    }),
    [situation, userDiagnosis]
  );

  // When the row changes from the parent (e.g. after a refresh), sync
  // local state — but only fields the user isn't currently editing
  // would conflict on. Phase changes always sync.
  const lastSyncedId = useRef(decision.id);
  useEffect(() => {
    if (lastSyncedId.current !== decision.id) {
      setSituation(decision.situation);
      setUserDiagnosis(decision.userDiagnosis);
      setUserProposal(decision.userProposal);
      setChosenNote(decision.chosenNote);
      setChosenPath(decision.chosenPath);
      lastSyncedId.current = decision.id;
    }
  }, [
    decision.id,
    decision.situation,
    decision.userDiagnosis,
    decision.userProposal,
    decision.chosenNote,
    decision.chosenPath,
  ]);

  // ─── Debounced auto-save of draft text ──────────────────────
  // Each text field gets its own debounce so a fast typist doesn't
  // race three saves. We only fire when the value diverges from the
  // server-side value to avoid no-op saves.
  useDebouncedSave({
    enabled: decision.phase !== "decided",
    value: situation,
    base: decision.situation,
    save: async (v) => {
      const updated = await saveTopicDecision(decision.id, { situation: v });
      onChange(updated);
    },
  });
  useDebouncedSave({
    enabled: decision.phase !== "decided",
    value: userDiagnosis,
    base: decision.userDiagnosis,
    save: async (v) => {
      const updated = await saveTopicDecision(decision.id, {
        userDiagnosis: v,
      });
      onChange(updated);
    },
  });
  useDebouncedSave({
    enabled: decision.phase !== "decided",
    value: userProposal,
    base: decision.userProposal,
    save: async (v) => {
      const updated = await saveTopicDecision(decision.id, {
        userProposal: v,
      });
      onChange(updated);
    },
  });

  // ─── Phase advance ──────────────────────────────────────────
  const advance = async (to: "elicit" | "decide") => {
    setAdvancing(true);
    setError("");
    try {
      // Flush any in-flight text so the server has the latest before
      // it validates the advancement gating fields.
      const patch =
        to === "elicit"
          ? { situation, phase: to }
          : { phase: to };
      const updated = await saveTopicDecision(decision.id, patch);
      onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not advance.");
    } finally {
      setAdvancing(false);
    }
  };

  const askSystem = async () => {
    setAskingSystem(true);
    setError("");
    try {
      // Persist current diagnosis/proposal before asking.
      await saveTopicDecision(decision.id, { userDiagnosis, userProposal });
      const updated = await requestTopicDecisionSystemResponse(decision.id);
      onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "System didn't respond.");
    } finally {
      setAskingSystem(false);
    }
  };

  const finalize = async () => {
    if (!chosenPath) return;
    setDeciding(true);
    setError("");
    try {
      const updated = await decideTopicDecision(
        decision.id,
        chosenPath,
        chosenNote
      );
      onChange(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not record decision.");
    } finally {
      setDeciding(false);
    }
  };

  // ─── Decided (folded) view ──────────────────────────────────
  if (decision.phase === "decided") {
    return (
      <FoldedDecided
        decision={decision}
        iAmAdmin={iAmAdmin}
        onOpenNew={onOpenNew}
        onDismiss={onDismissFolded}
      />
    );
  }

  // ─── Active 4-phase view ────────────────────────────────────
  const phase = decision.phase;

  return (
    <div className="mb-3 rounded-xl border border-ember-400/30 bg-ember-400/[0.03] overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-ember-400/20 bg-ember-400/[0.06]">
        <div className="flex items-center gap-2">
          <Brain className="w-3.5 h-3.5 text-brand" aria-hidden />
          <span className="text-[11px] font-semibold text-brand uppercase tracking-widest">
            Decision Dialogue
          </span>
        </div>
        <PhaseStepper current={phase} />
      </div>

      <div className="p-4 space-y-3">
        {/* Phase 1 — Situation */}
        <PhaseCard active={phase === "situation"} number="1" title="Situation">
          {coachOn && phase === "situation" && (
            <CoachPanelV5
              draft={situation}
              contextType="decision_dialogue"
              contextPayload={situationContextPayload}
              askCoachToken={askSituationToken}
              onAcceptRevision={(revised) => setSituation(revised)}
            />
          )}
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            disabled={phase !== "situation"}
            rows={4}
            placeholder="What's happening, in your words. State the facts of the case before anyone proposes a fix."
            className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
          />
          {phase === "situation" && (
            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              {coachOn ? (
                <AskCoachButton
                  disabled={!situation.trim()}
                  onAsk={() => setAskSituationToken((t) => t + 1)}
                />
              ) : <span />}
              <button
                type="button"
                onClick={() => void advance("elicit")}
                disabled={!situation.trim() || advancing}
                className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-colors text-xs"
              >
                {advancing ? "Saving…" : "Continue"}
                <ChevronRight className="w-3.5 h-3.5" aria-hidden />
              </button>
            </div>
          )}
        </PhaseCard>

        {/* Phase 2 — Elicit */}
        {phase !== "situation" && (
          <PhaseCard active={phase === "elicit"} number="2" title="Your read">
            <p className="text-[11px] text-muted mb-2">
              The System will not respond until you&apos;ve stated both.
            </p>
            <div className="space-y-3">
              <ElicitField
                icon={<CircleHelp className="w-3.5 h-3.5" />}
                label="What do you think is actually going on?"
                value={userDiagnosis}
                onChange={setUserDiagnosis}
                disabled={phase !== "elicit"}
                placeholder="Diagnose in your own words. The underlying cause, not the symptom."
                {...(coachOn && phase === "elicit"
                  ? {
                      coachV5: {
                        contextPayload: diagnosisContextPayload,
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
                placeholder="The action AND the reasoning — what makes this the right move."
                {...(coachOn && phase === "elicit"
                  ? {
                      coachV5: {
                        contextPayload: proposalContextPayload,
                        askToken: askProposalToken,
                        onAsk: () => setAskProposalToken((t) => t + 1),
                      },
                    }
                  : {})}
              />
            </div>
            {phase === "elicit" && (
              <div className="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => void askSystem()}
                  disabled={
                    askingSystem ||
                    !userDiagnosis.trim() ||
                    !userProposal.trim()
                  }
                  className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-colors text-xs"
                >
                  <MessageCircleQuestion
                    className={`w-3.5 h-3.5 ${askingSystem ? "animate-pulse" : ""}`}
                    aria-hidden
                  />
                  {askingSystem ? "Asking the System…" : "Ask the System"}
                </button>
              </div>
            )}
          </PhaseCard>
        )}

        {/* Phase 3 — Respond */}
        {decision.systemResponse && (
          <PhaseCard
            active={phase === "respond"}
            number="3"
            title="System response"
          >
            <p className="text-[11px] text-muted mb-3">
              Engagement first, then perspective, then a suggestion with WHY.
            </p>
            <div className="space-y-2.5">
              <ResponseBlock
                label="Engages your diagnosis"
                color="emerald"
                body={decision.systemResponse.engagement}
              />
              {decision.systemResponse.addedPerspective?.trim() && (
                <ResponseBlock
                  label="Adds perspective"
                  color="blue"
                  body={decision.systemResponse.addedPerspective}
                />
              )}
              <div className="rounded-lg border border-ember-400/30 bg-ember-400/5 p-3">
                <p className="text-[10px] text-brand uppercase tracking-widest mb-1.5">
                  Suggestion
                </p>
                <p className="text-xs font-medium text-primary mb-2 leading-snug">
                  {decision.systemResponse.suggestion.action}
                </p>
                <p className="text-[10px] text-muted uppercase tracking-widest mb-0.5">
                  Why
                </p>
                <p className="text-xs text-secondary leading-relaxed">
                  {decision.systemResponse.suggestion.why}
                </p>
              </div>
              <ResponseBlock
                label="Compared to your proposal"
                color="violet"
                body={decision.systemResponse.comparison}
                icon={<GitCompareArrows className="w-3 h-3" />}
              />
            </div>
            {phase === "respond" && (
              <div className="mt-3 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => void advance("decide")}
                  disabled={advancing}
                  className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg transition-colors text-xs"
                >
                  {advancing ? "Saving…" : "Decide"}
                  <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                </button>
              </div>
            )}
          </PhaseCard>
        )}

        {/* Phase 4 — Decide */}
        {phase === "decide" && decision.systemResponse && (
          <PhaseCard active number="4" title="Decide and record">
            <div className="space-y-2">
              <DecisionChoice
                label="Go with my proposal"
                description="Your original proposal stands. The System's perspective is on record but not adopted."
                selected={chosenPath === "user"}
                onSelect={() => {
                  setChosenPath("user");
                  setChosenNote(userProposal);
                }}
              />
              <DecisionChoice
                label="Go with the System's suggestion"
                description="Adopt the System's suggestion as-is. The why is preserved."
                selected={chosenPath === "system"}
                onSelect={() => {
                  setChosenPath("system");
                  setChosenNote(
                    decision.systemResponse?.suggestion.action ?? ""
                  );
                }}
              />
              <DecisionChoice
                label="Hybrid"
                description="Combine elements of both. Describe what you're actually doing."
                selected={chosenPath === "hybrid"}
                onSelect={() => {
                  setChosenPath("hybrid");
                  if (!chosenNote) setChosenNote("");
                }}
              />
              <DecisionChoice
                label="Defer — not enough understanding yet"
                description="Per Rule 0, an unearned decision is worse than no decision. Capture this state and return later."
                selected={chosenPath === "defer"}
                onSelect={() => {
                  setChosenPath("defer");
                  setChosenNote("");
                }}
              />

              {(chosenPath === "hybrid" || chosenPath === "defer") && (
                <textarea
                  value={chosenNote}
                  onChange={(e) => setChosenNote(e.target.value)}
                  rows={2}
                  placeholder={
                    chosenPath === "hybrid"
                      ? "Describe the combined approach you're actually adopting."
                      : "What's the gap in understanding that justified deferring?"
                  }
                  className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-none leading-relaxed"
                />
              )}

              {chosenPath && (
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void finalize()}
                    disabled={
                      deciding ||
                      (chosenPath === "hybrid" && !chosenNote.trim())
                    }
                    className="flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 disabled:opacity-40 text-primary font-semibold px-3 py-1.5 rounded-lg transition-colors text-xs"
                  >
                    <CheckCircle2 className="w-3 h-3" aria-hidden />
                    {deciding ? "Recording…" : "Record decision"}
                  </button>
                </div>
              )}
            </div>
          </PhaseCard>
        )}

        {error && (
          <p className="text-[11px] text-red-400" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Folded decided view ───────────────────────────────────

function FoldedDecided({
  decision,
  iAmAdmin,
  onOpenNew,
  onDismiss,
}: {
  decision: TopicDecision;
  iAmAdmin: boolean;
  onOpenNew: () => void;
  onDismiss?: () => void;
}) {
  const pathLabel: Record<TopicDecisionChosenPath, string> = {
    user: "Went with the proposal",
    system: "Went with the System's suggestion",
    hybrid: "Hybrid",
    defer: "Deferred — understanding not yet earned",
  };
  const label = decision.chosenPath
    ? pathLabel[decision.chosenPath]
    : "Decision recorded";
  const noteSnippet = decision.chosenNote
    ? decision.chosenNote.length > 120
      ? `${decision.chosenNote.slice(0, 120)}…`
      : decision.chosenNote
    : null;

  // Swipe-to-dismiss state. The card sits directly above the
  // composer on mobile, where a horizontal swipe is the natural
  // gesture for "I'm done looking at this." We use a damped drag
  // model — past 80px the release commits to dismiss; below it,
  // we snap back. Only enabled when onDismiss is supplied.
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const dirRef = useRef<"horizontal" | "vertical" | null>(null);
  const [dragX, setDragX] = useState(0);
  const THRESHOLD = 80;

  const onTouchStart = (e: React.TouchEvent) => {
    if (!onDismiss) return;
    const t = e.touches[0];
    if (!t) return;
    startX.current = t.clientX;
    startY.current = t.clientY;
    dirRef.current = null;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!onDismiss || startX.current == null || startY.current == null) return;
    const t = e.touches[0];
    if (!t) return;
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (dirRef.current == null) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      if (absX < 8 && absY < 8) return;
      dirRef.current = absX > absY ? "horizontal" : "vertical";
    }
    if (dirRef.current === "vertical") return;
    setDragX(dx);
  };
  const onTouchEnd = () => {
    if (!onDismiss) return;
    if (Math.abs(dragX) >= THRESHOLD) {
      // Slide the card the rest of the way before unmounting so it
      // doesn't pop out of existence under the finger.
      setDragX(dragX > 0 ? 600 : -600);
      window.setTimeout(() => {
        onDismiss();
      }, 180);
    } else {
      setDragX(0);
    }
    startX.current = null;
    startY.current = null;
    dirRef.current = null;
  };

  return (
    <LearningHint
      as="block"
      category="Topic · Decision history"
      title="Decision Dialogue closed"
      whatItIs="A folded summary card showing that a Decision Dialogue ran inside this topic and what was decided. The card carries the chosen path (yours / system's / hybrid / defer) and a snippet of the chosen-note. Tap or swipe to dismiss the card; the dialogue stays on the §3.1 chain regardless."
      why="When a topic produces a decision, the team needs to SEE the decision happened so they don't re-open the same conversation a week later. The folded card is the in-thread receipt — small enough to not consume composer space, visible enough to keep the decision on everyone's mental map."
      how="Read the line. If you need to revisit the reasoning, the chosen-note snippet hints at why. If the situation has changed enough to warrant a new decision, hit 'New dialogue' (admin-only). Swipe left or right on mobile to dismiss the card from view — the decision row stays permanent."
      principle="A decision that vanishes from sight gets re-decided. The fold keeps it lightly visible without taking the composer over."
    >
    <div
      className="mb-3 flex items-start gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20"
      style={{
        transform: dragX !== 0 ? `translateX(${dragX}px)` : undefined,
        opacity:
          dragX !== 0 ? Math.max(0, 1 - Math.abs(dragX) / 300) : undefined,
        transition: dragX === 0 ? "transform 180ms ease-out" : undefined,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
    >
      <CheckCircle2
        className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0"
        aria-hidden
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-primary">
          Decision Dialogue closed · {label}
        </p>
        {noteSnippet && (
          <p className="text-[11px] text-secondary mt-0.5 leading-relaxed">
            {noteSnippet}
          </p>
        )}
      </div>
      {iAmAdmin && (
        <LearningHint
          category="Topic · Decision"
          title="New dialogue"
          whatItIs="Opens a fresh Decision Dialogue inside this topic. The prior decision stays on the §3.1 chain; the new dialogue is a separate decision instance with its own situation, your read, system response, and chosen path."
          why="Decisions are point-in-time judgments. When the situation changes — new information, new constraints, the underlying problem reopens — the honest response is to OPEN ANOTHER dialogue rather than amend the old one. Each dialogue is immutable; the team's evolving understanding shows up as a SEQUENCE of dialogues, not as edits."
          how="Click when the situation has materially changed and you need to re-decide. The new dialogue starts from a blank Situation phase. The prior dialogue's card remains visible above it for context."
          principle="Decisions are append-only events. Edits would corrupt the audit trail; new dialogues preserve it."
        >
          <button
            type="button"
            onClick={onOpenNew}
            className="flex-shrink-0 flex items-center gap-1.5 text-[11px] text-brand hover:text-primary border border-ember-400/30 hover:border-ember-400/60 px-2 py-1 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3 h-3" aria-hidden />
            New dialogue
          </button>
        </LearningHint>
      )}
      {/* Dismiss — UI-only "I've seen this" affordance. The decision
          row stays on the §3.1 chain; this just hides the in-thread
          summary so the composer area isn't permanently consumed.
          Also reachable via horizontal swipe on mobile. */}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss decision summary"
          title="Dismiss (swipe left/right on mobile). The decision stays on the record."
          className="flex-shrink-0 -mr-1 p-1 text-muted hover:text-primary transition-colors"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      )}
    </div>
    </LearningHint>
  );
}

// ─── Subcomponents ────────────────────────────────────────

function PhaseStepper({
  current,
}: {
  current: TopicDecision["phase"];
}) {
  const order = ["situation", "elicit", "respond", "decide"] as const;
  const labels: Record<(typeof order)[number], string> = {
    situation: "Situation",
    elicit: "Your read",
    respond: "System",
    decide: "Decide",
  };
  return (
    <div className="flex items-center gap-1">
      {order.map((p, i) => {
        const reached = order.indexOf(current as (typeof order)[number]) >= i;
        const active = current === p;
        return (
          <div key={p} className="flex items-center gap-1">
            <div
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors ${
                active
                  ? "bg-ember-400/20 text-brand"
                  : reached
                    ? "text-secondary"
                    : "text-muted"
              }`}
            >
              {i + 1}. {labels[p]}
            </div>
            {i < order.length - 1 && (
              <ChevronRight className="w-2.5 h-2.5 text-muted" aria-hidden />
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
  children,
}: {
  active: boolean;
  number: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`transition-opacity ${active ? "" : "opacity-60"}`}>
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-[10px] font-mono text-brand">PHASE {number}</span>
        <h3 className="text-xs font-semibold text-primary">{title}</h3>
      </div>
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
      <label className="flex items-center gap-1.5 text-[11px] font-medium text-secondary mb-1">
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
        className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
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
    emerald: "bg-emerald-500/5 border-emerald-500/20",
    blue: "bg-blue-500/5 border-blue-500/20",
    violet: "bg-violet-500/5 border-violet-500/20",
  }[color];
  return (
    <div className={`rounded-lg border p-2.5 ${styles}`}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-1 opacity-80 text-secondary">
        {icon}
        {label}
      </p>
      <p className="text-xs text-primary leading-relaxed">{body}</p>
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
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-lg border p-2.5 transition-all ${
        selected
          ? "border-ember-400/60 bg-ember-400/10"
          : "border-default bg-surface hover:border-strong"
      }`}
    >
      <div className="flex items-center gap-1.5 mb-0.5">
        {selected && <CheckCircle2 className="w-3 h-3 text-brand" />}
        <span className="text-xs font-medium text-primary">{label}</span>
      </div>
      <p className="text-[10px] text-muted leading-relaxed">{description}</p>
    </button>
  );
}

// ─── Hook: debounce-save a value once it diverges from the row ────

function useDebouncedSave({
  enabled,
  value,
  base,
  save,
}: {
  enabled: boolean;
  value: string;
  base: string;
  save: (v: string) => Promise<void>;
}) {
  const latestValue = useRef(value);
  latestValue.current = value;
  // Memoize the base comparison key so we don't re-fire the effect
  // every render — only when the actual base changes.
  const baseKey = useMemo(() => base, [base]);
  useEffect(() => {
    if (!enabled) return;
    if (value === baseKey) return;
    const t = setTimeout(() => {
      if (latestValue.current === value) {
        save(value).catch(() => {
          // Silent — the next save attempt or parent refresh will
          // surface state divergence. We don't want a transient save
          // failure to interrupt typing.
        });
      }
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // `save` is captured from the parent; if its identity changes
    // we DO want to re-arm the debounce against the new save fn.
  }, [enabled, value, baseKey, save]);
}
