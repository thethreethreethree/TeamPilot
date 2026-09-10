/**
 * When knocks actually reach the server.
 *
 * The same three triggers the recording sender and the write queue use — the
 * connection returning, the app coming back to the foreground, and once on
 * mount — plus one this queue needs that they do not: **a sweep right after a
 * tap**. A rep with signal expects their door to be on the record within
 * seconds, and waiting for a network event that has already happened would hold
 * a whole street's worth of knocks on the phone for no reason.
 *
 * THE COOLDOWN IS SHORT AND THE SWEEP IS SMALL. A knock is forty bytes. Sending
 * a handful of them the moment they exist costs almost nothing, and the cost of
 * NOT sending is a rep whose phone dies with a day of doors on it.
 *
 * IT STOPS ON THE ONE FAILURE RETRYING CANNOT FIX. A 401 means the app's writes
 * are not accepted yet; hammering the route would not deploy anything. The
 * knocks stay, and the screen says so.
 */
import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useOnline, isOffline } from '@/lib/use-online';
import {
  runKnockSend,
  knockSendingStopped,
  resetKnockSending,
  MAX_KNOCK_ATTEMPTS,
  type KnockSender,
} from './knock-sweep';

// Re-exported so screens keep one import. The DECISIONS live in knock-sweep.ts
// because this file imports React Native and cannot load in a test.
export { runKnockSend, knockSendingStopped, resetKnockSending, MAX_KNOCK_ATTEMPTS };
export type { KnockSender };

/**
 * Mounted by the door log screen. Returns a `flush` the screen calls straight
 * after a tap, so a knock made with signal is on the record almost at once.
 */
export function useKnockSender(userId: string | null): { flush: () => void } {
  const online = useOnline();
  const offline = isOffline(online);
  const userRef = useRef(userId);
  useEffect(() => {
    userRef.current = userId;
  }, [userId]);

  const sweep = useCallback((force = false) => {
    const id = userRef.current;
    if (!id) return;
    runKnockSend(id, { force }).catch(() => {
      /* each knock keeps its own error; this is a background sweep */
    });
  }, []);

  useEffect(() => {
    if (offline) return;
    sweep();
  }, [offline, userId, sweep]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') sweep();
    });
    return () => sub.remove();
  }, [sweep]);

  return { flush: () => sweep(true) };
}
