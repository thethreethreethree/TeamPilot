import type { SpawnedTaskDraft } from "./types";

/**
 * Shared validator for a spawned task DRAFT (the LLM returns JSON; we never trust its shape).
 *
 * Extracted so the in-app /api/tasks/spawn route AND the browser-extension spawn endpoint validate IDENTICALLY
 * — §A26 (one validator, not two copies that drift). Returns the trimmed draft, or null if the shape is invalid
 * (the caller then 502s). Bounds mirror the persisted `tasks` columns: title ≤400, description ≤8000, 1–20 steps
 * of ≤800 each.
 */
export function validateTaskDraft(parsed: unknown): SpawnedTaskDraft | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  if (typeof r.title !== "string" || r.title.trim().length === 0 || r.title.length > 400) {
    return null;
  }
  if (
    typeof r.description !== "string" ||
    r.description.trim().length === 0 ||
    r.description.length > 8000
  ) {
    return null;
  }
  if (!Array.isArray(r.steps) || r.steps.length === 0 || r.steps.length > 20) return null;
  const steps: string[] = [];
  for (const s of r.steps) {
    if (typeof s !== "string" || s.trim().length === 0 || s.length > 800) return null;
    steps.push(s.trim());
  }
  return { title: r.title.trim(), description: r.description.trim(), steps };
}
