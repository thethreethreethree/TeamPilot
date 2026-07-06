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

export function playNewMessageChime(): void {
  try {
    if (typeof window === "undefined") return;
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    void ctx.resume?.().catch(() => {});

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
    // Close the context once the chime has finished so we don't leak contexts.
    window.setTimeout(() => {
      try {
        void ctx.close?.();
      } catch {
        /* noop */
      }
    }, 600);
  } catch {
    /* audio is best-effort — never let a chime failure disrupt the agent */
  }
}
