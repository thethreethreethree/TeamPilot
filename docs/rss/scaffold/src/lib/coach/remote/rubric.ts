/**
 * F15.9 + D6 - which rubric scores a remote session.
 * [OBSERVED] one AT&T Fiber door rubric in code (rubric.ts:30) scores every sales call today;
 * rubric_config exists but nothing reads it (0268 seeds it). 0274 adds rubric_config.channel.
 * Until a phone/video rubric exists, remote sessions keep today's rubric AND carry a caveat
 * the UI must print on the score panel: the placeholder announces itself.
 */
export type Channel = 'door' | 'phone' | 'video';
export interface RubricRow { version: string; channel: Channel | 'any'; active: boolean }

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
