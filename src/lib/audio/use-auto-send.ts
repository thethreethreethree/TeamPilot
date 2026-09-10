/**
 * When auto-send actually runs.
 *
 * Three triggers, and each one is a real moment rather than a timer:
 *
 *   1. THE CONNECTION COMES BACK. The whole point — a rep drives out of a dead
 *      zone and the phone catches up without being asked.
 *   2. THE APP RETURNS TO THE FOREGROUND. A rep who recorded, locked the phone,
 *      and re-opened it an hour later has had signal the whole time and no event
 *      to act on.
 *   3. ONCE ON MOUNT. Covers a cold launch with signal already present.
 *
 * NO POLLING TIMER. A background interval on a phone that spends the day in a
 * pocket is a battery cost paid every day for a case that these three triggers
 * already cover. `runAutoSend` holds its own cooldown, so firing all three at
 * once does one sweep, not three.
 *
 * This hook renders nothing and returns nothing. It is mounted once, high in the
 * tree, because sending should not stop just because the rep navigated away from
 * the recordings screen — that would put us back to depending on them being on
 * the right screen at the right moment.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useOnline, isOffline } from '@/lib/use-online';
import { runAutoSend } from './auto-send';

export function useAutoSend(userId: string | null): void {
  const online = useOnline();
  const offline = isOffline(online);
  // Read inside callbacks that outlive the render they were created in — the
  // foreground listener below is registered once and would otherwise close over
  // whoever was signed in at mount.
  //
  // Kept up to date in an effect rather than during render. Writing to a ref
  // while rendering is an impure render, and React may render a component twice.
  // This effect is declared FIRST, so it has already run by the time either
  // sweep below can fire.
  const userRef = useRef(userId);
  useEffect(() => {
    userRef.current = userId;
  }, [userId]);

  const sweep = () => {
    const id = userRef.current;
    if (!id) return;
    // Deliberately not awaited: nothing on screen waits for this, and a failure
    // is recorded against the recording itself rather than surfaced here.
    runAutoSend(id).catch(() => {
      /* the recording keeps its own error; this is a background sweep */
    });
  };

  // 1 + 3: on mount, and every time the connection comes back.
  useEffect(() => {
    if (offline) return;
    sweep();
  }, [offline, userId]);

  // 2: returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') sweep();
    });
    return () => sub.remove();
  }, []);
}
