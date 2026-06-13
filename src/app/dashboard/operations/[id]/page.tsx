"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  CornerDownLeft,
  Lightbulb,
  Loader2,
  Lock,
  MessageSquare,
  Sparkles,
  Users,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import {
  fetchTask,
  fetchTaskMessages,
  fetchTaskParticipants,
  postTaskMessage,
  clearTaskGate,
  changeTaskStatus,
  type Task,
  type TaskMessage,
  type TaskParticipant,
} from "@/lib/data/tasks";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import type { CoachContextPayload } from "@/lib/coach/v5/types";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";

/**
 * /dashboard/operations/[id] — task detail.
 *
 * The proper Tasks v1 surface from the three-pillar conversation:
 *
 *   Pillar 1 — Understanding Gate
 *     If gate_cleared = false, the page renders ONLY the gate form.
 *     The task can't be acted on (no thread, no status changes) until
 *     the gate clears. "Small" mode = one-sentence what + assignee
 *     + deadline; "real" mode = full structure.
 *
 *   Pillar 2 — Accountability via meaningful actions, with transparency
 *     last_engaged_at + engagement_count visible to the user about
 *     themselves (A10). Any nudge is paired with a constructive next
 *     step (A7) — never a standalone warning. Page views do NOT count
 *     as engagement; only meaningful actions do.
 *
 *   Pillar 3 — Coach inside the task thread
 *     When the Coach is enabled (company-wide or per-topic style),
 *     citations surface in the message composer the same way they do
 *     in chat. The mount is INSIDE the thread, not on the description
 *     field at create time (which was the wrong place — see A6).
 *
 * The unifying frame (A8): the System on this page is a growth-aware
 * participant. It surfaces what's known about the work, offers next
 * steps, never punishes. Stress is self-reported only, never inferred.
 */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  "To Do": ["In Progress", "Blocked"],
  "In Progress": ["Needs Review", "Blocked", "Completed"],
  Blocked: ["In Progress", "To Do"],
  "Needs Review": ["Completed", "In Progress"],
  Completed: [],
};

const STATUS_COLOR: Record<string, string> = {
  "To Do": "border-default bg-surface text-secondary",
  "In Progress": "border-[#FACC15]/40 bg-[#FACC15]/10 text-brand",
  Blocked: "border-red-500/40 bg-red-500/10 text-red-300",
  "Needs Review": "border-arc-400/40 bg-arc-400/10 text-arc-300",
  Completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
};

const STALE_DAYS = 4; // threshold for the constructive nudge per A7

export default function TaskDetailPage() {
  const params = useParams();
  const toast = useToast();
  const id = String((params as { id?: string })?.id ?? "");

  const [task, setTask] = useState<Task | null>(null);
  const [messages, setMessages] = useState<TaskMessage[]>([]);
  const [participants, setParticipants] = useState<TaskParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { enabled: coachEnabled } = useCoachEnabled();
  // Coach v5 Ask-Coach token for the task composer.
  const [askCoachToken, setAskCoachToken] = useState(0);
  // Coach v5 contextPayload for the task surface — the Coach reads the
  // task title + description as the surface context (different from a
  // chat where the surface context is recent messages).
  const coachV5Payload = useMemo<CoachContextPayload>(
    () => ({
      taskTitle: task?.title,
      taskDescription: task?.description ?? undefined,
    }),
    [task?.title, task?.description]
  );

  const load = async () => {
    setLoading(true);
    const [t, msgs, parts] = await Promise.all([
      fetchTask(id),
      fetchTaskMessages(id),
      fetchTaskParticipants(id),
    ]);
    setTask(t);
    setMessages(msgs);
    setParticipants(parts);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    void (async () => {
      const { createClient, supabaseEnabled } = await import(
        "@/lib/supabase/client"
      );
      if (!supabaseEnabled) return;
      const { data } = await createClient().auth.getUser();
      if (data.user) setCurrentUserId(data.user.id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const submitMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    try {
      const msg = await postTaskMessage({ taskId: id, body: draft.trim() });
      setMessages((prev) => [...prev, msg]);
      setDraft("");
      void load(); // refresh participant engagement
    } catch (err) {
      toast.error(
        "Couldn't post",
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const transitionStatus = async (toStatus: string) => {
    if (!task) return;
    try {
      await changeTaskStatus({
        taskId: id,
        fromStatus: task.status,
        toStatus,
      });
      toast.success(
        `Moved to ${toStatus}`,
        "Status change is on the §3.1 chain — everyone on the task can see the transition."
      );
      void load();
    } catch (err) {
      toast.error(
        "Couldn't change status",
        err instanceof Error ? err.message : "Unknown error"
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Task" subtitle="Loading…" />
        <div className="p-6 flex items-center gap-2 text-xs text-muted">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Task" subtitle="Not found" />
        <div className="p-6 max-w-3xl mx-auto space-y-4">
          <p className="text-sm text-primary">Task not found.</p>
          <Link
            href="/dashboard/operations"
            className="inline-flex items-center gap-1 text-xs text-brand"
          >
            <ArrowLeft className="w-3 h-3" aria-hidden /> Back to tasks
          </Link>
        </div>
      </div>
    );
  }

  const me = participants.find((p) => p.userId === currentUserId);
  const myStaleness = me?.lastEngagedAt
    ? Math.floor(
        (Date.now() - new Date(me.lastEngagedAt).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;
  const showMyNudge =
    !!me && myStaleness !== null && myStaleness >= STALE_DAYS && task.status !== "Completed";

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title={task.title}
        subtitle={`${task.gateCleared ? task.gateMode === "small" ? "Small task" : "Structured task" : "Awaiting Understanding Gate"} · ${task.status}`}
      />

      <div className="p-6 max-w-4xl mx-auto space-y-5">
        <Link
          href="/dashboard/operations"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden /> All tasks
        </Link>

        {/* ─── Pillar 1: Understanding Gate ─────────────────────────── */}
        {!task.gateCleared ? (
          <GateForm
            taskId={task.id}
            initialTitle={task.title}
            onCleared={() => void load()}
          />
        ) : (
          <>
            {/* Constructive engagement nudge (A7) — only ever shown
                WITH an offered next step. Pillar 2 transparency
                (A10): this is the user reading their own engagement
                data, not an admin shadow read. */}
            {showMyNudge && (
              <div className="glass-card p-4 border border-arc-400/30 bg-arc-400/5">
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-4 h-4 text-arc-300 flex-shrink-0 mt-0.5" aria-hidden />
                  <div className="flex-1">
                    <p className="text-xs text-primary font-semibold mb-1">
                      Want to push this forward? Last meaningful action
                      was {myStaleness} days ago.
                    </p>
                    <p className="text-[11px] text-secondary leading-relaxed mb-2">
                      Here's where I&apos;d help: drop the smallest possible
                      next step into the thread below — even &quot;I&apos;m
                      reviewing X tomorrow&quot; counts. That keeps the
                      task moving without overcommitting.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const el = document.querySelector<HTMLTextAreaElement>(
                          "textarea[data-task-composer]"
                        );
                        el?.focus();
                      }}
                      className="text-[11px] text-arc-300 hover:text-arc-200 font-semibold"
                    >
                      Jump to composer →
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Task summary card — gate fields surface here as the
                "frozen understanding" the team agreed on. */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-primary mb-1">
                    {task.title}
                  </h2>
                  <p className="text-xs text-muted">
                    Cleared via {task.gateMode} mode.
                  </p>
                </div>
                <span
                  className={`text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${STATUS_COLOR[task.status] ?? STATUS_COLOR["To Do"]}`}
                >
                  {task.status}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                <Row label="What we're accomplishing" value={task.gateWhat} />
                {task.gateMode === "real" && (
                  <>
                    <Row label="Resources we have" value={task.gateResources} />
                    <Row label="Who's involved + their roles" value={task.gateRoles} />
                  </>
                )}
                {task.dueDate && (
                  <Row label="Deadline" value={task.dueDate} />
                )}
              </div>

              {/* Status transitions */}
              {(STATUS_TRANSITIONS[task.status] ?? []).length > 0 && (
                <div className="flex items-center gap-2 pt-2 border-t border-default flex-wrap">
                  <span className="text-[10px] uppercase tracking-widest text-muted">
                    Move to:
                  </span>
                  {(STATUS_TRANSITIONS[task.status] ?? []).map((next) => (
                    <button
                      key={next}
                      type="button"
                      onClick={() => transitionStatus(next)}
                      className="text-[11px] text-secondary hover:text-primary border border-default hover:border-strong px-2.5 py-1 rounded-md transition-colors"
                    >
                      {next}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Participants + engagement (Pillar 2). Per A10, anyone
                can see this; per A7, when we surface signals about
                someone they always come with a constructive frame. */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-3.5 h-3.5 text-brand" aria-hidden />
                <h3 className="text-xs font-semibold text-primary">
                  Participants ({participants.length})
                </h3>
              </div>
              {participants.length === 0 ? (
                <p className="text-[11px] text-muted">
                  No participants yet — post the first message in the
                  thread and you'll join automatically.
                </p>
              ) : (
                <ul className="divide-y divide-default">
                  {participants.map((p) => {
                    const stale = p.lastEngagedAt
                      ? Math.floor(
                          (Date.now() - new Date(p.lastEngagedAt).getTime()) /
                            (1000 * 60 * 60 * 24)
                        )
                      : null;
                    return (
                      <li key={p.userId} className="py-2 flex items-center justify-between">
                        <div className="text-xs">
                          <p className="text-primary font-mono">
                            {p.userId === currentUserId ? "You" : p.userId.slice(0, 8)}
                          </p>
                          <p className="text-[10px] text-muted">
                            {p.role} · {p.engagementCount} meaningful action
                            {p.engagementCount === 1 ? "" : "s"}
                            {p.lastEngagedAt
                              ? ` · last ${stale === 0 ? "today" : `${stale}d ago`}`
                              : " · no engagement yet"}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Thread */}
            <div className="glass-card p-4">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-3.5 h-3.5 text-brand" aria-hidden />
                <h3 className="text-xs font-semibold text-primary">
                  Thread ({messages.length})
                </h3>
              </div>
              {messages.length === 0 ? (
                <p className="text-[11px] text-muted py-4 text-center">
                  No messages yet. The first message starts the conversation
                  — and counts as your first meaningful action.
                </p>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m) => (
                    <ThreadMessage key={m.id} message={m} />
                  ))}
                </ul>
              )}

              {/* Composer with Coach surface (Pillar 3) */}
              {task.status !== "Completed" && (
                <form onSubmit={submitMessage} className="mt-4 pt-3 border-t border-default">
                  {coachEnabled && (
                    <>
                      <CoachPanelV5
                        draft={draft}
                        contextType="task_field"
                        contextPayload={coachV5Payload}
                        askCoachToken={askCoachToken}
                        onAcceptRevision={(revised) => setDraft(revised)}
                      />
                      <div className="mb-2 flex justify-end">
                        <AskCoachButton
                          disabled={!draft.trim()}
                          onAsk={() => setAskCoachToken((t) => t + 1)}
                        />
                      </div>
                    </>
                  )}
                  <div className="flex items-end gap-2">
                    <textarea
                      data-task-composer
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Post a message — even small movement counts as engagement."
                      rows={2}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void submitMessage(e as unknown as React.FormEvent);
                        }
                      }}
                      className="flex-1 bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 resize-none"
                    />
                    <button
                      type="submit"
                      disabled={submitting || !draft.trim()}
                      className="flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-white font-semibold text-xs px-3 py-2 rounded-lg transition-colors"
                    >
                      {submitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      ) : (
                        <CornerDownLeft className="w-3 h-3" aria-hidden />
                      )}
                      Post
                    </button>
                  </div>
                  <p className="text-[10px] text-muted mt-1.5">
                    Enter to post · Shift+Enter for newline · Coach surfaces principles, you keep authorship
                  </p>
                </form>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted font-mono text-[10px] uppercase tracking-widest mt-0.5 w-44 flex-shrink-0">
        {label}
      </span>
      <span className="text-primary whitespace-pre-wrap flex-1">
        {value || <span className="text-muted italic">—</span>}
      </span>
    </div>
  );
}

function ThreadMessage({ message }: { message: TaskMessage }) {
  const icon =
    message.kind === "gate_cleared" ? (
      <ClipboardCheck className="w-3 h-3 text-emerald-300" aria-hidden />
    ) : message.kind === "status_changed" ? (
      <Sparkles className="w-3 h-3 text-arc-300" aria-hidden />
    ) : message.kind === "nudge" ? (
      <Lightbulb className="w-3 h-3 text-accent-text" aria-hidden />
    ) : (
      <MessageSquare className="w-3 h-3 text-muted" aria-hidden />
    );
  const isSystem = message.kind !== "message";
  return (
    <li
      className={`text-xs ${isSystem ? "border-l-2 border-[#FACC15]/30 pl-3 py-1.5 bg-[#FACC15]/5 rounded" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-[10px] font-mono text-muted uppercase tracking-widest">
          {message.authorName} · {new Date(message.createdAt).toLocaleString()}
        </span>
      </div>
      {message.body && (
        <p className="text-secondary leading-relaxed whitespace-pre-wrap">
          {message.body}
        </p>
      )}
    </li>
  );
}

/**
 * GateForm — Pillar 1. Mounted in place of the rest of the task UI
 * until the gate clears. Two modes:
 *   - small: one-sentence what + the existing assignee/deadline
 *   - real: what + resources + roles
 *
 * Per A4 (defer to evidence), we don't pre-decide which mode is
 * "right" for which task — we surface both choices and let the §4
 * readout (durability of completed tasks by mode) tell us whether
 * small mode undermines the gate or rescues it.
 */
function GateForm({
  taskId,
  initialTitle,
  onCleared,
}: {
  taskId: string;
  initialTitle: string;
  onCleared: () => void;
}) {
  const toast = useToast();
  const [mode, setMode] = useState<"small" | "real">("small");
  const [what, setWhat] = useState(initialTitle);
  const [resources, setResources] = useState("");
  const [roles, setRoles] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!what.trim()) {
      toast.warn(
        "What field required",
        "Even small tasks need a clear answer to 'what are we trying to accomplish?'"
      );
      return;
    }
    if (mode === "real" && (!resources.trim() || !roles.trim())) {
      toast.warn(
        "Real mode requires structure",
        "Resources and Roles are both required. Or switch to Small mode if the task is genuinely simple."
      );
      return;
    }
    setSubmitting(true);
    try {
      await clearTaskGate({
        taskId,
        mode,
        what,
        resources: mode === "real" ? resources : null,
        roles: mode === "real" ? roles : null,
      });
      toast.success(
        "Understanding Gate cleared",
        "Task is now actionable. Engagement and thread are live."
      );
      onCleared();
    } catch (err) {
      toast.error(
        "Couldn't clear gate",
        err instanceof Error ? err.message : "Unknown error"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-card p-5 border border-[#FACC15]/30 bg-[#FACC15]/5 space-y-4">
      <div className="flex items-start gap-3">
        <Lock className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden />
        <div>
          <h2 className="text-sm font-semibold text-primary mb-1">
            Understanding Gate — clear before starting
          </h2>
          <p className="text-[11px] text-secondary leading-relaxed">
            Tasks started without a shared understanding produce friction,
            delays, and team friction. This gate is constitutional (§3.2 applied
            to work, not just problems). Pick the mode that fits — small for
            genuinely simple tasks, real for anything with moving parts.
          </p>
        </div>
      </div>

      {/* Mode picker */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setMode("small")}
          className={`text-left rounded-lg border p-3 transition-colors ${
            mode === "small"
              ? "border-brand bg-[#FACC15]/8"
              : "border-default hover:border-strong"
          }`}
        >
          <p className="text-xs font-semibold text-primary mb-0.5">
            Small task
          </p>
          <p className="text-[10px] text-muted">
            One sentence + deadline. Use for genuinely simple work.
          </p>
        </button>
        <button
          type="button"
          onClick={() => setMode("real")}
          className={`text-left rounded-lg border p-3 transition-colors ${
            mode === "real"
              ? "border-brand bg-[#FACC15]/8"
              : "border-default hover:border-strong"
          }`}
        >
          <p className="text-xs font-semibold text-primary mb-0.5">
            Real task
          </p>
          <p className="text-[10px] text-muted">
            What + Resources + Roles. Use whenever moving parts exist.
          </p>
        </button>
      </div>

      <Field label="What are we trying to accomplish?" required>
        <textarea
          value={what}
          onChange={(e) => setWhat(e.target.value)}
          rows={2}
          placeholder="One clear sentence. Not 'fix the bug' — 'restore pin durability on chat refresh'."
          className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 resize-none"
        />
      </Field>

      {mode === "real" && (
        <>
          <Field label="Tools / assets / resources we have" required>
            <textarea
              value={resources}
              onChange={(e) => setResources(e.target.value)}
              rows={2}
              placeholder="What can the team draw on? Existing docs, services, prior work, people who've solved this before."
              className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 resize-none"
            />
          </Field>
          <Field label="Who's involved + their roles" required>
            <textarea
              value={roles}
              onChange={(e) => setRoles(e.target.value)}
              rows={2}
              placeholder="One line per person — name, what they own, what they're accountable for."
              className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[#FACC15]/50 focus:ring-1 focus:ring-[#FACC15]/30 resize-none"
            />
          </Field>
        </>
      )}

      <div className="flex items-center justify-end pt-2 border-t border-default">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex items-center gap-1.5 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
          )}
          Clear gate · start work
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[10px] uppercase tracking-widest text-muted">
        {label}
        {required && <span className="text-brand ml-1">*</span>}
      </label>
      {children}
    </div>
  );
}
