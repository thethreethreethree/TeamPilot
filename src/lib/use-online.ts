/**
 * Is there a network right now?
 *
 * This app is used at a door, between calls, on whatever signal exists. The
 * design law is explicit that offline must be handled — "cached data, queued
 * actions, or a clear message, never a spinner forever" — and the difference
 * between those three is knowing which state you are in.
 *
 * Subscribed, not polled: expo-network pushes changes, and a rep walking out of
 * range should see the screen change without touching it.
 *
 * `null` means "not known yet", and callers must treat it as ONLINE rather than
 * offline. Blocking a control during the first few milliseconds after mount,
 * before the first reading arrives, would make the app feel broken on a perfectly
 * good connection — the failure is far more likely than genuine offline.
 */
import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export function useOnline(): boolean | null {
  const [online, setOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let mounted = true;

    Network.getNetworkStateAsync()
      .then((s) => {
        if (mounted) setOnline(Boolean(s.isConnected && s.isInternetReachable !== false));
      })
      .catch(() => {
        // If the module cannot answer, assume connected. A false "you are
        // offline" on a working connection is the worse of the two errors: it
        // stops a rep doing something that would have succeeded.
        if (mounted) setOnline(true);
      });

    const sub = Network.addNetworkStateListener((s) => {
      if (mounted) setOnline(Boolean(s.isConnected && s.isInternetReachable !== false));
    });

    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return online;
}

/** Treat "not yet known" as online — see the note above. */
export function isOffline(online: boolean | null): boolean {
  return online === false;
}
