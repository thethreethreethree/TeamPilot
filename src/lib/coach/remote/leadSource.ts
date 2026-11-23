/**
 * Pipeline → Sources (2026-11-23; migration 0313). Deals by lead source: how many prospects each source brought, what
 * is still open, what was won and lost, and the win rate on closed deals. Pure, so the arithmetic is tested.
 *
 * Win rate is won / (won + lost) — closed deals only — and is null until a source has a closed deal: an open-only
 * source has no rate yet, which is not the same as 0%. Sources are grouped ignoring case and spacing, shown with the
 * most used spelling.
 */
export const NO_SOURCE = "No source set";

type P = { source: string | null; status: "open" | "won" | "lost"; amount: number | null };
export type SourceRow = { source: string; prospects: number; open: number; openAmount: number; won: number; wonAmount: number; lost: number; winRate: number | null };

const key = (s: string | null) => (s ?? "").trim().replace(/\s+/g, " ").toLowerCase();

export function sourceBreakdown(prospects: P[]): SourceRow[] {
  const groups = new Map<string, { names: Map<string, number>; rows: P[] }>();
  for (const p of prospects) {
    const k = key(p.source);
    const g = groups.get(k) ?? { names: new Map<string, number>(), rows: [] as P[] };
    if (k) {
      const n = p.source!.trim().replace(/\s+/g, " ");
      g.names.set(n, (g.names.get(n) ?? 0) + 1);
    }
    g.rows.push(p);
    groups.set(k, g);
  }
  const out: SourceRow[] = [];
  for (const [k, g] of groups) {
    // Most used spelling; on a tie, the one with capitals first ("Webinar" before "webinar"), by code point.
    const name = k ? [...g.names.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0]![0] : NO_SOURCE;
    const by = (s: P["status"]) => g.rows.filter((r) => r.status === s);
    const sum = (rs: P[]) => rs.reduce((t, r) => t + (r.amount ?? 0), 0);
    const won = by("won");
    const lost = by("lost");
    const closed = won.length + lost.length;
    out.push({
      source: name,
      prospects: g.rows.length,
      open: by("open").length,
      openAmount: sum(by("open")),
      won: won.length,
      wonAmount: sum(won),
      lost: lost.length,
      winRate: closed ? won.length / closed : null,
    });
  }
  // Most won value first, then most prospects; "No source set" last.
  return out.sort((a, b) => (a.source === NO_SOURCE ? 1 : 0) - (b.source === NO_SOURCE ? 1 : 0) || b.wonAmount - a.wonAmount || b.prospects - a.prospects || a.source.localeCompare(b.source));
}

/** Distinct sources in use, for the input's suggestions. */
export const sourcesInUse = (prospects: Array<{ source: string | null }>): string[] =>
  sourceBreakdown(prospects.map((p) => ({ source: p.source, status: "open" as const, amount: null }))).map((r) => r.source).filter((s) => s !== NO_SOURCE).sort((a, b) => a.localeCompare(b));
