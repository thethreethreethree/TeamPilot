import type { SupabaseClient } from "@supabase/supabase-js";
import { recordAudit } from "../audit/recordAudit";

/**
 * Remove recordings in storage that nothing points at (docs/STORAGE-ORPHANS-2026-11-21.md; founder decision
 * 2026-11-21: delete, dry-run first, plus a nightly sweeper).
 *
 * WHAT IS A CANDIDATE is decided ONCE, in SQL: `rss_unreferenced_uploads` (migration 0299) — dated upload shape,
 * audio/video, older than the minimum age, named by no column that can hold an upload's path. This module never
 * re-derives that (§2.2); it lists, and removes what the function listed.
 *
 * WHY THE STORAGE API AND NOT A DELETE ON storage.objects: deleting the row would leave the bytes in the storage
 * backend with nothing pointing at them — the very defect this exists to clean up.
 *
 * WHY COUNT WHAT STORAGE CONFIRMS: `remove()` on a path that does not exist returns no error (removeRecordingAudio.ts
 * header), so "asked to remove N" is not "removed N". The report and the audit row use the names Storage returns as
 * removed — never the request (the false-ok write class).
 *
 * Callers: the nightly cron (`/api/coach/sales-session/unreferenced-upload-sweep-cron`, 24 h minimum age — a
 * sign-then-commit upload's commit arrives in seconds) and the one-time cleanup script (7 days). Relative imports only,
 * so the script can load this file directly.
 */
export const SWEEP_BUCKET = "assets-v1";
const BATCH = 100;

export type Candidate = { name: string; company_id: string; bytes: number; created_at: string; mimetype: string | null };
export type SweepReport = {
  dryRun: boolean;
  minAgeHours: number;
  candidates: number;
  candidateBytes: number;
  removed: number;
  removedBytes: number;
  byCompany: Record<string, { files: number; bytes: number }>;
  /** Set when a step failed; whatever was removed before it is still reported and audited. */
  error: string | null;
};

export async function sweepUnreferencedUploads(
  admin: SupabaseClient,
  opts: { minAgeHours: number; dryRun: boolean; limit?: number },
): Promise<SweepReport> {
  const minAgeHours = Math.max(1, Math.floor(opts.minAgeHours));
  const report: SweepReport = {
    dryRun: opts.dryRun,
    minAgeHours,
    candidates: 0,
    candidateBytes: 0,
    removed: 0,
    removedBytes: 0,
    byCompany: {},
    error: null,
  };

  const { data, error } = await admin.rpc("rss_unreferenced_uploads", {
    p_min_age: `${minAgeHours} hours`,
    p_limit: opts.limit ?? 500,
  });
  if (error) {
    report.error = `list failed: ${error.message}`;
    return report;
  }
  const candidates = (data ?? []) as Candidate[];
  report.candidates = candidates.length;
  report.candidateBytes = candidates.reduce((n, c) => n + Number(c.bytes ?? 0), 0);
  if (opts.dryRun || candidates.length === 0) {
    for (const c of candidates) bump(report.byCompany, c.company_id, Number(c.bytes ?? 0));
    return report;
  }

  const byName = new Map(candidates.map((c) => [c.name, c]));
  const removedByCompany = new Map<string, Candidate[]>();
  for (let i = 0; i < candidates.length; i += BATCH) {
    const batch = candidates.slice(i, i + BATCH).map((c) => c.name);
    const { data: gone, error: rmErr } = await admin.storage.from(SWEEP_BUCKET).remove(batch);
    if (rmErr) {
      report.error = `remove failed after ${report.removed} file(s): ${rmErr.message}`;
      break;
    }
    for (const g of (gone ?? []) as Array<{ name: string }>) {
      const c = byName.get(g.name);
      if (!c) continue; // Storage confirmed something we did not ask for — never counted
      report.removed += 1;
      report.removedBytes += Number(c.bytes ?? 0);
      bump(report.byCompany, c.company_id, Number(c.bytes ?? 0));
      (removedByCompany.get(c.company_id) ?? removedByCompany.set(c.company_id, []).get(c.company_id)!).push(c);
    }
  }

  // One audit row per company, naming every removed path (ids only — no customer data in the path).
  for (const [companyId, files] of removedByCompany) {
    await recordAudit(admin, {
      companyId,
      actorId: null,
      action: "recording.orphan_purge",
      objectType: "storage_bucket",
      objectId: SWEEP_BUCKET,
      meta: {
        files: files.length,
        bytes: files.reduce((n, f) => n + Number(f.bytes ?? 0), 0),
        minAgeHours,
        reason: "no row references this recording (rss_unreferenced_uploads, 0299)",
        paths: files.map((f) => f.name),
      },
    });
  }
  return report;
}

function bump(m: Record<string, { files: number; bytes: number }>, company: string, bytes: number) {
  const e = m[company] ?? (m[company] = { files: 0, bytes: 0 });
  e.files += 1;
  e.bytes += bytes;
}
