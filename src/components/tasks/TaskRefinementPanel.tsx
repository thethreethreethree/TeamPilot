"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Sparkles, ListChecks, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/toast";
import type {
  SpawnContextType,
  SpawnContextPayload,
  SpawnedTaskDraft,
} from "@/lib/taskSpawn/types";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * TaskRefinementPanel — shared review surface for the Task Spawn
 * Engine (Sprint 2 of the engine).
 *
 * Lifecycle when opened:
 *  1. On mount, POSTs the contextPayload to /api/tasks/spawn and
 *     receives a SpawnedTaskDraft.
 *  2. Shows the draft (title, description, steps) editable inline
 *     OR refinable via a natural-language adjustment prompt.
 *  3. On "Save task", POSTs to /api/tasks with the linkage fields
 *     and spawn_steps so the source-of-truth chain (§3.1) is intact.
 *
 * §3.3 guide-don't-overtake: this panel never auto-saves. The user
 * is always the actor that commits.
 *
 * §1.5 holistic: the editable description / steps let the user
 * graft in context the LLM couldn't see (people, deadlines, internal
 * constraints) before the task lands.
 */

export type TaskRefinementPanelProps = {
  open: boolean;
  onClose: () => void;
  contextType: SpawnContextType;
  contextPayload: SpawnContextPayload;
  /** Called with the new task ID after a successful save. The
   *  parent typically toasts + navigates / refreshes. */
  onSaved?: (taskId: string) => void;
  /** Optional title shown in the modal header. Defaults differ by
   *  context type so the user knows what they're converting. */
  modalTitle?: string;
};

export default function TaskRefinementPanel({
  open,
  onClose,
  contextType,
  contextPayload,
  onSaved,
  modalTitle,
}: TaskRefinementPanelProps) {
  const toast = useToast();
  const [draft, setDraft] = useState<SpawnedTaskDraft | null>(null);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adjustmentPrompt, setAdjustmentPrompt] = useState("");

  const generate = useCallback(
    async (opts?: { withAdjustment?: boolean }) => {
      setGenerating(true);
      setError(null);
      try {
        const body: Record<string, unknown> = {
          contextType,
          contextPayload,
        };
        if (opts?.withAdjustment && draft) {
          body.previousTaskDraft = draft;
          body.adjustmentPrompt = adjustmentPrompt;
        }
        const res = await fetch("/api/tasks/spawn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) {
          throw new Error(json.error ?? "Spawn engine failed.");
        }
        if (json.suppressed) {
          throw new Error(
            json.reason
              ? `Suppressed by gate: ${json.reason}`
              : "Suppressed by safety gate."
          );
        }
        setDraft(json.task as SpawnedTaskDraft);
        if (opts?.withAdjustment) setAdjustmentPrompt("");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
      } finally {
        setGenerating(false);
      }
    },
    [contextType, contextPayload, draft, adjustmentPrompt]
  );

  // First-mount generation. Re-runs only when the panel is opened
  // fresh — we deliberately key on `open` so closing + reopening
  // with new context regenerates.
  useEffect(() => {
    if (!open) return;
    setDraft(null);
    setError(null);
    setAdjustmentPrompt("");
    void generate();
    // generate's deps include contextPayload/draft — but we only
    // want a fresh-spawn on open. Subsequent calls go through the
    // explicit "Refine" button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = useCallback(async () => {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        title: draft.title,
        description: composeDescriptionWithSteps(draft),
        spawnSteps: draft.steps,
      };
      if (contextType === "decision" && contextPayload.decisionId) {
        body.linkedDecisionId = contextPayload.decisionId;
      }
      if (contextType === "chat_messages" && contextPayload.chatTopicId) {
        body.linkedChatTopicId = contextPayload.chatTopicId;
        if (contextPayload.selectedMessageIds?.length) {
          body.linkedMessageIds = contextPayload.selectedMessageIds;
        }
      }
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Save failed.");
      toast.success("Task created from " + (contextType === "decision" ? "decision." : "chat."));
      onSaved?.(json.taskId);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [draft, contextType, contextPayload, toast, onSaved, onClose]);

  const defaultTitle =
    contextType === "decision"
      ? "Spawn a task from this decision"
      : "Spawn a task from these messages";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={modalTitle ?? defaultTitle}
      size="xl"
      closeOnBackdrop={false}
    >
      {generating && !draft && (
        <div className="flex flex-col items-center justify-center py-12 text-muted">
          <Loader2 className="w-6 h-6 animate-spin mb-3" />
          <p className="text-sm">Reading the context and drafting a plan…</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-primary">
          {error}
          <button
            type="button"
            onClick={() => void generate()}
            className="ml-2 underline hover:text-white"
          >
            Retry
          </button>
        </div>
      )}

      {draft && (
        <div className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              Title
            </label>
            <LearningHint
              as="block"
              category="Tasks · Spawn"
              title="Task title"
              whatItIs="The one-line name of the task the engine drafted from your context — editable before you save."
              why="The title is how this task will be recognized in every list from now on. The engine's guess is a starting point; you know the framing your team will actually understand."
              how="Tighten it to something specific and recognizable. You're the one who commits — nothing saves until you say so."
              principle="Name the work the way the people doing it will recognize it."
            >
            <input
              type="text"
              value={draft.title}
              onChange={(e) =>
                setDraft({ ...draft, title: e.target.value })
              }
              maxLength={400}
              className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-base md:text-sm text-primary focus:outline-none focus:border-white/30"
            />
            </LearningHint>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1">
              Description
            </label>
            <LearningHint
              as="block"
              category="Tasks · Spawn"
              title="Description"
              whatItIs="The fuller explanation of the task, drafted from your context and open for you to edit."
              why="The engine only sees what you fed it. This is where you graft in what it couldn't know — the people, the deadline, the internal constraint — before the task lands."
              how="Add the context the draft is missing. The engine guides; you decide what's true."
              principle="The machine drafts from what it saw; you complete it from what you know."
            >
            <textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              maxLength={8000}
              rows={4}
              className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-base md:text-sm text-primary focus:outline-none focus:border-white/30 resize-y"
            />
            </LearningHint>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1 flex items-center gap-1.5">
              <ListChecks className="w-3.5 h-3.5" />
              Steps
            </label>
            <LearningHint
              as="block"
              category="Tasks · Spawn"
              title="Steps"
              whatItIs="The concrete actions the engine broke the task into — each editable, removable, and you can add your own."
              why="A task without steps is just a wish. These are the drafted first moves; refining them now means the task arrives ready to work, not needing to be figured out later."
              how="Edit any step, remove ones that don't fit, or add the action the engine missed. Order them the way the work actually happens."
              principle="A plan you can start is worth more than a plan that's merely correct."
            >
            <ol className="space-y-2">
              {draft.steps.map((step, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-2 text-xs text-muted shrink-0 w-5 text-right">
                    {idx + 1}.
                  </span>
                  <textarea
                    value={step}
                    onChange={(e) => {
                      const next = [...draft.steps];
                      next[idx] = e.target.value;
                      setDraft({ ...draft, steps: next });
                    }}
                    maxLength={800}
                    rows={2}
                    className="flex-1 rounded-md bg-black/30 border border-white/10 px-3 py-1.5 text-base md:text-sm text-primary focus:outline-none focus:border-white/30 resize-y"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = draft.steps.filter((_, i) => i !== idx);
                      setDraft({ ...draft, steps: next });
                    }}
                    aria-label={`Remove step ${idx + 1}`}
                    className="mt-2 text-muted hover:text-red-400 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ol>
            {draft.steps.length < 20 && (
              <button
                type="button"
                onClick={() =>
                  setDraft({ ...draft, steps: [...draft.steps, ""] })
                }
                className="mt-2 text-xs text-muted hover:text-primary underline"
              >
                + add step
              </button>
            )}
            </LearningHint>
          </div>

          <div className="border-t border-white/10 pt-4">
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Adjust the draft
            </label>
            <p className="text-xs text-muted mb-2">
              Tell the engine what to change — e.g. &ldquo;make it focused on the
              technical review, not the rollout&rdquo; or &ldquo;cut the
              communication step, the team already knows&rdquo;.
            </p>
            <LearningHint
              as="block"
              category="Tasks · Spawn"
              title="Adjust the draft"
              whatItIs="A natural-language box to tell the engine what to change, then re-draft the whole task from your instruction."
              why="Editing each field by hand is slow when the framing itself is off. This lets you redirect the whole draft in a sentence — 'focus it on the technical review, not the rollout' — and let the engine rework it."
              how="Describe what should change, then Refine. Keep iterating until the draft fits; it never saves on its own."
              principle="Steer the whole draft with intent, not just the words one field at a time."
            >
            <textarea
              value={adjustmentPrompt}
              onChange={(e) => setAdjustmentPrompt(e.target.value)}
              maxLength={2000}
              rows={2}
              placeholder="What should change in the next revision?"
              className="w-full rounded-md bg-black/30 border border-white/10 px-3 py-2 text-base md:text-sm text-primary focus:outline-none focus:border-white/30 resize-y"
            />
            </LearningHint>
            <button
              type="button"
              onClick={() => void generate({ withAdjustment: true })}
              disabled={
                generating || saving || !adjustmentPrompt.trim()
              }
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1.5 text-xs text-primary disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {generating ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Refine
            </button>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-3 py-1.5 text-sm text-muted hover:text-primary disabled:opacity-50"
            >
              Cancel
            </button>
            <LearningHint
              as="inline-block"
              category="Tasks · Spawn"
              title="Save task"
              whatItIs="Commits the draft as a real task, linked back to the decision or messages it came from."
              why="Nothing here is saved until you press this — you're always the one who commits (the engine never auto-saves). Saving keeps the source chain intact, so the task remembers where it came from."
              how="Save once the title and steps read right. You'll land back where you were, task created."
              principle="The human commits the work — the engine only ever proposes."
            >
            <button
              type="button"
              onClick={() => void save()}
              disabled={
                saving ||
                generating ||
                !draft.title.trim() ||
                draft.steps.length === 0
              }
              className="inline-flex items-center gap-1.5 rounded-md bg-white text-black px-4 py-1.5 text-sm font-semibold hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Save task
            </button>
            </LearningHint>
          </div>
        </div>
      )}
    </Modal>
  );
}

/**
 * Persist the steps inline at the bottom of the description so they
 * appear on the existing Tasks UI even before per-step tracking
 * lands. The structured `spawn_steps` jsonb column still carries the
 * authoritative version for future readouts.
 */
function composeDescriptionWithSteps(draft: SpawnedTaskDraft): string {
  if (!draft.steps.length) return draft.description;
  const stepBlock = draft.steps
    .map((s, i) => `${i + 1}. ${s.trim()}`)
    .join("\n");
  return `${draft.description.trim()}\n\nSteps:\n${stepBlock}`;
}
