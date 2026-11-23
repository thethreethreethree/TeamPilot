/**
 * Vulnerability disclosure (2026-11-23, migration 0312). The checks a public security report must pass, mirroring the
 * table's own limits so a refusal comes back as a readable 400, not a database error. Pure, so they are tested.
 */
export const REPORT_STATUSES = ["triaged", "fixed", "not_an_issue", "duplicate"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export type CleanReport = { summary: string; details: string; affected: string | null; reporterName: string | null; reporterContact: string | null };

const opt = (v: unknown, max: number): string | null | false => {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (!t) return null;
  return t.length <= max ? t : false;
};

export function cleanReport(b: Record<string, unknown>): CleanReport | { error: string } {
  const summary = typeof b.summary === "string" ? b.summary.trim() : "";
  const details = typeof b.details === "string" ? b.details.trim() : "";
  if (summary.length < 5 || summary.length > 200) return { error: "Give a short summary (5 to 200 characters)." };
  if (details.length < 20 || details.length > 8000) return { error: "Describe the issue and how to reproduce it (20 to 8000 characters)." };
  const affected = opt(b.affected, 500);
  const reporterName = opt(b.name, 100);
  const reporterContact = opt(b.contact, 200);
  if (affected === false) return { error: "The affected page or address is too long (500 characters at most)." };
  if (reporterName === false) return { error: "The name is too long (100 characters at most)." };
  if (reporterContact === false) return { error: "The contact is too long (200 characters at most)." };
  return { summary, details, affected, reporterName, reporterContact };
}

/** Latest status per report ("received" when nothing has been recorded yet). */
export function currentStatus(events: Array<{ report_id: string; status: string; note: string | null; created_at: string }>): Map<string, { status: string; note: string | null; at: string }> {
  const out = new Map<string, { status: string; note: string | null; at: string }>();
  for (const e of [...events].sort((a, b) => a.created_at.localeCompare(b.created_at))) out.set(e.report_id, { status: e.status, note: e.note, at: e.created_at });
  return out;
}

/** Reports with no response recorded yet (no status event) — the founders' "waiting" count (2026-11-23). */
export function waitingCount(reportIds: string[], events: Array<{ report_id: string }>): number {
  const answered = new Set(events.map((e) => String(e.report_id)));
  return reportIds.filter((id) => !answered.has(String(id))).length;
}
