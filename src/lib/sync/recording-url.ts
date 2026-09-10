/**
 * Getting a playable link to a call the server already holds.
 *
 * WHY THIS EXISTS. A rep can listen to a recording while it is still on the
 * phone, and never again after it uploads — the local file is deleted once the
 * server confirms it, which is right, because keeping every call forever would
 * fill the device. But that left the most useful listening moment unreachable:
 * reading a transcript a day later, hitting the line where the objection landed,
 * and wanting to hear how it was actually said. Tone is most of what happened in
 * a sales call and none of it survives into text.
 *
 * ZERO BACKEND CHANGE, and that was worth checking rather than assuming. The
 * session row carries `audio_asset_url` as a bucket-relative path, and migration
 * 0062 grants authenticated users SELECT on objects inside their own company's
 * folder. So the app can sign a URL directly through the Supabase client, under
 * the same RLS the rest of its reads use. Nothing new to deploy.
 *
 * WHAT THE POLICY ACTUALLY SAYS, stated honestly because it is not what a
 * careless reading would assume: the storage policy is scoped to the COMPANY,
 * not to the owner. It would let a rep sign a colleague's recording if they knew
 * the path. The app never gives them one — every path it uses comes from a
 * session row it could already read, and those are scoped to the rep — but the
 * protection there is the sessions table's RLS, not storage's. Worth knowing
 * before anyone builds a screen that takes a storage path from anywhere else.
 *
 * WHY IT IS CACHED IN MEMORY. Signing is a network round trip. Without a cache,
 * every re-render of a screen that shows a player would spend one, and a rep
 * scrubbing through a transcript re-renders constantly. In memory only: a signed
 * URL is a bearer credential for that object and does not belong on disk.
 */
import { supabase } from '@/lib/supabase';
import { splitAssetPath } from './recording-path';
import { getSignedUrl, putSignedUrl, clearSignedRecordingUrls } from './recording-url-cache';

export { splitAssetPath, clearSignedRecordingUrls };

/**
 * How long a signed link lives.
 *
 * Long enough to listen to a whole call twice without it dying mid-sentence, and
 * short enough that a URL captured from a log or a screenshot stops working the
 * same working day. The player holds the URL for the life of the screen, so a
 * longer window buys nothing.
 */
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Re-sign a little before expiry rather than at it, so a link never dies mid-play. */
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * A playable URL for a session's recording, or null when there is not one.
 *
 * Never throws. Every failure — no audio on the row, a path shape this does not
 * recognise, storage refusing, no network — comes back as null, and the caller
 * simply does not offer playback. An error dialog about a signing failure would
 * be a technical complaint about a feature the rep did not ask for yet.
 */
export async function signedRecordingUrl(
  assetUrl: string | null | undefined,
): Promise<string | null> {
  const parts = splitAssetPath(assetUrl);
  if (!parts) return null;

  const key = `${parts.bucket}/${parts.path}`;
  const held = getSignedUrl(key, REFRESH_MARGIN_MS);
  if (held) return held;

  try {
    const { data, error } = await supabase.storage
      .from(parts.bucket)
      .createSignedUrl(parts.path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    putSignedUrl(key, {
      url: data.signedUrl,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });
    return data.signedUrl;
  } catch {
    return null;
  }
}

