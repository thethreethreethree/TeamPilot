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

/**
 * Returns tasks for the current company.
 * Falls back to bundled mock data when Supabase is disabled OR when the
 * authenticated company has no rows yet (so the UI never looks broken).
 */
export async function fetchTasks(): Promise<{ tasks: Task[]; isMock: boolean }> {
  if (!supabaseEnabled) return { tasks: fromMock(), isMock: true };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, title, description, department, assignee, status, priority, ai_priority_score, impact_level, blocker_reason, due_date"
    )
    .order("ai_priority_score", { ascending: false });

  if (error || !data || data.length === 0) {
    return { tasks: fromMock(), isMock: true };
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
  return { tasks, isMock: false };
}
