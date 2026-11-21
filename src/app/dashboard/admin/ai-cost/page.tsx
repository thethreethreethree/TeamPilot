"use client";

import { useCallback, useEffect, useState } from "react";
import { Coins } from "lucide-react";
import type { CostGroup, CostReport } from "@/lib/coach/remote/costReport";

/**
 * The vendor AI cost view (RSS Phase 0 step 6, Gong F28.7). Vendor-super-admin only (server layout + API).
 *
 * The plan's "Looked at": cost per session for yesterday, with "price missing" until prices are entered.
 * So the page opens on yesterday, prints "price missing" wherever a group contains an unpriced call — never
 * a partial sum — and puts the price form right under the list of prices it is missing, pre-filled.
 */

type Wire = { day: string; capped: boolean; report: CostReport; companyNames: Record<string, string> };
type PriceRow = { provider: string; model: string; unit: string; usd_per_unit: number; effective_from: string };

const yesterday = () => new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
const usd = (n: number | null) => (n === null ? "price missing" : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const UNIT_LABEL: Record<string, string> = { input_token: "per input token", output_token: "per output token", audio_second: "per audio second" };

export default function AiCostPage() {
  const [day, setDay] = useState(yesterday());
  const [wire, setWire] = useState<Wire | null>(null);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [r, p] = await Promise.all([fetch(`/api/admin/ai-cost?day=${day}`), fetch("/api/admin/ai-cost/prices")]);
      const j = await r.json();
      if (!r.ok) {
        setWire(null);
        setError(j.error ?? "Couldn't load AI cost.");
      } else setWire(j as Wire);
      if (p.ok) setPrices(((await p.json()).prices ?? []) as PriceRow[]);
    } catch {
      setError("Couldn't load AI cost.");
    }
  }, [day]);

  useEffect(() => {
    void load();
  }, [load]);

  const name = (id: string | null) => (id ? wire?.companyNames[id] ?? id.slice(0, 8) : "No company (ELOSTATE background work)");

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold text-primary">
          <Coins className="h-5 w-5 text-brand" aria-hidden /> AI cost
        </h1>
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          Day (UTC)
          <input
            type="date"
            value={day}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => e.currentTarget.value && setDay(e.currentTarget.value)}
            className="rounded-lg border border-default bg-base px-2 py-1 text-sm text-primary"
          />
        </label>
      </header>
      <p className="text-xs text-muted">
        Vendor only. Every AI call is recorded with its token counts; cost uses the prices entered below. Nothing is
        estimated: a call with no entered price shows as &quot;price missing&quot;. Live streaming calls and
        speech-to-text are not recorded yet.
      </p>

      {error && <p className="rounded-xl border border-default bg-surface p-4 text-sm text-muted">{error}</p>}

      {wire && (
        <>
          <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="AI calls" value={String(wire.report.calls)} />
            <Tile label="Cost of priced calls" value={usd(wire.report.pricedUsd)} />
            <Tile label="Calls with no price" value={String(wire.report.unpricedCalls)} />
            <Tile label="Sessions" value={String(wire.report.sessions.length)} />
          </section>
          {wire.capped && (
            <p className="text-xs text-muted">This day has more than 1,000 calls; only the first 1,000 are counted here.</p>
          )}

          <Table title="Cost per session" groups={wire.report.sessions} label={(g) => `${name(g.companyId)} · session ${String(g.key).slice(0, 8)}`} />
          <Table title="Cost per company" groups={wire.report.companies} label={(g) => name(g.key)} />
          <Table title="Cost per feature" groups={wire.report.engines} label={(g) => String(g.key)} />

          <PriceForm missing={wire.report.missingPrices} prices={prices} onSaved={load} />
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-default bg-surface p-3">
      <span className="block text-xs text-muted">{label}</span>
      <span className="block text-lg font-semibold tabular-nums text-primary">{value}</span>
    </div>
  );
}

function Table({ title, groups, label }: { title: string; groups: CostGroup[]; label: (g: CostGroup) => string }) {
  return (
    <section className="rounded-xl border border-default bg-surface p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {groups.length === 0 ? (
        <p className="text-sm text-muted">Nothing recorded for this day.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 pr-3 font-medium">Name</th>
                <th className="py-1 pr-3 text-right font-medium">Calls</th>
                <th className="py-1 pr-3 text-right font-medium">Input tokens</th>
                <th className="py-1 pr-3 text-right font-medium">Output tokens</th>
                <th className="py-1 text-right font-medium">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-default">
              {groups.map((g) => (
                <tr key={String(g.key)}>
                  <td className="py-1.5 pr-3 text-primary">{label(g)}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-secondary">{g.calls}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-secondary">{g.inputTokens.toLocaleString()}</td>
                  <td className="py-1.5 pr-3 text-right tabular-nums text-secondary">{g.outputTokens.toLocaleString()}</td>
                  <td className={`py-1.5 text-right tabular-nums ${g.usd === null ? "text-muted italic" : "text-primary"}`}>{usd(g.usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PriceForm({
  missing,
  prices,
  onSaved,
}: {
  missing: CostReport["missingPrices"];
  prices: PriceRow[];
  onSaved: () => Promise<void>;
}) {
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [unit, setUnit] = useState("input_token");
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const usdPerUnit = Number(rate);
    if (!provider.trim() || !model.trim() || !from || !Number.isFinite(usdPerUnit) || usdPerUnit < 0) {
      setMsg("Fill in provider, model, a price of 0 or more, and the date it applies from.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/ai-cost/prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: provider.trim(), model: model.trim(), unit, usdPerUnit, effectiveFrom: from }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setMsg(j.error ?? "Couldn't save the price.");
        return;
      }
      setRate("");
      setMsg("Price saved.");
      await onSaved();
    } catch {
      setMsg("Couldn't save the price.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-default bg-surface p-4">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Prices</h2>
      <p className="mb-3 text-xs text-muted">
        Enter each price from the provider&apos;s own pricing page, in US dollars per single unit (for example a
        price of $0.27 per million input tokens is 0.00000027). A new price for the same model is a new row with a
        later date, so past days keep the price that applied then.
      </p>

      {missing.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-primary">Missing for this day — click one to fill the form:</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((m) => (
              <button
                key={`${m.provider}-${m.model}-${m.unit}`}
                type="button"
                onClick={() => {
                  setProvider(m.provider);
                  setModel(m.model);
                  setUnit(m.unit);
                }}
                className="rounded-lg border border-default px-2 py-0.5 text-xs text-muted hover:text-primary"
              >
                {m.provider} · {m.model} · {UNIT_LABEL[m.unit] ?? m.unit}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-2 md:grid-cols-5">
        <input value={provider} onChange={(e) => setProvider(e.currentTarget.value)} placeholder="provider" aria-label="Provider" className="rounded-lg border border-default bg-base p-2 text-sm text-primary" />
        <input value={model} onChange={(e) => setModel(e.currentTarget.value)} placeholder="model" aria-label="Model" className="rounded-lg border border-default bg-base p-2 text-sm text-primary" />
        <select value={unit} onChange={(e) => setUnit(e.currentTarget.value)} aria-label="Unit" className="rounded-lg border border-default bg-base p-2 text-sm text-primary">
          <option value="input_token">per input token</option>
          <option value="output_token">per output token</option>
          <option value="audio_second">per audio second</option>
        </select>
        <input value={rate} onChange={(e) => setRate(e.currentTarget.value)} inputMode="decimal" placeholder="USD per unit" aria-label="US dollars per unit" className="rounded-lg border border-default bg-base p-2 text-sm text-primary" />
        <input type="date" value={from} onChange={(e) => setFrom(e.currentTarget.value)} aria-label="Applies from" className="rounded-lg border border-default bg-base p-2 text-sm text-primary" />
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="mt-2 rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-50"
      >
        Save price
      </button>
      {msg && (
        <p className="mt-2 text-xs text-muted" role="status">
          {msg}
        </p>
      )}

      {prices.length > 0 && (
        <ul className="mt-3 divide-y divide-default text-xs">
          {prices.map((p) => (
            <li key={`${p.provider}-${p.model}-${p.unit}-${p.effective_from}`} className="flex flex-wrap gap-2 py-1 text-secondary">
              <span className="text-primary">{p.provider} · {p.model}</span>
              <span>{UNIT_LABEL[p.unit] ?? p.unit}: ${Number(p.usd_per_unit)}</span>
              <span className="text-muted">from {p.effective_from}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
