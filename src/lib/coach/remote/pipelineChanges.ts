/**
 * What changed in the pipeline in a period (2026-11-23; ledger F23.7 "…trends, changes… widgets", LACK).
 *
 * Every prospect fact is an append-only event (0303), so a week's changes are read straight from the record: replay each
 * prospect's events in order and keep the ones inside the period that changed something — a new deal, a stage move, a
 * win, a loss, an amount change, an expected close date pushed out or pulled in. The events written when a prospect is
 * created (within CREATE_WINDOW_MS of its first event) are its creation, not changes. Pure, so every rule is tested.
 */
export const CREATE_WINDOW_MS = 5_000;

export type ProspectEvent = { prospectId: string; kind: string; value: Record<string, unknown> | null; at: string; id: number };
export type Change =
  | { kind: "new"; prospectId: string; at: string; amount: number | null }
  | { kind: "won" | "lost"; prospectId: string; at: string; amount: number | null }
  | { kind: "stage"; prospectId: string; at: string; from: string | null; to: string | null }
  | { kind: "amount"; prospectId: string; at: string; from: number | null; to: number | null }
  | { kind: "close_slipped" | "close_pulled_in"; prospectId: string; at: string; from: string; to: string };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export function pipelineChanges(events: ProspectEvent[], from: string, to: string): Change[] {
  const inPeriod = (at: string) => at >= from && at < to;
  const byProspect = new Map<string, ProspectEvent[]>();
  for (const e of events) byProspect.set(e.prospectId, [...(byProspect.get(e.prospectId) ?? []), e]);
  const out: Change[] = [];
  for (const [prospectId, list] of byProspect) {
    list.sort((a, b) => a.id - b.id);
    const createdAt = Date.parse(list[0]!.at);
    let status: string | null = null;
    let label: string | null = null;
    let amount: number | null = null;
    let close: string | null = null;
    for (const e of list) {
      const creating = Date.parse(e.at) - createdAt <= CREATE_WINDOW_MS;
      const v = e.value ?? {};
      if (e.kind === "stage") {
        const nextStatus = str(v.status) ?? "open";
        const nextLabel = str(v.label);
        if (!creating && inPeriod(e.at)) {
          if (nextStatus !== status && (nextStatus === "won" || nextStatus === "lost")) out.push({ kind: nextStatus, prospectId, at: e.at, amount });
          else if (nextStatus === "open" && nextLabel !== label) out.push({ kind: "stage", prospectId, at: e.at, from: label, to: nextLabel });
        }
        status = nextStatus;
        label = nextLabel;
      } else if (e.kind === "amount") {
        const next = num(v.amount);
        if (!creating && inPeriod(e.at) && next !== amount) out.push({ kind: "amount", prospectId, at: e.at, from: amount, to: next });
        amount = next;
      } else if (e.kind === "close_date") {
        const next = str(v.date);
        if (!creating && inPeriod(e.at) && close && next && next !== close) out.push({ kind: next > close ? "close_slipped" : "close_pulled_in", prospectId, at: e.at, from: close, to: next });
        close = next;
      }
    }
    if (inPeriod(list[0]!.at)) out.push({ kind: "new", prospectId, at: list[0]!.at, amount });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}

/** Counts and value per kind, for the card's headline. */
export function summarize(changes: Change[]) {
  const s = { new: 0, newValue: 0, won: 0, wonValue: 0, lost: 0, lostValue: 0, moved: 0, slipped: 0 };
  for (const c of changes) {
    if (c.kind === "new") {
      s.new++;
      s.newValue += c.amount ?? 0;
    }
    if (c.kind === "won") {
      s.won++;
      s.wonValue += c.amount ?? 0;
    }
    if (c.kind === "lost") {
      s.lost++;
      s.lostValue += c.amount ?? 0;
    }
    if (c.kind === "stage") s.moved++;
    if (c.kind === "close_slipped") s.slipped++;
  }
  return s;
}

/**
 * Open pipeline value at each instant in `ends` (2026-11-23; F23.7 trend): replay every prospect's events up to that
 * instant; a prospect counts if it existed, was open, and its value is its latest amount (none = 0, counted apart as
 * unpriced). Erased or later-closed deals count for the weeks they were open — this is the history, not today's view.
 */
export function openValueAt(events: ProspectEvent[], ends: string[]): Array<{ at: string; open: number; value: number; unpriced: number }> {
  const byProspect = new Map<string, ProspectEvent[]>();
  for (const e of events) byProspect.set(e.prospectId, [...(byProspect.get(e.prospectId) ?? []), e]);
  for (const list of byProspect.values()) list.sort((a, b) => a.id - b.id);
  return ends.map((end) => {
    let open = 0;
    let value = 0;
    let unpriced = 0;
    for (const list of byProspect.values()) {
      let exists = false;
      let status = "open";
      let amount: number | null = null;
      for (const e of list) {
        if (e.at >= end) break;
        exists = true;
        const v = e.value ?? {};
        if (e.kind === "stage") status = str(v.status) ?? "open";
        if (e.kind === "amount") amount = num(v.amount);
      }
      if (!exists || status !== "open") continue;
      open++;
      if (amount === null) unpriced++;
      else value += amount;
    }
    return { at: end, open, value, unpriced };
  });
}

/** Open deals per stage name (the funnel), most first; no stage name counted as "No stage". */
export function stageFunnel(prospects: Array<{ status: string; stageLabel: string | null; amount: number | null }>): Array<{ stage: string; count: number; value: number }> {
  const by = new Map<string, { stage: string; count: number; value: number }>();
  for (const p of prospects) {
    if (p.status !== "open") continue;
    const label = p.stageLabel?.trim() || "No stage";
    const k = label.toLowerCase().replace(/\s+/g, " ");
    const e = by.get(k) ?? { stage: label, count: 0, value: 0 };
    e.count++;
    e.value += p.amount ?? 0;
    by.set(k, e);
  }
  return [...by.values()].sort((a, b) => b.count - a.count || a.stage.localeCompare(b.stage));
}
