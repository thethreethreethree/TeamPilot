/**
 * Training courses — ordered lessons a manager writes and assigns (2026-11-26, Gong ledger F17.1; migration 0355).
 *
 * A course's lessons are stored as VERSIONS (§3.1): saving writes a whole new set of rows, and the current course is
 * the highest version. A lesson keeps its step_uid across versions, so a rep's "done" survives a reorder or a
 * rewording; a lesson removed from the current version simply stops counting. Progress is DERIVED here — one function
 * for the rep's list and the manager's table (§2.2). Pure, so it is tested.
 */
export const MAX_STEPS = 50;
export const TITLE_MAX = 120;
export const BODY_MAX = 4000;
export const SUMMARY_MAX = 600;

export type StepRow = { version: number; position: number; step_uid: string; title: string; body: string };
export type Step = { uid: string; title: string; body: string };

/** The current version's lessons, in order. */
export function currentSteps(rows: StepRow[]): Step[] {
  if (!rows.length) return [];
  const v = Math.max(...rows.map((r) => Number(r.version)));
  return rows
    .filter((r) => Number(r.version) === v)
    .sort((a, b) => a.position - b.position)
    .map((r) => ({ uid: String(r.step_uid), title: r.title, body: r.body }));
}

export function currentVersion(rows: Array<{ version: number }>): number {
  return rows.length ? Math.max(...rows.map((r) => Number(r.version))) : 0;
}

export type CourseState = "not_started" | "in_progress" | "done" | "overdue";
/** Done = every CURRENT lesson marked done; overdue = past due and not done. Completions of removed lessons don't count. */
export function courseProgress(args: { steps: Step[]; doneUids: Iterable<string>; dueAt: string; now?: Date }): { done: number; total: number; state: CourseState } {
  const done = new Set(args.doneUids);
  const total = args.steps.length;
  const n = args.steps.filter((s) => done.has(s.uid)).length;
  if (total > 0 && n === total) return { done: n, total, state: "done" };
  const now = (args.now ?? new Date()).getTime();
  if (Date.parse(args.dueAt) < now) return { done: n, total, state: "overdue" };
  return { done: n, total, state: n === 0 ? "not_started" : "in_progress" };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The lessons a manager sent, checked: 1–MAX_STEPS, each with a title and text in bounds. A lesson that already exists
 * sends its uid back and keeps it; a new one gets a fresh uid (`newUid`). Returns an error sentence or the steps.
 */
export function parseSteps(raw: unknown, newUid: () => string): { ok: true; steps: Step[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Add at least one lesson." };
  if (raw.length > MAX_STEPS) return { ok: false, error: `A course has at most ${MAX_STEPS} lessons.` };
  const steps: Step[] = [];
  const seen = new Set<string>();
  for (const [i, r] of raw.entries()) {
    const o = (r ?? {}) as { uid?: unknown; title?: unknown; body?: unknown };
    const title = typeof o.title === "string" ? o.title.trim() : "";
    const body = typeof o.body === "string" ? o.body.trim() : "";
    if (!title || title.length > TITLE_MAX) return { ok: false, error: `Lesson ${i + 1} needs a title of up to ${TITLE_MAX} characters.` };
    if (!body || body.length > BODY_MAX) return { ok: false, error: `Lesson ${i + 1} needs text of up to ${BODY_MAX} characters.` };
    let uid = typeof o.uid === "string" && UUID.test(o.uid) ? o.uid.toLowerCase() : newUid();
    if (seen.has(uid)) uid = newUid(); // a duplicated lesson is a new lesson, not the same one twice
    seen.add(uid);
    steps.push({ uid, title, body });
  }
  return { ok: true, steps };
}
