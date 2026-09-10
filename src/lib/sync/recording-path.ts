/**
 * Reading the path the server stored for a call's audio.
 *
 * SEPARATE FROM THE SIGNING, and for a reason this project has now met twice:
 * the module that signs a URL must import the Supabase client, which drags React
 * Native polyfills behind it, and that puts the PARSING behind a native
 * dependency. Parsing is the half most worth testing — a path shape this code
 * misreads produces a "Listen to this call" control that appears and then does
 * nothing, on a session whose recording is perfectly safe. A rule that can only
 * be exercised on a device is a rule that will not be exercised.
 *
 * WHAT THE SERVER ACTUALLY STORES. TeamPilot's upload route writes
 * `${ASSETS_BUCKET}/${storagePath}` into `coaching_sessions.audio_asset_url` —
 * a bucket name, a slash, then the object path, which itself contains slashes.
 * Read from the FIRST slash, never the last: splitting the other way would drop
 * the folders and confidently sign a path that does not exist.
 */

/**
 * Split "assets-v1/company-id/file.m4a" into its bucket and its object path.
 *
 * Returns null for anything that is not that shape — the empty string, a full
 * http URL an older row might hold, a bucket with no object. Null means "no
 * playback", never an error: a session whose audio cannot be located is still a
 * session worth reading, and a thrown exception here would take the whole screen
 * down over a control the rep had not pressed.
 */
export function splitAssetPath(
  assetUrl: string | null | undefined,
): { bucket: string; path: string } | null {
  const raw = (assetUrl ?? '').trim();
  if (!raw || raw.includes('://')) return null;
  const slash = raw.indexOf('/');
  if (slash <= 0 || slash === raw.length - 1) return null;
  return { bucket: raw.slice(0, slash), path: raw.slice(slash + 1) };
}
