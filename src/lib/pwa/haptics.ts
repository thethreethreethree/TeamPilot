"use client";

/**
 * Haptic feedback wrappers for the PWA.
 *
 * Uses navigator.vibrate() which works on:
 *   - Android Chrome (full support)
 *   - iOS Safari ≥ 16.4 inside an installed PWA (limited — only the
 *     basic single-duration vibrate; patterns are ignored)
 *   - Desktop browsers (no-op silently)
 *
 * The functions here are semantic — `tap`, `send`, `success` — so
 * call sites describe the INTENT, not the duration. Tuning the
 * durations becomes one-file central change instead of grep-and-
 * update across the codebase.
 *
 * All functions are silent no-ops when the API isn't available, so
 * callers can use them unconditionally without environment checks.
 *
 * Philosophy on intensity: subtle by default. Repeated heavy
 * haptics produce hand fatigue and the user starts ignoring them
 * (or installs an OS-level vibration mute). Reserve longer/stronger
 * patterns for confirmation moments where the user genuinely needs
 * to feel the result land.
 */

const canVibrate = (): boolean => {
  return (
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    typeof navigator.vibrate === "function"
  );
};

/**
 * Light tap — UI element press confirmation. ~10ms.
 * Use for: button presses where the user is initiating an action
 * and we want to acknowledge the touch landed.
 */
export function hapticTap(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(10);
  } catch {
    // Some browsers throttle vibrate calls and throw; silent no-op.
  }
}

/**
 * Send confirmation — slightly longer than tap to mark a completed
 * action (vs a press). ~20ms.
 * Use for: send message, accept Coach revision, submit smoke test
 * result.
 */
export function hapticSend(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(20);
  } catch {
    // Silent no-op.
  }
}

/**
 * Success pulse — celebratory confirmation. A short double-tap
 * pattern so the user feels the action LANDED, not just was
 * acknowledged. ~[20, 30, 20] on Android.
 * Use for: PWA install complete, Coach affirmation, smoke test
 * completion, decision dialogue finalized.
 */
export function hapticSuccess(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate([20, 30, 20]);
  } catch {
    // Silent no-op.
  }
}

/**
 * Warning / failure — a slightly heavier single buzz signaling
 * something went wrong. ~50ms.
 * Use for: validation errors, send failures, network errors that
 * blocked an action.
 */
export function hapticWarning(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(50);
  } catch {
    // Silent no-op.
  }
}

/**
 * Threshold cross — the lightest possible feedback. ~5ms.
 * Use for: pull-to-refresh crossing the "will fire" threshold,
 * swipe-to-reply entering the active zone. Should be felt only
 * when the user is paying attention to fine motor feedback.
 */
export function hapticThreshold(): void {
  if (!canVibrate()) return;
  try {
    navigator.vibrate(5);
  } catch {
    // Silent no-op.
  }
}
