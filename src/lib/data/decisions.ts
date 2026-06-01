import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { mockDecisionHistory } from "@/lib/mock-data";

export type DecisionRecord = {
  id: string;
  title: string;
  date: string;
  outcome: string;
  executionStatus: string;
  hasDialogue: boolean;
};

const fromMock = (): DecisionRecord[] =>
  mockDecisionHistory.map((d) => ({
    id: d.id,
    title: d.title,
    date: d.date,
    outcome: d.outcome,
    executionStatus: d.executionStatus,
    hasDialogue: false,
  }));

export async function fetchDecisions(): Promise<{
  decisions: DecisionRecord[];
  isMock: boolean;
}> {
  if (!supabaseEnabled) return { decisions: fromMock(), isMock: true };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("decisions")
    .select("id, title, outcome, execution_status, created_at, decision_dialogues(id)")
    .order("created_at", { ascending: false });

  if (error || !data || data.length === 0) {
    return { decisions: fromMock(), isMock: true };
  }

  const decisions: DecisionRecord[] = data.map((row) => {
    const dialogues = row.decision_dialogues as Array<{ id: string }> | null;
    return {
      id: row.id,
      title: row.title,
      date: (row.created_at ?? "").slice(0, 10),
      outcome: row.outcome ?? "",
      executionStatus: row.execution_status ?? "In Progress",
      hasDialogue: Array.isArray(dialogues) && dialogues.length > 0,
    };
  });
  return { decisions, isMock: false };
}
