/**
 * A deal's field history (revenue plan phase 8; Gong F23.11): every recorded change to the deal — stage, amount, close
 * date, next call, source, account, name, organization — with what it was before, who changed it and when. Read from the
 * deal's own append-only event log (remote_prospect_events, newest first), so nothing new is stored. "From" is the same
 * field's previous event in the window read; the first one shown has none. Pure.
 */
export type HistoryEvent = { kind: string; value: Record<string, unknown> | null; actor_id: string | null; created_at: string };
export type FieldChange = { at: string; who: string; field: string; from: string | null; to: string };
export type Fmt = { money: (n: number) => string; date: (iso: string) => string };

const FIELD: Record<string, string> = {
  stage: "Stage", amount: "Amount", close_date: "Close date", next_call: "Next call", source: "Source", account: "Account", name: "Name", organization: "Organization",
};

export function valueWord(kind: string, v: Record<string, unknown> | null, fmt: Fmt): string {
  const x = v ?? {};
  if (kind === "stage") {
    const status = x.status === "won" ? "Won" : x.status === "lost" ? "Lost" : "Open";
    return typeof x.label === "string" && x.label ? `${x.label} (${status.toLowerCase()})` : status;
  }
  if (kind === "amount") return typeof x.amount === "number" ? fmt.money(x.amount) : "none";
  if (kind === "close_date" || kind === "next_call") {
    if (typeof x.date !== "string") return "none";
    return `${fmt.date(x.date)}${typeof x.time === "string" ? ` ${x.time}` : ""}`;
  }
  if (kind === "account") return x.account_id ? "linked" : "none";
  return typeof x.text === "string" && x.text ? x.text : "none";
}

export function fieldChanges(events: HistoryEvent[], names: Map<string, string>, fmt: Fmt): FieldChange[] {
  const out: FieldChange[] = [];
  events.forEach((e, i) => {
    const field = FIELD[e.kind];
    if (!field) return;
    const prev = events.slice(i + 1).find((o) => o.kind === e.kind);
    const to = valueWord(e.kind, e.value, fmt);
    const from = prev ? valueWord(prev.kind, prev.value, fmt) : null;
    if (from === to) return; // saved again unchanged: not a change
    const who = (e.actor_id ? names.get(e.actor_id) : undefined) || "A teammate";
    out.push({ at: e.created_at, who, field, from, to });
  });
  return out;
}
