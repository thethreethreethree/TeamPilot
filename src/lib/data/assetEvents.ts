import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Asset System v1 — event emission helpers.
 *
 * Per CLAUDE.md §3.1 (events immutable, entity state derived from
 * event replay) and §A14 (data path complete ≠ render path complete),
 * the `asset_event_kinds` view in migration 0057 declares the
 * vocabulary; this module is the render path that emits.
 *
 * Per the inspection closure 2026-06-19-asset-system-v1-inspection.md:
 * before this module, the vocabulary had zero emitters. Finding 1
 * (severity HIGH).
 *
 * Uses the admin client because some events are emitted from
 * customer-widget paths where no user is authenticated (customer
 * upload from widget — actor null, see migration 0054 lesson:
 * `events.actor` is NULL-able and the zero-UUID sentinel is the wrong
 * shape).
 */

type AssetEventKind =
  | "asset.file.uploaded"
  | "asset.file.classified"
  | "asset.file.viewed"
  | "asset.file.downloaded"
  | "asset.file.shared"
  | "asset.file.cited"
  | "asset.file.deprecated"
  | "asset.file.access_changed"
  | "asset.suggestion.acted_on";

export async function emitAssetEvent(args: {
  companyId: string;
  actor: string | null;
  kind: AssetEventKind;
  fileId: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const sb = createAdminClient();
  const { error } = await sb.from("events").insert({
    company_id: args.companyId,
    actor: args.actor,
    kind: args.kind,
    subject: `file:${args.fileId}`,
    payload: {
      file_id: args.fileId,
      ...(args.payload ?? {}),
    },
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.error(
      `[asset-events] emit failed kind=${args.kind} file=${args.fileId} error=${error.message}`
    );
  }
}
