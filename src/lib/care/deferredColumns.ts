import { isMissingColumnError, type PostgrestLikeError } from "@/lib/coach/v5/migrationGuard";

/**
 * A34 migration-coupling helper for a multi-field config upsert.
 *
 * Some columns land with LATER migrations (e.g. care_tenant_config.business_type=0188,
 * ai_assistance_guidance=0202). Until applied, one missing column rejects the ENTIRE upsert, so a save of
 * unrelated settings (color, greeting…) would fail. The fix is to drop the not-yet-applied column(s) and
 * retry — but WHICH to drop must be exact, or we either fail again (dropped too few) or silently discard a
 * real edit (dropped too many). This is that decision, extracted as a pure, unit-pinned function.
 *
 * Rule: `deferrable` is ordered by migration (earliest first). Postgres reports one missing column per
 * error, and migrations apply in order — so a missing EARLIER column implies the later ones are missing
 * too. On a miss at index i, drop that column AND every later-migration deferrable column that is in the
 * patch. If the error is anything OTHER than a deferrable column being absent, return [] (the caller must
 * keep that error loud — a real error must never be swallowed into a false success).
 */
export function deferredColumnsToDrop(
  deferrable: readonly string[],
  patch: Record<string, unknown>,
  error: PostgrestLikeError
): string[] {
  const firstMissing = deferrable.findIndex(
    (c) => c in patch && isMissingColumnError(error, c)
  );
  if (firstMissing < 0) return [];
  return deferrable.slice(firstMissing).filter((c) => c in patch);
}
