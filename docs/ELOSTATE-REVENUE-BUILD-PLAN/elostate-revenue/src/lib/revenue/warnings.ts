/**
 * Deal warnings (Gong F20.5, teardown M20). Gong has 8 kinds; "red flag email" is left out because EloState captures
 * no email (decision R7). Pure: the nightly job feeds it a deal's facts and stores what it returns as raise/clear
 * events (§3.1). Every threshold is a company setting; the defaults are Gong's published ones [OBSERVED teardown F20.5]
 * except where marked [ASSUMED].
 */
export type WarningKind = "no_activity" | "ghosted" | "overdue" | "few_contacts" | "no_power" | "pricing_not_mentioned" | "stalled";

export type WarningSettings = {
  noActivityDays: number; // Gong: 7 / 14 / 7 by board type
  ghostedDays: number; // Gong: 4 / 7 / 4
  minContacts: number; // Gong: 1–5
  fewContactsAfterDays: number;
  noPowerWithinDaysOfClose: number;
  pricingWithinDaysOfClose: number;
  /** Days allowed in each stage (by stage id); a stage with no entry never stalls. */
  stalledDays: Record<string, number>;
};

export const DEFAULT_SETTINGS: WarningSettings = {
  noActivityDays: 14,
  ghostedDays: 7,
  minContacts: 2, // [ASSUMED] Gong lets it be 1–5
  fewContactsAfterDays: 14, // [ASSUMED]
  noPowerWithinDaysOfClose: 30, // [ASSUMED]
  pricingWithinDaysOfClose: 30, // [ASSUMED]
  stalledDays: {},
};

export type Rank = "c_level" | "vp" | "director" | "manager" | "individual" | "unknown";
export const POWER: Rank[] = ["c_level", "vp", "director"];

export type DealFacts = {
  status: "open" | "won" | "lost";
  createdOn: string; // YYYY-MM-DD
  closeDate: string | null;
  stageId: string | null;
  stageEnteredOn: string | null;
  /** Calls linked to the deal: the day, and whether the customer side spoke (two-way). */
  calls: Array<{ on: string; customerSpoke: boolean }>;
  contacts: Array<{ rank: Rank; lastActiveOn: string | null }>;
  pricingMentioned: boolean;
};

export type Warning = { kind: WarningKind; reason: string; mitigation: string };

const DAY = 86_400_000;
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY);
}

/** Only open deals warn; a won or lost deal has nothing left to rescue. */
export function evaluateWarnings(d: DealFacts, today: string, s: WarningSettings = DEFAULT_SETTINGS): Warning[] {
  if (d.status !== "open") return [];
  const out: Warning[] = [];
  const last = d.calls.map((c) => c.on).sort().at(-1) ?? null;
  const since = daysBetween(last ?? d.createdOn, today);
  if (since >= s.noActivityDays) {
    out.push({ kind: "no_activity", reason: last ? `No call in ${since} days.` : `No call since it was opened ${since} days ago.`, mitigation: "Book the next call." });
  }
  const lastTwoWay = d.calls.filter((c) => c.customerSpoke).map((c) => c.on).sort().at(-1) ?? null;
  if (d.calls.length > 0) {
    const quiet = daysBetween(lastTwoWay ?? d.createdOn, today);
    if (quiet >= s.ghostedDays) out.push({ kind: "ghosted", reason: `The customer hasn't spoken on a call in ${quiet} days.`, mitigation: "Reach out with a reason to talk." });
  }
  if (d.closeDate && daysBetween(d.closeDate, today) > 0) {
    out.push({ kind: "overdue", reason: `The close date (${d.closeDate}) has passed.`, mitigation: "Move the close date or close the deal." });
  }
  if (daysBetween(d.createdOn, today) >= s.fewContactsAfterDays && d.contacts.length < s.minContacts) {
    out.push({ kind: "few_contacts", reason: `${d.contacts.length} contact${d.contacts.length === 1 ? "" : "s"} on the deal.`, mitigation: "Bring in more people from the account." });
  }
  if (d.closeDate) {
    const toClose = daysBetween(today, d.closeDate);
    if (toClose >= 0 && toClose <= s.noPowerWithinDaysOfClose) {
      if (noPower(d.contacts, today, s.noPowerWithinDaysOfClose)) {
        out.push({ kind: "no_power", reason: "No director, VP or C-level contact has been active recently.", mitigation: "Get a decision-maker on the next call." });
      }
      if (toClose <= s.pricingWithinDaysOfClose && !d.pricingMentioned) {
        out.push({ kind: "pricing_not_mentioned", reason: `Close is in ${toClose} days and price hasn't come up.`, mitigation: "Talk price on the next call." });
      }
    }
  }
  const stageLimit = d.stageId ? s.stalledDays[d.stageId] : undefined;
  if (d.stageEnteredOn && stageLimit !== undefined) {
    const inStage = daysBetween(d.stageEnteredOn, today);
    if (inStage > stageLimit) out.push({ kind: "stalled", reason: `${inStage} days in this stage.`, mitigation: "Agree the step that moves it forward." });
  }
  return out;
}

/**
 * Gong: fires when no Director/VP/C-level is active, and at least 75% of the contacts with a known title rank below.
 * A deal whose contacts have no known titles doesn't fire: there's nothing to judge it on.
 */
export function noPower(contacts: DealFacts["contacts"], today: string, withinDays: number): boolean {
  const activePower = contacts.some((c) => POWER.includes(c.rank) && c.lastActiveOn && daysBetween(c.lastActiveOn, today) <= withinDays);
  if (activePower) return false;
  const known = contacts.filter((c) => c.rank !== "unknown");
  if (known.length === 0) return false;
  const below = known.filter((c) => !POWER.includes(c.rank)).length;
  return below / known.length >= 0.75;
}

/** A job title → rank. Words only; anything unrecognised is "unknown", never guessed. */
export function rankOf(title: string | null | undefined): Rank {
  const t = (title ?? "").toLowerCase();
  if (!t.trim()) return "unknown";
  if (/\b(ceo|cfo|coo|cto|cro|cmo|cio|chief|founder|owner|president)\b/.test(t)) return "c_level";
  if (/\b(vp|vice president|svp|evp)\b/.test(t)) return "vp";
  if (/\b(director|head of)\b/.test(t)) return "director";
  if (/\b(manager|lead|supervisor)\b/.test(t)) return "manager";
  if (/\b(rep|representative|associate|specialist|analyst|coordinator|assistant|engineer|agent)\b/.test(t)) return "individual";
  return "unknown";
}
