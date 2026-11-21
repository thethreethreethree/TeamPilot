/** F1.5 - account lockout. Policy is D4 and NOT DECIDED: evaluate() throws until it is. */
import { LOCKOUT_POLICY, NotDecidedError, type LockoutPolicy } from './decisions';

export interface Attempt { email: string; succeeded: boolean; at: Date }

export function lockoutState(
  attempts: Attempt[],
  now: Date,
  policy: LockoutPolicy,
): { locked: false } | { locked: true; until: Date } {
  const windowStart = now.getTime() - policy.windowMinutes * 60_000;
  const recent = attempts
    .filter((a) => a.at.getTime() >= windowStart && a.at.getTime() <= now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  // Count failures since the last success inside the window.
  let failures: Attempt[] = [];
  for (const a of recent) failures = a.succeeded ? [] : [...failures, a];
  if (failures.length < policy.maxFailures) return { locked: false };
  const trigger = failures[policy.maxFailures - 1]!;
  const until = new Date(trigger.at.getTime() + policy.lockMinutes * 60_000);
  return until > now ? { locked: true, until } : { locked: false };
}

/** What the sign-in route calls. Throws NotDecidedError until D4 is decided. */
export function evaluate(attempts: Attempt[], now: Date) {
  if (LOCKOUT_POLICY === 'NOT DECIDED') {
    throw new NotDecidedError('D4 lockout policy', 'Sign-in keeps using Supabase limits only.');
  }
  return lockoutState(attempts, now, LOCKOUT_POLICY);
}
