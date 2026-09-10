/**
 * Macro Mode — the switch that changes what this app IS.
 *
 * WHAT IT ACTUALLY DOES, read out of the web shell rather than guessed. It is
 * not a preference; it swaps the product. With it ON the rep gets the
 * door-to-door surfaces — the Door Log as the one hero action, door counts, and
 * a tab bar of Home / Pitch Performance / Today's Metrics / Role Play. With it
 * OFF they get the standard coach: sessions, the numbers, the launchpad.
 *
 * IT IS PER-REP AND IT LIVES ON THE SERVER (`profiles.macro_mode_enabled`), so a
 * rep who turns it on at their desk finds it on at the door, and a manager who
 * sets it for someone does not have to explain where the setting went. That is
 * why this reads through the API rather than keeping a local flag.
 *
 * THE LOCAL COPY IS A CACHE, NOT THE TRUTH. It exists so the app opens into the
 * right product instead of flickering through the wrong one — the web has the
 * same problem and solves it by holding a skeleton while the fetch is in flight,
 * with an explicit note that folding "unknown" into "off" flashed the wrong
 * product on every load. This app cannot show a skeleton on a tab bar, so it
 * remembers the last known answer instead and corrects it when the server
 * replies.
 *
 * UNKNOWN IS A THIRD STATE, never silently "off". `null` means the app has not
 * been told yet, and callers are expected to hold rather than guess.
 */


import { coachGet, coachPost } from '@/lib/coach-api';
import { authFailureOf, type AuthFailure } from '@/lib/auth-failure';
import {
  cacheMacroMode,
  clearCachedMacroMode,
  readCachedMacroMode,
} from './macro-mode-store';

// Re-exported so callers keep one import. The CACHE lives next door because the
// sign-out sweep must be able to clear it without loading a network client.
export { readCachedMacroMode, clearCachedMacroMode };

export type MacroResult =
  | { ok: true; enabled: boolean }
  /** The app cannot ask yet. Callers fall back to the cached answer. */
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed' };

export async function fetchMacroMode(userId: string): Promise<MacroResult> {
  try {
    const data = await coachGet<{ enabled: boolean }>('/api/coach/sales-session/macro-mode');
    const enabled = Boolean(data?.enabled);
    await cacheMacroMode(userId, enabled);
    return { ok: true, enabled };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401 || status === 403 || status === 404) {
      return { ok: false, reason: 'needs-shim', why: authFailureOf(e) };
    }
    return { ok: false, reason: 'failed' };
  }
}

/**
 * Turn it on or off.
 *
 * The caller is expected to move the switch OPTIMISTICALLY and hand back on
 * failure — the web does the same, and for the same reason: a toggle that waits
 * for a round trip before moving feels broken on a phone with one bar. What it
 * must never do is stay moved after a failure, because the rep would then be
 * looking at a product the server does not think they are in.
 */
export async function setMacroMode(userId: string, enabled: boolean): Promise<MacroResult> {
  try {
    const data = await coachPost<{ enabled: boolean }>('/api/coach/sales-session/macro-mode', {
      enabled,
    });
    const saved = Boolean(data?.enabled);
    await cacheMacroMode(userId, saved);
    return { ok: true, enabled: saved };
  } catch (e) {
    const status = (e as { status?: number })?.status;
    if (status === 401 || status === 403 || status === 404) {
      return { ok: false, reason: 'needs-shim', why: authFailureOf(e) };
    }
    return { ok: false, reason: 'failed' };
  }
}
