"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/finance/format";

/**
 * The KPI strip (migration 0165): burn, runway, DSO, margin.
 *
 * THE HARD PART OF THIS COMPONENT IS RENDERING A MISSING NUMBER.
 *
 * Every ratio here can legitimately be null, and each null means something specific that a "0" or a "—"
 * would misrepresent:
 *
 *   runway = null   → not burning. Rendering "0 months" would say the company is out of money TODAY.
 *   DSO    = null   → no revenue in the window. Rendering "0 days" would say customers pay instantly.
 *   margin = null   → COGS is not tracked yet. Rendering "100%" would look like a triumph.
 *
 * A bare "—" is barely better: the user reads it as a broken tile and either ignores the dashboard or
 * files a bug. So each missing ratio states its REASON in place of the number. The tile stays honest and
 * the user learns something instead of distrusting the screen.
 *
 * This is the §3.4 rule at the pixel level: a number the system cannot honestly compute must not be
 * dressed up as one it can.
 */

type Kpis = {
  windowFrom: string;
  windowTo: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  cashBalance: number;
  arOutstanding: number;
  monthlyBurn: number | null;
  runwayMonths: number | null;
  dsoDays: number | null;
  grossMarginPct: number | null;
  netMarginPct: number | null;
  cogsTracked: boolean;
};

function Tile({
  label,
  value,
  missingReason,
  tone = "neutral",
}: {
  label: string;
  value: string | null;
  missingReason?: string;
  tone?: "neutral" | "warn" | "good";
}) {
  const toneClass =
    tone === "warn" ? "text-amber-300" : tone === "good" ? "text-emerald-400" : "text-primary";
  return (
    <div className="glass-card p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted">{label}</div>
      {value !== null ? (
        <div className={`mt-1 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      ) : (
        // Not "—". The reason, in words. A blank tile reads as a broken dashboard; a stated reason reads
        // as an honest one, and tells the user what to do about it.
        <div className="mt-1 text-xs leading-snug text-muted">{missingReason}</div>
      )}
    </div>
  );
}

export default function KpiStrip() {
  const [k, setK] = useState<Kpis | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/finance/kpis")
      .then((r) => r.json())
      .then((j) => {
        // A failed load must never render as a strip of zeroes — "we couldn't load your KPIs" and "you
        // have no revenue, no cash and no receivables" are wildly different claims.
        if (j.error) return setErr(true);
        setK(j.kpis ?? null);
      })
      .catch(() => setErr(true));
  }, []);

  if (err) {
    return (
      <div className="glass-card p-4 text-xs text-amber-300">
        Couldn&apos;t load your KPIs. This is <strong>not</strong> the same as having none — don&apos;t read
        this screen as a zero.
      </div>
    );
  }

  if (!k) return null; // no posted activity yet — a true, calm empty

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile
        label="Cash on hand"
        value={formatMoney(k.cashBalance)}
        tone={k.cashBalance > 0 ? "neutral" : "warn"}
      />

      <Tile
        label="Monthly burn"
        value={k.monthlyBurn === null ? null : formatMoney(k.monthlyBurn)}
        missingReason="Not burning — the company took in more than it spent over the last 12 months."
        tone="warn"
      />

      <Tile
        label="Runway"
        value={k.runwayMonths === null ? null : `${k.runwayMonths} months`}
        // "0 months" would mean out of money today. Null means the question doesn't apply.
        missingReason="Not applicable — you aren't burning cash, so there is no finite runway."
        tone={k.runwayMonths !== null && k.runwayMonths < 6 ? "warn" : "neutral"}
      />

      <Tile
        label="DSO — days to get paid"
        value={k.dsoDays === null ? null : `${k.dsoDays} days`}
        // "0 days" would mean customers pay instantly. They don't; there's just no revenue to divide by.
        missingReason="No revenue in the last 12 months, so there's nothing to measure collection speed against."
        tone={k.dsoDays !== null && k.dsoDays > 60 ? "warn" : "neutral"}
      />

      <Tile label="Revenue (12 mo)" value={formatMoney(k.revenue)} />
      <Tile label="Owed to us" value={formatMoney(k.arOutstanding)} />

      <Tile
        label="Gross margin"
        value={k.grossMarginPct === null ? null : `${k.grossMarginPct}%`}
        // The important one. Showing a number here without COGS would report ~100% and look like triumph.
        missingReason="We don't track cost of goods sold yet, so a true gross margin can't be computed. Net margin is shown alongside."
        tone="neutral"
      />

      <Tile
        label="Net margin"
        value={k.netMarginPct === null ? null : `${k.netMarginPct}%`}
        missingReason="No revenue in the last 12 months to measure margin against."
        tone={k.netMarginPct !== null && k.netMarginPct < 0 ? "warn" : "good"}
      />
    </div>
  );
}
