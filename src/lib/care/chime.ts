/**
 * A short, pleasant two-note "new customer message" chime for the C.A.R.E agent
 * surface (deferred backlog item — opt-in, per-agent). Pure Web Audio so there
 * is no asset to ship and no network. SSR-safe (no-op off the browser) and
 * best-effort under the autoplay policy — the agent is already interacting with
 * the page, so the context resumes; if the browser blocks it, we silently skip
 * rather than throw. Distinct from the live-coach toggle beep (a gentle rising
 * major third, not a UI blip).
 */
/**
 * Should the chime fire? True iff `next` contains a CUSTOMER-authored message
 * whose id was not already in `prev`. Pure + tested so the "only a genuinely new
 * customer message" rule can't silently regress into chiming on the agent's own
 * sends, on non-customer (ai/system) messages, or on list re-order/churn. The
 * caller supplies the two message lists from consecutive polls.
 */
export function hasNewCustomerMessage(
  prev: ReadonlyArray<{ id: string; authorType: string }>,
  next: ReadonlyArray<{ id: string; authorType: string }>
): boolean {
  const prevIds = new Set(prev.map((m) => m.id));
  return next.some((m) => m.authorType === "customer" && !prevIds.has(m.id));
}

// A SINGLE shared AudioContext, reused for every chime. This is the crux of the
// autoplay policy: the chime fires in the 5s poll (NOT a user gesture), so a
// context created there starts suspended and stays silent — especially on Safari,
// which only unlocks audio inside the gesture call-stack. By creating + resuming
// this one context on the TOGGLE gesture (the preview play) and reusing it, the
// later poll-fired chimes ride the already-unlocked context. Never closed.
let sharedCtx: AudioContext | null = null;

function getSharedContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  if (!sharedCtx) {
    try {
      sharedCtx = new AC();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

export function playNewMessageChime(): void {
  try {
    const ctx = getSharedContext();
    if (!ctx) return;
    // resume() is idempotent + best-effort. On the toggle gesture it unlocks the
    // context (running inside the gesture); on a poll tick it's a no-op if the
    // context is already running, or a blocked promise we safely ignore.
    void ctx.resume?.().catch(() => {});
    // Note: we do NOT bail on state === "suspended". The context is always first
    // created during the toggle GESTURE (soundOn starts off, so enabling it is
    // the first play), so resume() will unlock it; scheduling the notes now means
    // they play the moment it resumes (immediately on Chrome, a beat later on
    // Safari) — including the enable-preview. currentTime doesn't advance while
    // suspended, so nothing is lost.

    // Two soft sine notes (E5 → G#5), each a short bell-like envelope.
    const notes: Array<{ freq: number; at: number }> = [
      { freq: 659.25, at: 0 },
      { freq: 830.61, at: 0.12 },
    ];
    const t0 = ctx.currentTime;
    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = t0 + n.at;
      osc.frequency.setValueAtTime(n.freq, start);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.start(start);
      osc.stop(start + 0.24);
    }
    // NOTE: intentionally do NOT close the context — it is shared + reused so the
    // autoplay unlock from the toggle gesture persists to later poll chimes.
  } catch {
    /* audio is best-effort — never let a chime failure disrupt the agent */
  }
}
