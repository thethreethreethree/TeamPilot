"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Circle,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  fetchTaskSteps,
  toggleTaskStep,
  addTaskStep,
  editTaskStepBody,
  deleteTaskStep,
  type TaskStep,
} from "@/lib/data/tasks";
import { useToast } from "@/components/ui/toast";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";
import type { CoachContextPayload } from "@/lib/coach/v5/types";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * TaskStepChecklist — Pillar 2 (Accountability) + Pillar 3 (Guidance)
 * for the task system, per §A6.
 *
 * What it renders:
 *  - Each step from `task_steps` as a checkbox row.
 *  - A derived progress bar (completed / total).
 *  - Inline body editing per step.
 *  - "Ask Coach" per step — focused signal per A11 (the Coach reads
 *    THIS step's text + the task's gate answers, not the whole
 *    description).
 *  - "Add step" affordance at the bottom.
 *
 * What it deliberately doesn't do (per §A11):
 *  - Render a verdict on the user's pace ("falling behind").
 *  - Hide the completion ratio as a grade.
 *  - Make any leader-visible label without A18-shaped invitation.
 *
 * Composition (per §A16): the Coach panel mounted per step reads the
 * task's gate answers + the step's body. So the per-step coaching
 * "sees" the larger work intent without the user having to repeat
 * it. Cross-conversation memory still applies.
 */
export function TaskStepChecklist({
  taskId,
  taskTitle,
  gateWhat,
  gateResources,
  gateRoles,
}: {
  taskId: string;
  taskTitle: string;
  gateWhat: string | null;
  gateResources: string | null;
  gateRoles: string | null;
}) {
  const toast = useToast();
  const { enabled: coachEnabled } = useCoachEnabled();
  const [steps, setSteps] = useState<TaskStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const addingRef = useRef(false);
  const [newBody, setNewBody] = useState("");
  const [openCoachStepId, setOpenCoachStepId] = useState<string | null>(null);
  const [askCoachToken, setAskCoachToken] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await fetchTaskSteps(taskId);
    setSteps(next);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const completedCount = useMemo(
    () => steps.filter((s) => s.completedAt !== null).length,
    [steps]
  );
  const totalCount = steps.length;
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const onToggle = async (step: TaskStep) => {
    const next = !step.completedAt;
    // Optimistic flip.
    setSteps((prev) =>
      prev.map((s) =>
        s.id === step.id
          ? {
              ...s,
              completedAt: next ? new Date().toISOString() : null,
            }
          : s
      )
    );
    try {
      await toggleTaskStep({ stepId: step.id, completed: next });
    } catch {
      // Rollback.
      setSteps((prev) =>
        prev.map((s) =>
          s.id === step.id ? { ...s, completedAt: step.completedAt } : s
        )
      );
      toast.error("Couldn't update step");
    }
  };

  const onAdd = async () => {
    const body = newBody.trim();
    // Synchronous latch: addTaskStep inserts a new step row per call with no
    // unique constraint, so an Enter-mash / double-click would append
    // duplicate steps. The `adding` state guard lands a render too late.
    if (!body || addingRef.current) return;
    addingRef.current = true;
    setAdding(true);
    try {
      const created = await addTaskStep({ taskId, body });
      if (created) {
        setSteps((prev) => [...prev, created]);
        setNewBody("");
      } else {
        toast.error("Couldn't add step");
      }
    } finally {
      addingRef.current = false;
      setAdding(false);
    }
  };

  const onEditBody = async (step: TaskStep, body: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === step.id ? { ...s, body } : s))
    );
    await editTaskStepBody({ stepId: step.id, body });
  };

  const onDelete = async (step: TaskStep) => {
    if (step.completedAt) {
      toast.warn(
        "Completed steps stay on the record",
        "Uncheck the step first if you need to remove it."
      );
      return;
    }
    const ok = await deleteTaskStep(step.id);
    if (ok) {
      setSteps((prev) => prev.filter((s) => s.id !== step.id));
    } else {
      toast.error("Couldn't delete step");
    }
  };

  // The Coach context the per-step panel receives. Includes the task
  // title + gate answers so the Coach reads the step in its work
  // context, not in isolation (§A16 composition).
  const coachPayloadFor = (step: TaskStep): CoachContextPayload => ({
    taskTitle,
    taskDescription: [
      gateWhat ? `What we're accomplishing: ${gateWhat}` : null,
      gateResources ? `Resources we have: ${gateResources}` : null,
      gateRoles ? `Roles: ${gateRoles}` : null,
      `Current step: ${step.body}`,
    ]
      .filter(Boolean)
      .join("\n"),
  });

  if (loading) {
    return (
      <div className="glass-card p-5 flex items-center justify-center gap-2 text-xs text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        Loading steps…
      </div>
    );
  }

  return (
    <div className="glass-card p-5 space-y-4">
      {/* Header + derived progress.
          §A7: this count comes paired with an offered next step
          when momentum stalls (the Ask Coach affordance per step).
          §A11: the percentage is a count, not a grade. Tone is
          "momentum" never "rating." */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-primary mb-0.5">
            Steps
          </h3>
          <p className="text-[11px] text-muted leading-relaxed">
            Each step is a concrete action. Check it as you finish —
            the §3.1 chain records who did it and when.
          </p>
        </div>
        {totalCount > 0 && (
          <div className="text-right shrink-0">
            <p className="text-xs font-semibold text-primary">
              {completedCount} / {totalCount}
            </p>
            <p className="text-[10px] text-muted font-mono">{pct}% momentum</p>
          </div>
        )}
      </div>

      {totalCount > 0 && (
        <LearningHint
          as="block"
          category="Tasks · Steps"
          title="Momentum, not a grade"
          whatItIs="A bar and count showing how many steps you've completed out of the total on this task."
          why="It's deliberately framed as momentum, never a rating. A completion count tells you where the work stands; it does not judge your pace or rank you. The moment a count becomes a verdict, people start gaming it instead of doing the work."
          how="Read it as a progress signal. If it stalls, that's a cue to open the Coach on the step that's stuck — not a mark against you."
          principle="Measure progress to move it, not to score it."
        >
        <div
          className="h-1.5 rounded-full bg-surface overflow-hidden"
          role="progressbar"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-label={`${completedCount} of ${totalCount} steps complete`}
        >
          <div
            className="h-full bg-ember-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        </LearningHint>
      )}

      {/* Empty state — A7-compliant: an offered next step, not a
          flat "no data" message. */}
      {totalCount === 0 ? (
        <div className="text-center py-6 text-xs text-muted leading-relaxed">
          No steps yet. The Spawn Engine adds them automatically for
          decision-spawned and chat-spawned tasks — for direct-created
          tasks, name the first concrete action below.
        </div>
      ) : (
        <LearningHint
          as="block"
          category="Tasks · Steps"
          title="Steps"
          whatItIs="Each concrete action for this task as its own checkable row — toggle it done, edit the wording, delete it while incomplete, or open the Coach on it."
          why="Breaking work into named actions is what turns an intention into progress. Checking a step records who did it and when on the permanent event chain, so the history stays intact and honest — completed steps can't be quietly deleted."
          how="Check a step as you finish it. Open the Coach on any step to think it through in the task's full context. Add the next action at the bottom."
          principle="A vague task stalls; a task broken into steps moves."
        >
        <ol className="space-y-2">
          {steps.map((step) => {
            const done = step.completedAt !== null;
            const isOpenCoach = openCoachStepId === step.id;
            return (
              <li
                key={step.id}
                className={`rounded-lg border transition-colors ${
                  done
                    ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                    : "border-default bg-surface/40"
                }`}
              >
                <div className="flex items-start gap-2 p-2">
                  <button
                    type="button"
                    onClick={() => void onToggle(step)}
                    aria-label={done ? "Mark step incomplete" : "Mark step complete"}
                    className="mt-0.5 shrink-0 hover:scale-110 transition-transform"
                  >
                    {done ? (
                      <CheckCircle2
                        className="w-4 h-4 text-emerald-400"
                        aria-hidden
                      />
                    ) : (
                      <Circle
                        className="w-4 h-4 text-muted"
                        aria-hidden
                      />
                    )}
                  </button>
                  <textarea
                    value={step.body}
                    onChange={(e) =>
                      void onEditBody(step, e.target.value)
                    }
                    rows={1}
                    className={`flex-1 min-w-0 bg-transparent text-sm leading-relaxed resize-none focus:outline-none ${
                      done ? "text-muted line-through" : "text-primary"
                    }`}
                  />
                  {/* Per-step Coach trigger — only render when Coach
                      is on for this company (§3.4 cycle phase + per-
                      company flag). Per A11, this is "open the
                      mirror on this step," not "rate this step." */}
                  {coachEnabled && !done && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpenCoachStepId((cur) =>
                          cur === step.id ? null : step.id
                        );
                        setAskCoachToken((t) => t + 1);
                      }}
                      title="Open the Coach on this step"
                      className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-brand bg-ember-400/10 border border-ember-400/40 hover:border-ember-400/70 hover:bg-ember-400/15 rounded-md px-1.5 py-0.5"
                    >
                      <Sparkles className="w-3 h-3" aria-hidden />
                      Coach
                    </button>
                  )}
                  {!done && (
                    <button
                      type="button"
                      onClick={() => void onDelete(step)}
                      aria-label="Delete step"
                      title="Delete (allowed while incomplete; completed steps stay on record)"
                      className="shrink-0 text-muted hover:text-red-400 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" aria-hidden />
                    </button>
                  )}
                </div>
                {/* Per-step Coach panel — focused signal (A11): reads
                    THIS step + the task's gate answers. Includes the
                    "Ask Coach" affordance so the user can pull
                    analysis explicitly. Auto-mode also runs on draft
                    changes per the panel's own contract. */}
                {isOpenCoach && coachEnabled && (
                  <div className="border-t border-default px-2 py-2">
                    <CoachPanelV5
                      draft={step.body}
                      contextType="task_field"
                      contextPayload={coachPayloadFor(step)}
                      askCoachToken={askCoachToken}
                      onAcceptRevision={(revised) => {
                        void onEditBody(step, revised);
                      }}
                    />
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <AskCoachButton
                        disabled={!step.body.trim()}
                        onAsk={() => setAskCoachToken((t) => t + 1)}
                      />
                      <button
                        type="button"
                        onClick={() => setOpenCoachStepId(null)}
                        aria-label="Close Coach"
                        className="text-[10px] text-muted hover:text-primary inline-flex items-center gap-1"
                      >
                        <X className="w-3 h-3" aria-hidden />
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
        </LearningHint>
      )}

      {/* Add-step composer. Plain textarea; pressing Enter (no
          shift) commits. The Coach can open on the saved step right
          after — keeping a Coach mounted on a draft would A11-leak
          ("Coach said no" before the step exists). */}
      <LearningHint
        as="block"
        category="Tasks · Steps"
        title="Add a step"
        whatItIs="A box to name the next concrete action and add it to the list."
        why="The work only advances if the next action is named. An empty step list is where momentum quietly dies — this is how you keep feeding it the next move."
        how="Type the next concrete action and press Enter (or Add). Keep each one small and doable."
        principle="Always know — and name — the next concrete action."
      >
      <div className="flex items-start gap-2 border-t border-default pt-3">
        <Plus className="w-3.5 h-3.5 text-muted mt-2 shrink-0" aria-hidden />
        <textarea
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!adding) void onAdd();
            }
          }}
          placeholder="Add a step — what's the next concrete action?"
          rows={1}
          className="flex-1 min-w-0 bg-surface border border-default rounded-md px-2 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none"
        />
        <button
          type="button"
          onClick={() => void onAdd()}
          disabled={adding || !newBody.trim()}
          className="shrink-0 text-xs font-semibold bg-ember-400 hover:bg-ember-500 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] px-3 py-1.5 rounded-md transition-colors"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </div>
      </LearningHint>
    </div>
  );
}
