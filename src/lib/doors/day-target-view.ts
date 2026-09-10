/**
 * Today's door target, read from the server that froze it - the PURE half.
 *
 * SPLIT FROM `day-target-api.ts` for the reason `upload-flow.ts` records: this
 * project's test runner strips types rather than compiling them, so a module
 * that reaches react-native through the HTTP client cannot be loaded by a test
 * at all. The reading rule is the part worth testing, so it lives where a test
 * can reach it. Imports here must stay pure.
 *
 * WHY THE APP DOES NOT COMPUTE THIS. `day-target.ts` holds the same arithmetic,
 * ported, and it is used for TESTS and for nothing else at runtime. The target is
 * FROZEN per rep per local day on the server the moment it is first read — so a
 * rep whose ratios shift at lunchtime does not watch their morning target move.
 * Recomputing it on the phone would produce a second answer, and the one a rep
 * trusts is whichever they happened to look at last.
 *
 * The shape below is not the spec's; it is what production actually returned on
 * 10 September, read with the app's own Bearer token:
 *
 *   {"localDate":"2026-09-10","repName":"Moses Maniquiz",
 *    "target":{"doorsTarget":0,"presentationsTarget":0,"soldTarget":0,
 *              "usedStarter":true,"salesGoal":null,"closeRatio":null,
 *              "contactRatio":null,"saleValueCents":null,"qualified":false,
 *              "frozen":false},
 *    "today":{"doors":0,"presentations":0,"sold":0}}
 *
 * `qualified` and `frozen` are real fields the spec does not mention. They are
 * read here rather than ignored, because a field nobody reads is a field that
 * drifts.
 */
import type { AuthFailure } from '@/lib/auth-failure';

export type DayTargetView = {
  /** The rep's local day, as the server reckoned it from the tz we sent. */
  localDate: string;
  repName: string | null;
  doorsTarget: number;
  presentationsTarget: number;
  soldTarget: number;
  usedStarter: boolean;
  /** Null when no manager has set a goal. This is the no-goal state. */
  salesGoal: number | null;
  closeRatio: number | null;
  contactRatio: number | null;
  /** Manager-set value per sale, in CENTS. Null means show sales, not money. */
  saleValueCents: number | null;
  qualified: boolean;
  frozen: boolean;
  today: { doors: number; presentations: number; sold: number };
};

export type DayTargetResult =
  | { ok: true; view: DayTargetView }
  /**
   * The migration behind this screen has not rolled out on this environment.
   * Its own outcome because it is not an error the rep can act on and not a
   * refusal of their account — the screen says "not available yet" and stops.
   */
  | { ok: false; reason: 'unavailable' }
  | { ok: false; reason: 'needs-shim'; why: AuthFailure | null }
  | { ok: false; reason: 'failed'; message?: string };

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** A number, or NULL when it is genuinely absent — never a substituted zero. */
const nullableNum = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

export function readDayTarget(payload: unknown): DayTargetView | null {
  const o = (payload ?? null) as Record<string, unknown> | null;
  if (!o || typeof o !== 'object') return null;
  const t = (o.target ?? null) as Record<string, unknown> | null;
  const today = (o.today ?? null) as Record<string, unknown> | null;
  if (!t) return null;

  return {
    localDate: typeof o.localDate === 'string' ? o.localDate : '',
    repName: typeof o.repName === 'string' && o.repName.trim() ? o.repName.trim() : null,
    doorsTarget: num(t.doorsTarget),
    presentationsTarget: num(t.presentationsTarget),
    soldTarget: num(t.soldTarget),
    usedStarter: t.usedStarter !== false,
    // NULL, not 0. A zero goal reads as "your goal is nothing"; null is "nobody
    // has set one", and only one of those asks the rep to go and find a manager.
    salesGoal: nullableNum(t.salesGoal),
    closeRatio: nullableNum(t.closeRatio),
    contactRatio: nullableNum(t.contactRatio),
    saleValueCents: nullableNum(t.saleValueCents),
    qualified: t.qualified === true,
    frozen: t.frozen === true,
    today: {
      doors: num(today?.doors),
      presentations: num(today?.presentations),
      sold: num(today?.sold),
    },
  };
}


/** The device's IANA zone, or a safe fallback the server will still accept. */
export function deviceTimeZone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : 'UTC';
  } catch {
    return 'UTC';
  }
}
