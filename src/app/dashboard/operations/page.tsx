"use client";

import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { SkeletonRow } from "@/components/ui/Skeleton";
import {
  taskDisplayLabel,
  TASK_CANONICAL_STATUSES,
  TASK_PRIORITIES,
} from "@/lib/tasks/statusLabels";
import { fetchTasks, type FetchTasksMode, type Task } from "@/lib/data/tasks";
import { fetchTeam, type TeamMember } from "@/lib/data/team";
import { supabaseEnabled } from "@/lib/supabase/client";
import Modal from "@/components/ui/Modal";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import ExportMenu from "@/components/ui/ExportMenu";
import {
  CheckCircle2,
  Filter,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import type { TaskCanonicalStatus } from "@/lib/tasks/statusLabels";

// Derived from the canonical status set (single source) + the "All" sentinel.
type FilterType = "All" | TaskCanonicalStatus;

type TaskFilterHint = {
  whatItIs: string;
  why: string;
  how: string;
  principle?: string;
};

const FILTER_HINTS: Record<FilterType, TaskFilterHint> = {
  All: {
    whatItIs: "Shows every task — every status, every priority, every assignee. The default landing view.",
    why: "Sometimes you need the full picture before deciding what to act on. Starting from All and narrowing via filter is faster than starting narrow and missing context.",
    how: "Use All when you're scanning the team's overall load or you don't yet know what you're looking for. Once you have a question (what's blocked? what's mine?), switch to the filter that answers it directly.",
  },
  Blocked: {
    whatItIs: "Tasks in the Blocked status — work that has stalled with a stated blocker reason captured.",
    why: "The Blocked filter is the discipline surface for the work the team has parked. Browsing it periodically prevents the silent accumulation of stale blocked tasks where nobody remembers why they were blocked.",
    how: "Open this filter once or twice a week. For each row, ask: 'Is the blocker still real?' If not, transition the task back to In Progress. If yes, decide whether to unblock or reroute.",
    principle: "A blocker without a recent review is a blocker that's quietly become a habit.",
  },
  "In Progress": {
    whatItIs: "Tasks the team has explicitly picked up — work that's started but not yet completed.",
    why: "The In Progress count is the team's working memory. The honest team measures this and keeps it small; the unfocused team lets it grow until everyone has a dozen things half-done.",
    how: "Use this view to see your own active work + your teammates'. If In Progress is high across the team without proportional completion velocity, the right move is usually to STOP starting new tasks until in-progress drains.",
    principle: "WIP is the lever. Cap it consciously; don't let it grow by default.",
  },
  "To Do": {
    whatItIs: "Tasks in the To Do state — scoped, assigned, but not yet started. The team's queue.",
    why: "To Do is the bench. Browsing it answers 'what's next' without committing to anything yet. Helpful when planning your next session of focused work, OR when assessing whether the team has enough scoped work to fill the next sprint.",
    how: "If To Do is empty and In Progress is high, the team has lost runway — every existing task is in-flight. If To Do is enormous, the team has more scope than it can credibly absorb.",
  },
  "Needs Review": {
    whatItIs: "Tasks marked Needs Review — work that has been completed by the doer and is now awaiting a second pair of eyes before being marked Completed.",
    why: "The review step is the team's quality + handoff discipline. A team that always closes tasks straight to Completed skips this — and quality drift is one of the first places that shows up.",
    how: "If you've assigned reviews, open this filter to see your queue. Slow reviews are a real cost to teammates; clear them within a day where possible.",
    principle: "The review step is what makes the team get better. Don't optimize past it.",
  },
  Completed: {
    whatItIs: "Tasks marked Completed — closed work. The team's done pile.",
    why: "Sometimes you need to find a task you finished last week to reference what was decided. The Completed filter is for archival lookup.",
    how: "Don't operate from Completed. Don't celebrate count-of-completed (that's vanity). Use it when you specifically need to find or reference closed work.",
    principle: "Completion count is a vanity metric on its own. Pair it mentally with held rate from Resolutions to see if the work actually held.",
  },
};

// Order is intentional (Blocked surfaced first). Entries are FilterType-checked,
// so only valid statuses compile; if a status is added to TASK_CANONICAL_STATUSES,
// add it here too (a missing entry only drops a filter button, not a data path).
const FILTERS: FilterType[] = [
  "All",
  "Blocked",
  "In Progress",
  "To Do",
  "Needs Review",
  "Completed",
];

const PRIORITY_DOTS: Record<string, string> = {
  Critical: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-yellow-500",
  Low: "bg-surface-raised",
};

// Single source of truth (statusLabels) — was a local copy that could drift from
// the API's accepted values and the status-label set.
const STATUS_OPTIONS = TASK_CANONICAL_STATUSES;
const PRIORITY_OPTIONS = TASK_PRIORITIES;

type Draft = {
  title: string;
  description: string;
  department: string;
  assignee: string;
  status: string;
  priority: string;
  dueDate: string;
  blockerReason: string;
};

const emptyDraft: Draft = {
  title: "",
  description: "",
  department: "",
  assignee: "",
  status: "To Do",
  priority: "Medium",
  dueDate: "",
  blockerReason: "",
};

export default function OperationsPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mode, setMode] = useState<FetchTasksMode>("demo-fixtures");
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);

  const refresh = async () => {
    setLoading(true);
    const [tasksRes, teamSnap] = await Promise.all([fetchTasks(), fetchTeam()]);
    setTasks(tasksRes.tasks);
    setMode(tasksRes.mode);
    setMembers(teamSnap.members);
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  // Open create modal when arriving with ?new=1 (from Command Palette).
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1" && supabaseEnabled) {
      openCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered =
    activeFilter === "All" ? tasks : tasks.filter((t) => t.status === activeFilter);

  const blockedCount = tasks.filter((t) => t.status === "Blocked").length;
  const inProgressCount = tasks.filter((t) => t.status === "In Progress").length;
  const criticalCount = tasks.filter((t) => t.priority === "Critical").length;

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditing(null);
    setCreating(true);
    setError("");
  };

  const openEdit = (t: Task) => {
    setDraft({
      title: t.title,
      description: t.description ?? "",
      department: t.department ?? "",
      assignee: t.assignee ?? "",
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate ?? "",
      blockerReason: t.blockerReason ?? "",
    });
    setEditing(t);
    setCreating(false);
    setError("");
  };

  const closeForm = () => {
    setEditing(null);
    setCreating(false);
    setError("");
  };

  const submit = async () => {
    if (!supabaseEnabled) {
      setError("Live mode required. Configure Supabase to create or edit tasks.");
      return;
    }
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const payload = {
        title: draft.title,
        description: draft.description || null,
        department: draft.department || null,
        assignee: draft.assignee || null,
        status: draft.status,
        priority: draft.priority,
        dueDate: draft.dueDate || null,
        blockerReason: draft.blockerReason || null,
      };
      const res = await fetch("/api/tasks", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed.");
      closeForm();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteTask = async (t: Task) => {
    if (!supabaseEnabled) return;
    if (!confirm(`Delete "${t.title}"? This emits a task.deleted event; the record is preserved.`)) return;
    try {
      const res = await fetch(`/api/tasks?id=${encodeURIComponent(t.id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        refresh();
        return;
      }
      // §3.4 / the 558ce56 class: a failed delete must be VISIBLE. Without this
      // the task stayed on screen (refresh skipped) with no error — the user
      // assumes it's gone.
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Couldn't delete the task — try again.");
    } catch {
      setError("Couldn't reach the server to delete the task — try again.");
    }
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Tasks"
        subtitle="Production task management · every mutation emits an event into the §3.1 chain"
      />

      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <ModeBanner mode={mode} />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <LearningHint
            category="Tasks · Load"
            title="Open tasks"
            whatItIs="The count of every task currently in flight — anything not yet completed or deleted. Includes To Do, In Progress, Blocked, and Needs Review."
            why="Activity counts (tickets created, comments, meeting minutes) are noise. The single honest measure of operational load is 'how many unresolved threads is the team carrying.' That's the count of open work. If this number climbs faster than completions, the team is taking on more than it can finish — capacity has shifted."
            how="Use this number to gauge load, not to chase. A team with 200 open tasks and steady completions is fine. A team with 50 open tasks and zero completions is stuck. The number alone tells you nothing — the trend versus completions tells you everything."
            principle="Open count is the load gauge. Pair it mentally with completion velocity to read the operational truth."
          >
            <Stat label="Open tasks" value={tasks.length} color="text-primary" />
          </LearningHint>
          <LearningHint
            category="Tasks · Risk"
            title="Blocked"
            whatItIs="Tasks currently in the Blocked state. Per the chain discipline, any task in Blocked must carry a blocker_reason (the API rejects the transition without one) — so this count IS the count of tasks where someone has explicitly named a blocker."
            why="The blocked-count answers a question other counts can't: 'how much of the team's load is paused, with a stated reason?' A team that drifts blocked-count upward without anyone noticing is a team accepting that work just stops sometimes. Surfacing the count makes the pile visible."
            how="When this number is non-zero, open the Critical & Blocked Tasks panel on the Command Center to see WHICH tasks are blocked and WHY. Decide: do you unblock by removing the constraint, or do you accept the block and reroute work around it? Both are legitimate; choosing without seeing the count isn't."
            principle="A blocker without a stated reason is a discipline gap. The count exists to surface that gap."
          >
            <Stat label="Blocked" value={blockedCount} color="text-red-400" />
          </LearningHint>
          <LearningHint
            category="Tasks · Flow"
            title="In Progress"
            whatItIs="Tasks currently in the In Progress state — work that has been picked up but not yet completed."
            how="Use this to gauge work-in-flight. If In Progress is high but completion velocity is low, the team is starting too much and finishing too little — context-switching cost is eating output. The honest move when this happens is to STOP starting new tasks until in-progress drains."
            why="The single most reliable predictor of team output is how many things are simultaneously open in everyone's head. WIP (work in progress) count is the proxy for that load. Lean / kanban / agile literature converges on this because the underlying psychology converges on it."
            principle="WIP is the lever. Lower WIP and completions usually rise; higher WIP and completions usually fall."
          >
            <Stat label="In Progress" value={inProgressCount} color="text-blue-400" />
          </LearningHint>
          <LearningHint
            category="Tasks · Priority"
            title="Critical"
            whatItIs="Tasks the team has explicitly marked priority=Critical. Critical is the highest band — reserved for work that, if it slips, has consequences worth surfacing."
            why="Most priority schemes fail because every task ends up Critical by inflation. The honest discipline is to keep Critical SCARCE — if everything is critical, nothing is. The count above is your check: if Critical is greater than ~10% of Open, the team has lost the calibration and Critical no longer means anything."
            how="If this number feels too high, that's a signal. Walk through and demote tasks that should be High. The downstream payoff is that when Critical genuinely matters, the team responds."
            principle="Critical is a scarce resource. The count tells you whether the team is still treating it that way."
          >
            <Stat label="Critical" value={criticalCount} color="text-orange-400" />
          </LearningHint>
        </div>

        {/* Filter + Create */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <Filter className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
            {FILTERS.map((f) => {
              const hint = FILTER_HINTS[f];
              return (
                <LearningHint
                  key={f}
                  category="Tasks · Filter"
                  title={f}
                  whatItIs={hint.whatItIs}
                  why={hint.why}
                  how={hint.how}
                  principle={hint.principle}
                >
                  <button
                    type="button"
                    onClick={() => setActiveFilter(f)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      activeFilter === f
                        ? "bg-ember-400/15 text-brand border border-ember-400/30"
                        : "text-muted hover:text-secondary border border-transparent hover:border-default"
                    }`}
                  >
                    {f}
                  </button>
                </LearningHint>
              );
            })}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ExportMenu
              entity="tasks"
              disabled={!supabaseEnabled || mode === "demo-fixtures"}
              disabledReason="Export requires live mode (your data, not demo fixtures)."
            />
            <LearningHint
              category="Tasks"
              title="New task"
              whatItIs="Opens the task creation modal. A task in ELOSTATE has title, description, department, assignee, status, priority, AI priority score, impact level, blocker reason (required if status='Blocked'), and due date. Tasks emit events into the §3.1 chain — they're not just tickets, they're inputs to the team's reasoning."
              why="The reason a task system is built INTO this product (rather than relying on Jira/Asana) is that the chain depends on tasks emitting events the System can read. A task slipped, a task got blocked, a task got reassigned — each is a signal source. Without native tasks, the chain has nothing to derive from for the operational work the team is doing."
              how="Click to draft. State the title plainly, write a description that explains WHAT and WHY (the WHY is what makes the task connect to reasoning). Set priority honestly — not everything is Critical. If the task is blocked, the System will require a blocker reason; that's the discipline."
              principle="Tasks are units of work AND inputs to reasoning. The chain depends on the second function as much as the first."
            >
              <button
                onClick={openCreate}
                disabled={!supabaseEnabled}
                className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
              >
                <Plus className="w-3.5 h-3.5" />
              New task
            </button>
            </LearningHint>
          </div>
        </div>

        {/* List */}
        <div className="glass-card p-5">
          {loading ? (
            <div className="-mx-5 -mb-5">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState mode={mode} hasFilter={activeFilter !== "All"} />
          ) : (
            <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full min-w-[680px]">
              <thead>
                <tr className="border-b border-default">
                  {["Task", "Department", "Assignee", "Priority", "Status", "Due", ""].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-muted pb-3 pr-4 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-surface transition-colors group">
                    <td className="py-3 pr-4">
                      <a
                        href={`/dashboard/operations/${t.id}`}
                        className="block"
                      >
                        <p className="text-sm font-medium text-primary group-hover:text-brand transition-colors">
                          {t.title}
                          {!t.gateCleared && (
                            <LearningHint
                              category="Task · §3.2"
                              title="Understanding Gate · pending"
                              whatItIs="This badge means the task hasn't cleared the Understanding Gate yet — the four-question gate that asks WHAT you're trying to accomplish, WHO does what, HOW the work proceeds, and WHEN it lands. Until those answers exist, the task is in 'small task' or 'real task' draft state and can't be marked complete in the structural sense."
                              why="§3.2 (the Understanding Gate, applied to operational work) is the constitutional defense against starting work without a shared read. Most failed initiatives don't fail in execution; they fail because the team started without alignment on what 'done' looks like. The badge surfaces THAT risk before the work compounds."
                              how="Click into the task. Walk through the gate prompts. Either fill them in (most common — the gate just needed a few sentences) or escalate the task back to whoever drafted it so the gate gets a real answer. The badge disappears once the gate clears."
                              principle="Starting work before the gate clears is the team admitting it's willing to be wrong. The badge exists so that admission is visible."
                            >
                              <span className="ml-2 text-[9px] uppercase tracking-widest text-accent-text bg-gold-400/15 border border-gold-400/40 px-1.5 py-0.5 rounded">
                                gate
                              </span>
                            </LearningHint>
                          )}
                        </p>
                        {t.blockerReason && (
                          <p className="text-xs text-red-400 mt-0.5">⚠ {t.blockerReason}</p>
                        )}
                      </a>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-muted">{t.department ?? "—"}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-secondary">{t.assignee ?? "Unassigned"}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${PRIORITY_DOTS[t.priority] ?? PRIORITY_DOTS.Low}`}
                        />
                        <span className="text-xs text-secondary">{t.priority}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {/* §A18 — invitation labels instead of state
                          words. Same chain status, different reader
                          response. Tooltip carries the "what this
                          invites" so the leader knows what move
                          comes next. */}
                      {(() => {
                        const dl = taskDisplayLabel(t.status);
                        const Icon = dl.icon;
                        return (
                          <span
                            title={dl.invites}
                            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded border ${dl.tone.border} ${dl.tone.bg} ${dl.tone.text}`}
                          >
                            <Icon className="w-3 h-3" aria-hidden />
                            {dl.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-muted font-mono">{t.dueDate ?? "—"}</span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => openEdit(t)}
                        disabled={!supabaseEnabled || mode === "demo-fixtures"}
                        className="text-muted hover:text-brand disabled:opacity-30 mr-3"
                        aria-label={`Edit task: ${t.title}`}
                        title={
                          mode === "demo-fixtures"
                            ? "Demo fixtures are read-only"
                            : "Edit task"
                        }
                      >
                        <Pencil aria-hidden="true" className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteTask(t)}
                        disabled={!supabaseEnabled || mode === "demo-fixtures"}
                        className="text-muted hover:text-red-400 disabled:opacity-30"
                        aria-label={`Delete task: ${t.title}`}
                        title={
                          mode === "demo-fixtures"
                            ? "Demo fixtures are read-only"
                            : "Delete task"
                        }
                      >
                        <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        open={creating || !!editing}
        onClose={closeForm}
        title={editing ? "Edit task" : "New task"}
        size="lg"
      >
        <div className="space-y-3" aria-busy={submitting}>
          <Field label="Title" required>
            <Input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </Field>
          <Field label="Description">
            {/* Coach used to mount here. Removed — the Coach belongs
                inside the task's communication thread (built in v1),
                not on the description field at create time. A task's
                description is a *gate question* answer, not a
                conversation, so the Coach has no thread to surface
                against here. See A6 in ThinkerThinker.md. */}
            <Textarea
              value={draft.description}
              onChange={(e) =>
                setDraft({ ...draft, description: e.target.value })
              }
              rows={3}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Department">
              <Input
                value={draft.department}
                onChange={(e) =>
                  setDraft({ ...draft, department: e.target.value })
                }
                placeholder="Operations, Engineering, …"
              />
            </Field>
            <Field label="Assignee">
              {members.length > 0 ? (
                <Select
                  value={draft.assignee}
                  onChange={(e) =>
                    setDraft({ ...draft, assignee: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.fullName ?? ""}>
                      {m.fullName ?? "—"} ({m.role})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  value={draft.assignee}
                  onChange={(e) =>
                    setDraft({ ...draft, assignee: e.target.value })
                  }
                  placeholder="Free-text (invite team members to enable dropdown)"
                />
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <Select
                value={draft.status}
                onChange={(e) => setDraft({ ...draft, status: e.target.value })}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priority">
              <Select
                value={draft.priority}
                onChange={(e) =>
                  setDraft({ ...draft, priority: e.target.value })
                }
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Due date">
            <Input
              type="date"
              value={draft.dueDate}
              onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
            />
          </Field>
          {draft.status === "Blocked" && (
            <Field label="Blocker reason" required>
              <Input
                value={draft.blockerReason}
                onChange={(e) =>
                  setDraft({ ...draft, blockerReason: e.target.value })
                }
                placeholder="What's blocking this? Be specific — it becomes a signal."
              />
            </Field>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          {/* Sticky footer on mobile — the modal scrolls when fields
              exceed the visible viewport; the action buttons stayed
              at the bottom-of-content and disappeared off-screen.
              sticky + bottom-0 + bg-base/95 keeps the actions
              reachable while the user scrolls through fields. */}
          <div className="sticky bottom-0 -mx-6 -mb-6 px-6 py-3 bg-base/95 backdrop-blur-sm border-t border-default flex items-center justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={closeForm}
              className="text-xs text-muted hover:text-secondary px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              {submitting ? "Saving…" : editing ? "Save changes" : "Create task"}
              {!submitting && <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────

function ModeBanner(_: { mode: FetchTasksMode }): React.ReactElement | null {
  // User-facing demo-mode banner removed (sweep). The mode prop is
  // still threaded in case future surfaces (e.g. an empty-state hint)
  // want to switch on it without re-introducing the banner flash that
  // auth'd users were seeing on initial load.
  return null;
}

function EmptyState({ mode, hasFilter }: { mode: FetchTasksMode; hasFilter: boolean }) {
  if (hasFilter) {
    return (
      <p className="text-center text-xs text-muted py-10">
        No tasks match this filter.
      </p>
    );
  }
  if (mode === "live-empty") {
    return (
      <div className="text-center py-12 px-6">
        <p className="text-sm text-primary mb-2">No tasks yet.</p>
        <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
          Use the composer above to create your first task. As your team
          works, ELOSTATE will spot patterns across what gets done, what
          gets stuck, and where decisions need to happen — and surface
          them as you accumulate enough activity for the patterns to be
          real.
        </p>
      </div>
    );
  }
  return (
    <p className="text-center text-xs text-muted py-10">No tasks.</p>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-muted uppercase tracking-widest mb-2">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>
        {value}
        <span className="text-sm font-normal text-muted"> tasks</span>
      </p>
    </div>
  );
}

// Field migrated to @/components/ui/Field
