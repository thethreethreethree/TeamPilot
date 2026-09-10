/**
 * Where signed recording links are held, kept apart from the code that mints
 * them.
 *
 * SPLIT FOR THE THIRD TIME IN THIS PROJECT, and for the same reason each time:
 * minting a link needs the Supabase client, which drags React Native polyfills
 * behind it, and anything importing that becomes untestable under plain Node.
 * Here the thing stranded behind it was the SIGN-OUT SWEEP — the security
 * boundary that stops one rep's data reaching the next person to hold the phone.
 * A sweep that cannot be tested is a sweep nobody notices has stopped working.
 *
 * IN MEMORY, NEVER ON DISK. A signed URL is a bearer credential for the audio of
 * a real conversation: whoever holds it can play the call for as long as it
 * lives. That is exactly the thing not to persist.
 */
export type SignedEntry = { url: string; expiresAt: number };

const cache = new Map<string, SignedEntry>();

export function getSignedUrl(key: string, marginMs: number, now = Date.now()): string | null {
  const held = cache.get(key);
  if (held && held.expiresAt - marginMs > now) return held.url;
  return null;
}

export function putSignedUrl(key: string, entry: SignedEntry): void {
  cache.set(key, entry);
}

/**
 * Called on sign-out.
 *
 * Not swept with the on-disk caches — it is in memory, so it has to be dropped
 * explicitly, and on a shared phone that difference is the whole point.
 */
export function clearSignedRecordingUrls(): void {
  cache.clear();
}
