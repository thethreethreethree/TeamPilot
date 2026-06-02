import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { mockTasks } from "@/lib/mock-data";

export type Task = {
  id: string;
  title: string;
  description: string | null;
  department: string | null;
  assignee: string | null;
  status: string;
  priority: string;
  aiPriorityScore: number;
  impactLevel: string | null;
  blockerReason: string | null;
  dueDate: string | null;
};

const fromMock = (): Task[] =>
  mockTasks.map((t) => ({
    id: t.id,
    title: t.title,
    description: t.description,
    department: t.department,
    assignee: t.assignee,
    status: t.status,
    priority: t.priority,
    aiPriorityScore: t.aiPriorityScore,
    impactLevel: t.impactLevel,
    blockerReason: t.blockerReason,
    dueDate: t.dueDate,
  }));

export type FetchTasksMode = "demo-fixtures" | "live-empty" | "live-data";

/**
 * Production fetcher. No silent mock fallback.
 *
 * - Demo mode (no Supabase keys): returns mock fixtures with mode='demo-fixtures'.
 *   The caller is responsible for displaying the demo banner.
 * - Live mode, no rows: returns empty array with mode='live-empty'. The caller
 *   shows an honest empty state ("create your first task"), NOT mock fixtures.
 *   This was the silent-fallback bug — demo data dressed as live data.
 * - Live mode, with rows: returns real data with mode='live-data'.
 */
export async function fetchTasks(): Promise<{ tasks: Task[]; mode: FetchTasksMode }> {
  if (!supabaseEnabled) {
    return { tasks: fromMock(), mode: "demo-fixtures" };
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, department, assignee, status, priority, ai_priority_score, impact_level, blocker_reason, due_date"
    )
    .is("deleted_at", null)
    .order("ai_priority_score", { ascending: false });

  if (error || !data) {
    return { tasks: [], mode: "live-empty" };
  }

  const tasks: Task[] = data.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    department: row.department,
    assignee: row.assignee,
    status: row.status,
    priority: row.priority,
    aiPriorityScore: row.ai_priority_score,
    impactLevel: row.impact_level,
    blockerReason: row.blocker_reason,
    dueDate: row.due_date,
  }));

  return {
    tasks,
    mode: tasks.length === 0 ? "live-empty" : "live-data",
  };
}
