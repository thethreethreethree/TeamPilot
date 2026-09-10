/**
 * When the queued writes actually get sent.
 *
 * The same three triggers as the recording sender, for the same reasons — the
 * connection coming back, the app returning to the foreground, and once on
 * mount — and no polling timer, because an interval on a phone that spends the
 * day in a pocket is a battery cost paid every day for a case those three
 * already cover. `runOutbox` holds its own cooldown, so firing all three at once
 * does one sweep rather than three.
 *
 * MOUNTED HIGH IN THE TREE, once. A rep who marks a call in a stairwell and then
 * walks to the next appointment is not on the session screen when the signal
 * returns, and a queue that only drains while you are looking at it is a queue
 * that does not drain.
 *
 * SEPARATE FROM useAutoSend ON PURPOSE, even though the shape is identical. One
 * sends multi-megabyte audio and the other sends hundred-byte instructions;
 * folding them together would mean an outcome waits behind a 25 MB upload on a
 * connection that has just come back, when it is the outcome that every figure
 * on the numbers screen depends on.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useOnline, isOffline } from '@/lib/use-online';
import { runOutbox } from './outbox';

export function useOutbox(userId: string | null): void {
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
    // is recorded against the entry itself — which the session screen shows —
    // rather than surfaced from here, where there is no context to explain it.
    runOutbox(id).catch(() => {
      /* the entry keeps its own error; this is a background sweep */
    });
  };

  // On mount, and every time the connection comes back.
  useEffect(() => {
    if (offline) return;
    sweep();
  }, [offline, userId]);

  // Returning to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') sweep();
    });
    return () => sub.remove();
  }, []);
}
