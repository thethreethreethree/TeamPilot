/**
 * Reduce Motion, read live.
 *
 * MOVED OUT OF `(app)/_layout.tsx` when a second stack needed it. The design law
 * requires every animation in this app to respect Reduce Motion, and there are
 * now two navigators — the one behind the auth gate and the one in front of it,
 * added so a rep who cannot sign in can still report that they cannot sign in.
 * Copying the hook into the second layout would have left two subscriptions that
 * agree today and drift the first time one is touched.
 *
 * There is no global stylesheet on device, so the OS flag is read in code. It is
 * also SUBSCRIBED to, not just read once: a value cached at launch goes stale the
 * moment the user toggles the setting while the app is backgrounded.
 *
 * "Reduce" does not mean "delete all animation" — it means remove, reduce or
 * replace. For a screen transition the honest replacement is no slide, because a
 * push animation carries no meaning of its own.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
