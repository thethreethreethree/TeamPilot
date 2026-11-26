import { dealRisk, type RiskLevel } from "../dealRisk";

/**
 * The deal board (revenue Phase 2; Gong F20.1: filters segment, tabs group with roll-ups, columns show fields, activity,
 * warnings). Pure, so every filter is tested. Risk is dealRisk's verdict, consumed, never re-derived (§2.2).
 */
export type StageKind = "open" | "won" | "lost";
export type Stage = { name: string; kind: StageKind };

export type BoardDeal = {
  id: string;
  repId: string;
  name: string | null;
  status: StageKind;
  stageLabel: string | null;
  amount: number | null;
  closeDate?: string | null;
  nextCallDate: string | null;
  lastCallAt: string | null;
  createdAt: string;
  nextTodo: { id?: string; title?: string; due: string | null } | null;
  accountId?: string | null;
  accountName?: string | null;
  contacts?: number;
  sentiment?: { last: "warming" | "cooling" | "flat" } | null;
};

export type ClosePeriod = "overdue" | "this_month" | "next_month" | "this_quarter" | "next_quarter" | "none";
export type BoardFilters = {
  status?: StageKind;
  stage?: string; // a stage name, or "(none)" for deals with no stage
  close?: ClosePeriod;
  accountId?: string;
  risk?: RiskLevel | "flagged"; // "flagged" = at_risk or watch
  q?: string;
};

/** The months a period covers, as YYYY-MM, from `today` (YYYY-MM-DD). */
function monthsOf(period: ClosePeriod, today: string): string[] {
  const y = Number(today.slice(0, 4));
  const m = Number(today.slice(5, 7));
  const ym = (yy: number, mm: number) => {
    const d = new Date(Date.UTC(yy, mm - 1, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };
  if (period === "this_month") return [ym(y, m)];
  if (period === "next_month") return [ym(y, m + 1)];
  const qStart = Math.floor((m - 1) / 3) * 3 + 1;
  if (period === "this_quarter") return [0, 1, 2].map((k) => ym(y, qStart + k));
  if (period === "next_quarter") return [3, 4, 5].map((k) => ym(y, qStart + k));
  return [];
}

export function closeMatches(closeDate: string | null | undefined, period: ClosePeriod, today: string): boolean {
  if (period === "none") return !closeDate;
  if (!closeDate) return false;
  if (period === "overdue") return closeDate < today;
  return monthsOf(period, today).includes(closeDate.slice(0, 7));
}

export function filterDeals<T extends BoardDeal>(deals: T[], f: BoardFilters, today: string): T[] {
  const q = f.q?.trim().toLowerCase() ?? "";
  return deals.filter((d) => {
    if (f.status && d.status !== f.status) return false;
    if (f.stage) {
      const label = d.stageLabel?.trim() ?? "";
      if (f.stage === "(none)" ? label !== "" : label.toLowerCase() !== f.stage.trim().toLowerCase()) return false;
    }
    if (f.close && !closeMatches(d.closeDate, f.close, today)) return false;
    if (f.accountId && d.accountId !== f.accountId) return false;
    if (f.risk) {
      const level = dealRisk(d, today).level;
      if (f.risk === "flagged" ? level === "ok" : level !== f.risk) return false;
    }
    if (q && ![d.name, d.accountName, d.stageLabel].some((x) => x?.toLowerCase().includes(q))) return false;
    return true;
  });
}

/** Roll-up of a set of deals: how many, the amount of those with one, and how many have none (never counted as 0). */
export function rollUp(deals: BoardDeal[]): { count: number; amount: number; unpriced: number } {
  return {
    count: deals.length,
    amount: deals.reduce((s, d) => s + (d.amount ?? 0), 0),
    unpriced: deals.filter((d) => d.amount === null).length,
  };
}

/**
 * Group open deals by stage, in the company's order. Labels not on the list keep their own group after the list
 * (shown as they are, never renamed); deals with no stage come last.
 */
export function byStage(deals: BoardDeal[], stages: Stage[] | null): Array<{ name: string; listed: boolean; deals: BoardDeal[] }> {
  const groups = new Map<string, { name: string; listed: boolean; deals: BoardDeal[] }>();
  for (const s of stages ?? []) if (s.kind === "open") groups.set(s.name.trim().toLowerCase(), { name: s.name, listed: true, deals: [] });
  const none = { name: "No stage", listed: false, deals: [] as BoardDeal[] };
  for (const d of deals) {
    if (d.status !== "open") continue;
    const label = d.stageLabel?.trim();
    if (!label) {
      none.deals.push(d);
      continue;
    }
    const k = label.toLowerCase();
    const g = groups.get(k) ?? { name: label, listed: false, deals: [] };
    g.deals.push(d);
    groups.set(k, g);
  }
  const out = [...groups.values()].filter((g) => g.listed || g.deals.length > 0);
  if (none.deals.length) out.push(none);
  return out;
}

/** The kind (open/won/lost) a stage name carries on the company list; null when the name isn't on it. */
export function kindOf(stages: Stage[] | null, name: string): StageKind | null {
  const s = (stages ?? []).find((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase());
  return s ? s.kind : null;
}
