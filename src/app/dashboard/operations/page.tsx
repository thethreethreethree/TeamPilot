"use client";

import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import { fetchTasks, type FetchTasksMode, type Task } from "@/lib/data/tasks";
import { fetchTeam, type TeamMember } from "@/lib/data/team";
import { supabaseEnabled } from "@/lib/supabase/client";
import Modal from "@/components/ui/Modal";
import { Field, Input, Textarea, Select } from "@/components/ui/Field";
import ExportMenu from "@/components/ui/ExportMenu";
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type FilterType = "All" | "Blocked" | "In Progress" | "To Do" | "Needs Review" | "Completed";

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

const STATUS_OPTIONS = ["To Do", "In Progress", "Blocked", "Needs Review", "Completed"];
const PRIORITY_OPTIONS = ["Low", "Medium", "High", "Critical"];

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
    const res = await fetch(`/api/tasks?id=${encodeURIComponent(t.id)}`, {
      method: "DELETE",
    });
    if (res.ok) refresh();
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Tasks"
        subtitle="Production task management · every mutation emits an event into the §3.1 chain"
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <ModeBanner mode={mode} />

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Open tasks" value={tasks.length} color="text-primary" />
          <Stat label="Blocked" value={blockedCount} color="text-red-400" />
          <Stat label="In Progress" value={inProgressCount} color="text-blue-400" />
          <Stat label="Critical" value={criticalCount} color="text-orange-400" />
        </div>

        {/* Filter + Create */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-muted" />
            {FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeFilter === f
                    ? "bg-[#FACC15]/15 text-brand border border-[#FACC15]/30"
                    : "text-muted hover:text-secondary border border-transparent hover:border-default"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <ExportMenu
              entity="tasks"
              disabled={!supabaseEnabled || mode === "demo-fixtures"}
              disabledReason="Export requires live mode (your data, not demo fixtures)."
            />
            <button
              onClick={openCreate}
              disabled={!supabaseEnabled}
              className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
              title={
                supabaseEnabled
                  ? "Create a new task"
                  : "Live mode required — configure Supabase to create tasks"
              }
            >
              <Plus className="w-3.5 h-3.5" />
              New task
            </button>
          </div>
        </div>

        {/* List */}
        <div className="glass-card p-5">
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted py-10 justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading tasks…
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState mode={mode} hasFilter={activeFilter !== "All"} />
          ) : (
            <table className="w-full">
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
                            <span className="ml-2 text-[9px] uppercase tracking-widest text-accent-text bg-gold-400/15 border border-gold-400/40 px-1.5 py-0.5 rounded">
                              gate
                            </span>
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
                      <StatusBadge status={t.status} />
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
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={closeForm}
              className="text-xs text-muted hover:text-secondary px-3 py-2"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              {submitting ? "Saving…" : editing ? "Save changes" : "Create task"}
              {!submitting && <CheckCircle2 className="w-3.5 h-3.5" />}
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

function ModeBanner({ mode }: { mode: FetchTasksMode }) {
  if (mode === "live-data") return null;
  if (mode === "demo-fixtures") {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
        <AlertTriangle className="w-4 h-4 text-yellow-300 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-primary">
          <p className="font-medium mb-1">Demo fixtures · Supabase not configured.</p>
          <p className="text-primary/70">
            You&apos;re viewing read-only sample data so the UI is browsable. Tasks created here
            do nothing. Configure Supabase keys in <code>.env.local</code> and re-run the
            migrations to use the production task system.
          </p>
        </div>
      </div>
    );
  }
  // live-empty — no banner; the empty state handles it.
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
          Create your first task above. Every task mutation emits an immutable event into
          the §3.1 chain — events become signals, signals accumulate into patterns,
          patterns earn the right to surface as problems. The diagnostic engine has
          nothing to operate on until events exist.
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
