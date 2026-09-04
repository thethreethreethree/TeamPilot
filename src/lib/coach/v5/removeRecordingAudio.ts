import { ASSETS_BUCKET } from "@/lib/storage/assets";
import { chunkPrefix } from "@/lib/coach/v5/stitchSessionAudio";

/**
 * Remove one session's audio bytes from storage.
 *
 * EXTRACTED FROM `recording-purge-cron` when a second caller appeared — the manager delete control. Copying that
 * loop body would have put the most dangerous branch in this codebase in two places, and the branch is dangerous
 * for a reason that is not obvious from reading it:
 *
 *   **`storage.remove()` on a path that does not exist returns NO error.** So a caller that guesses at the shape
 *   of `audio_asset_url`, removes nothing, and then nulls the column reports a successful deletion while the audio
 *   survives forever — unreferenced, unfindable, and still a recording of a real customer conversation. That is
 *   the false-ok write class, in the one place it must never exist: the code whose whole job is to make a
 *   deletion promise true.
 *
 * SO A POINTER WE DO NOT RECOGNISE IS NOT DELETED. Three writers touch `audio_asset_url` and they do not agree on
 * its shape: `upload-recording` writes `${ASSETS_BUCKET}/${path}`, the session PATCH route's zod accepts a full
 * URL. If it is not bucket-relative we cannot know whether the object exists, so we refuse and say so, rather than
 * clearing the pointer and calling it done.
 *
 * "ALREADY GONE" IS DIFFERENT FROM "NOT FOUND BY US", and both converge: a remove that reports the object missing
 * is a success, because the desired end state — no bytes — already holds. Only a real storage failure is a
 * failure, and then the caller must leave the row alone so the pointer still names a live asset.
 *
 * INJECTED CLIENT, NOT AN IMPORTED ONE. `createAdminClient` reaches the network, so a module that constructs its
 * own could not be tested. The rules above are exactly the rules that must be tested, so the client arrives as an
 * argument narrow enough for a fake to satisfy.
 */

/** The slice of a Supabase storage client this needs. Narrow so a test can implement it. */
export type RecordingStorage = {
  from(bucket: string): {
    remove(paths: string[]): Promise<{ error: { message: string } | null }>;
    list(
      prefix: string,
      options?: { limit?: number },
    ): Promise<{ data: { name: string }[] | null; error?: { message: string } | null }>;
  };
};

export type RemoveRecordingResult =
  /** The bytes are gone (or were already). The caller may now clear the pointer. */
  | { ok: true; chunksRemoved: number }
  /** The pointer is not a shape we recognise. Do NOT clear it — flag it. */
  | { ok: false; reason: "malformed-pointer" }
  /** Storage refused. Do NOT clear the pointer, or it will orphan a live asset. */
  | { ok: false; reason: "storage-failed"; message: string };

/** A remove error that means the object is not there — which is the end state we wanted anyway. */
function isAlreadyGone(message: string): boolean {
  return /not found|does not exist/i.test(message);
}

export async function removeRecordingAudio(
  storage: RecordingStorage,
  args: { audioAssetUrl: string; companyId: string | null; sessionId: string },
): Promise<RemoveRecordingResult> {
  const { audioAssetUrl, companyId, sessionId } = args;

  if (!audioAssetUrl.startsWith(`${ASSETS_BUCKET}/`)) {
    return { ok: false, reason: "malformed-pointer" };
  }
  const path = audioAssetUrl.slice(ASSETS_BUCKET.length + 1);

  const { error: rmErr } = await storage.from(ASSETS_BUCKET).remove([path]);
  if (rmErr && !isAlreadyGone(rmErr.message)) {
    return { ok: false, reason: "storage-failed", message: rmErr.message };
  }

  /**
   * The incremental chunk objects, too.
   *
   * A cleanly-stopped session's chunks are orphaned: the full-blob persist set `audio_asset_url`, so
   * `stitchSessionAudio` — which deletes chunks on success — never ran. They live under
   * `${company}/${session}/chunks/`, keyed on the SESSION id, which is not derivable from the audio path
   * (that uses a fileId). Hence both ids.
   *
   * Best-effort and idempotent. Orphaned chunks are wasteful rather than harmful, and a failure here must not
   * stop the caller clearing a pointer whose main object is already gone — that would leave the row pointing at
   * nothing and retrying forever.
   */
  let chunksRemoved = 0;
  if (companyId) {
    const prefix = chunkPrefix(companyId, sessionId);
    try {
      const { data: chunkObjs } = await storage.from(ASSETS_BUCKET).list(prefix, { limit: 2000 });
      const names = (chunkObjs ?? []).map((o) => `${prefix}/${o.name}`);
      if (names.length > 0) {
        await storage.from(ASSETS_BUCKET).remove(names);
        chunksRemoved = names.length;
      }
    } catch {
      /* best-effort — see above */
    }
  }

  return { ok: true, chunksRemoved };
}
