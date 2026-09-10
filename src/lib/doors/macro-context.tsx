/**
 * One answer to "is this rep in Macro Mode?", shared by the tab bar and Home.
 *
 * WHY A PROVIDER RATHER THAN A HOOK PER SCREEN. Macro Mode changes the TAB BAR
 * and the HOME SCREEN together. If each read it independently they would resolve
 * at different moments, and a rep would see door-to-door tabs under a standard
 * home, or the reverse — a product that looks half-switched is worse than either
 * of the two products. One source, one moment of change.
 *
 * THE ORDER MATTERS AND IS DELIBERATE:
 *   1. the cached answer, immediately, so the app opens into the right product;
 *   2. the server's answer, which corrects it.
 *
 * The web solves the same problem by holding a skeleton while the fetch is in
 * flight, with a comment recording that folding "unknown" into "off" flashed the
 * wrong product on every load for a macro rep. A tab bar cannot hold a skeleton,
 * so this remembers instead — which gets a returning rep the right product on
 * the first frame, and a brand-new one a single correction.
 *
 * A FAILED FETCH NEVER FLIPS THE PRODUCT. If the server cannot be reached the
 * cached answer stands. Switching a rep out of the door-to-door layout because
 * they walked into a basement would be the app taking their tools away at
 * exactly the wrong moment.
 */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth-context';
import { fetchMacroMode, readCachedMacroMode, setMacroMode } from './macro-mode';
import { cacheMacroMode } from './macro-mode-store';

type MacroValue = {
  /** null while genuinely unknown — never silently false. */
  enabled: boolean | null;
  /** True when a write is in flight, so the switch can show it. */
  saving: boolean;
  /** Set when the server will not accept this app's writes yet. */
  blocked: boolean;
  /** True when the phone is honouring a setting the server has not confirmed. */
  unsynced: boolean;
  toggle: () => Promise<void>;
};

const MacroContext = createContext<MacroValue>({
  enabled: null,
  saving: false,
  blocked: false,
  unsynced: false,
  toggle: async () => {},
});

export function MacroProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  /**
   * The mode, TIED TO THE REP IT BELONGS TO.
   *
   * Held as a pair rather than a bare boolean so the value can be derived rather
   * than reset. Resetting it in an effect on sign-out left a window — one render
   * — where the previous rep's product was still on screen for whoever signed in
   * next. On a shared phone that is a rep seeing someone else's layout, and it
   * is the kind of thing nobody reports because it corrects itself a frame
   * later.
   *
   * Deriving it closes the window completely: a value that does not belong to
   * the current user simply is not their value.
   */
  const [held, setHeld] = useState<{ userId: string | null; enabled: boolean | null }>({
    userId: null,
    enabled: null,
  });
  const enabled = held.userId === userId ? held.enabled : null;
  const setEnabled = useCallback(
    (next: boolean | null) => setHeld({ userId, enabled: next }),
    [userId],
  );
  const [saving, setSaving] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [unsynced, setUnsynced] = useState(false);

  useEffect(() => {
    // No reset needed when there is no user: `enabled` is derived and is
    // already null for anyone the held value does not belong to.
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const cached = await readCachedMacroMode(userId);
      if (!cancelled && cached !== null) setEnabled(cached);

      const result = await fetchMacroMode(userId);
      if (cancelled) return;
      if (result.ok) {
        // The server's answer is the truth and replaces anything local.
        setEnabled(result.enabled);
        setBlocked(false);
        setUnsynced(false);
        return;
      }
      if (result.reason === 'needs-shim') setBlocked(true);
      // Whatever the cache said stands. A rep is not moved out of their working
      // layout because a request failed.
      if (cached === null) setEnabled(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, setEnabled]);

  const toggle = useCallback(async () => {
    if (!userId || enabled === null || saving) return;
    const next = !enabled;
    // Optimistic, like the web: a switch that waits for a round trip before it
    // moves feels broken on one bar of signal.
    setEnabled(next);
    // Written to the phone IMMEDIATELY, before the network is tried. Macro Mode
    // decides which product this rep opens, and that is a choice about their own
    // screen — it should not require a server to take effect.
    await cacheMacroMode(userId, next);
    setSaving(true);
    const result = await setMacroMode(userId, next);
    setSaving(false);

    if (result.ok) {
      setEnabled(result.enabled);
      await cacheMacroMode(userId, result.enabled);
      setBlocked(false);
      setUnsynced(false);
      return;
    }

    /**
     * THE SWITCH STAYS WHERE THE REP PUT IT.
     *
     * An earlier version handed it back on any failure, reasoning that leaving
     * it moved would put the rep in a product the server disagrees with. That was
     * wrong twice over. It made the control UNUSABLE while the backend shim is
     * undeployed — a rep could see Macro Mode and never turn it on — and it broke
     * the rule the rest of this app follows: an outcome typed in a stairwell, a
     * door knocked in a basement and a renamed call all stay put and sync later.
     * A preference about your own screen has a weaker claim to a server than any
     * of those, not a stronger one.
     *
     * So the phone honours it now and says it has not synced. The server's answer
     * still wins whenever it arrives — see the load effect above.
     */
    setUnsynced(true);
    if (result.reason === 'needs-shim') setBlocked(true);
  }, [userId, enabled, saving, setEnabled]);

  return (
    <MacroContext.Provider value={{ enabled, saving, blocked, unsynced, toggle }}>
      {children}
    </MacroContext.Provider>
  );
}

export function useMacroMode(): MacroValue {
  return useContext(MacroContext);
}
