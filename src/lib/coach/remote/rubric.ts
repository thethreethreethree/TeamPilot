/**
 * F15.9 + D6 - which rubric scores a remote session.
 * [OBSERVED] one AT&T Fiber door rubric in code (rubric.ts:30) scores every sales call today;
 * rubric_config exists but nothing reads it (0268 seeds it). 0274 adds rubric_config.channel.
 * Until a phone/video rubric exists, remote sessions keep today's rubric AND carry a caveat
 * the UI must print on the score panel: the placeholder announces itself.
 */
export type Channel = 'door' | 'phone' | 'video';
export interface RubricRow { version: string; channel: Channel | 'any'; active: boolean }

/**
 * TODAY'S REALITY, as rows. The scorer grades every pitch with the rubric in code (pitchScore/rubric.ts, the
 * AT&T Fiber door rubric) and does not read rubric_config yet, so the honest input to rubricFor is "one active
 * door rubric". A phone or video score therefore carries the D6 caveat until the scorer reads per-channel
 * rubrics (RSS Phase 3 step 1, open).
 */
// D6 approved 2026-11-22: phone and video have their own rubric (attfiber-remote-v1, rubricRegistry.ts).
export const CODE_RUBRIC_ROWS: RubricRow[] = [
  { version: 'code', channel: 'door', active: true },
  { version: 'attfiber-remote-v1', channel: 'phone', active: true },
  { version: 'attfiber-remote-v1', channel: 'video', active: true },
];

export function rubricFor(channel: Channel, rows: RubricRow[]): { version: string; caveat: string | null } {
  const active = rows.filter((r) => r.active);
  const exact = active.find((r) => r.channel === channel);
  if (exact) return { version: exact.version, caveat: null };
  const fallback = active.find((r) => r.channel === 'any') ?? active.find((r) => r.channel === 'door');
  if (!fallback) throw new Error('No active rubric for this company');
  return {
    version: fallback.version,
    caveat: channel === 'door' ? null : `Scored with the ${fallback.channel === 'any' ? 'company' : 'door'} rubric: no ${channel} rubric yet (decision D6).`,
  };
}

/** F15.5 - N/A per element: excluded elements' points are spread over the rest of the section,
 *  the same way objection handling is rescaled today (scorePitch.ts:169). */
export function rescaleSection(elements: { points: number; na: boolean; earned: number }[]): number {
  const sectionTotal = elements.reduce((a, e) => a + e.points, 0);
  const applicable = elements.filter((e) => !e.na);
  const applicableTotal = applicable.reduce((a, e) => a + e.points, 0);
  if (applicableTotal === 0) return 0;
  const earned = applicable.reduce((a, e) => a + e.earned, 0);
  return (earned / applicableTotal) * sectionTotal;
}
