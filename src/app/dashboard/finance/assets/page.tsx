"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney, parseMoneyInput } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Boxes, Plus } from "lucide-react";

/**
 * Fixed asset register (0166).
 *
 * THE COLUMN THAT PREVENTS THE BUG IS "LIFE LEFT", NOT "BOOK VALUE".
 *
 * Net book value alone hides the state that actually matters. An asset showing NBV 1,000 might be fully
 * depreciated (it has reached salvage and MUST stop) or have years to run. Those are indistinguishable
 * from NBV — and the difference decides whether the next depreciation run is correct or quietly produces
 * a false asset valuation on the balance sheet.
 *
 * So the register shows remaining depreciable base, and an asset that has reached salvage says so in
 * words — "fully depreciated" — rather than presenting a Depreciate button that will simply throw. The
 * point of a control surface is to make the wrong action unavailable, not to let the database catch it.
 */

type Asset = {
  id: string;
  name: string;
  acquired_date: string;
  cost: number;
  salvage_value: number;
  useful_life_months: number;
  status: string;
  disposed_date: string | null;
  accumulated_depreciation: number;
  net_book_value: number;
  remaining_depreciable: number;
};
type Account = { id: string; code: string; name: string; type: string };
type Period = { id: string; name?: string; start_date: string; status: string };

export default function AssetsPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [acct, setAcct] = useState("");
  const [cost, setCost] = useState("");
  const [salvage, setSalvage] = useState("");
  const [life, setLife] = useState("");

  const load = useCallback(async () => {
    const [a, ac, pe] = await Promise.all([
      fetch("/api/finance/assets").then((x) => x.json()),
      fetch("/api/finance/accounts").then((x) => x.json()),
      fetch("/api/finance/periods").then((x) => x.json()),
    ]);
    // "No assets" and "we could not read your assets" are different claims — only one means the company
    // owns nothing.
    if (a.error) {
      setLoadError(a.error);
      setReady(true);
      return;
    }
    setLoadError(null);
    setAssets(a.assets ?? []);
    setAccounts(ac.accounts ?? []);
    setPeriods((pe.periods ?? []).filter((p: Period) => p.status === "open"));
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  const openPeriod = periods[0];

  async function register() {
    const c = parseMoneyInput(cost);
    const s = salvage.trim() ? parseMoneyInput(salvage) : 0;
    const l = Number(life);
    if (!name.trim() || !acct) return toast.error("Name the asset and pick its GL account.");
    if (!Number.isFinite(c) || c <= 0) return toast.error("Enter the cost.");
    if (!Number.isFinite(l) || l <= 0) return toast.error("Enter the useful life in months.");
    if (Number.isFinite(s) && s >= c) {
      // Mirrors the DB CHECK. Salvage >= cost means a negative depreciable base — the asset would either
      // depreciate backwards or never at all, and nobody means to create that.
      return toast.error("Salvage must be less than cost", "You cannot depreciate below scrap value.");
    }

    const res = await fetch("/api/finance/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        name: name.trim(),
        assetAccountId: acct,
        acquiredDate: new Date().toISOString().slice(0, 10),
        cost: c,
        salvageValue: Number.isFinite(s) ? s : 0,
        usefulLifeMonths: l,
      }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not register the asset.");
    setName("");
    setCost("");
    setSalvage("");
    setLife("");
    toast.success("Asset registered");
    load();
  }

  async function act(id: string, action: "depreciate" | "dispose", proceeds?: number) {
    if (!openPeriod) return toast.error("No open period", "Open a period before posting to the ledger.");
    setBusy(id);
    try {
      const res = await fetch("/api/finance/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          assetId: id,
          periodId: openPeriod.id,
          ...(action === "dispose" ? { proceeds: proceeds ?? 0 } : {}),
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        // The database's message is the useful one — "fully depreciated" tells the user the asset's life
        // is over, which is a fact. Replacing it with generic wording would read as a bug.
        return toast.error(j.error ?? "Could not complete that.");
      }
      toast.success(
        action === "depreciate" ? "Depreciation posted" : "Asset disposed",
        action === "depreciate"
          ? "Dr Depreciation Expense / Cr Accumulated Depreciation. Running it again for the same month posts nothing."
          : "Cost and accumulated depreciation removed; gain or loss booked.",
      );
      load();
    } finally {
      setBusy(null);
    }
  }

  if (ready === false) return <FinanceNotSetUp feature="Fixed assets" />;

  const assetAccounts = accounts.filter((a) => a.type === "asset");

  return (
    <>
      <TopBar title="Fixed assets" />
      <FinanceNav />
      <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load the asset register: {loadError}. This is <strong>not</strong> the same as owning
            nothing.
          </div>
        )}

        {!openPeriod && assets.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            No open period. Depreciation and disposal post to the ledger, so they need one — a closed month
            cannot be reached back into.
          </div>
        )}

        <section className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-neutral-600">
            Asset
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Delivery van"
              className="mt-1 block w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-neutral-600">
            GL account
            <select value={acct} onChange={(e) => setAcct(e.target.value)}
              className="mt-1 block w-44 rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              <option value="">Pick an asset account…</option>
              {assetAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} · {a.name}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-neutral-600">
            Cost
            <input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="10000.00"
              className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-neutral-600">
            Salvage
            <input value={salvage} onChange={(e) => setSalvage(e.target.value)} inputMode="decimal" placeholder="1000.00"
              className="mt-1 block w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs text-neutral-600">
            Life (months)
            <input value={life} onChange={(e) => setLife(e.target.value)} inputMode="numeric" placeholder="60"
              className="mt-1 block w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
          </label>
          <button onClick={register}
            className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white">
            <Plus size={14} /> Register
          </button>
        </section>

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Asset</th>
                <th className="px-3 py-2 text-right">Cost</th>
                <th className="px-3 py-2 text-right">Depreciated</th>
                <th className="px-3 py-2 text-right">Book value</th>
                <th className="px-3 py-2">Life left</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-neutral-500">
                    <Boxes className="mx-auto mb-2 text-neutral-400" size={20} />
                    No assets registered. Equipment you own loses value over time — recording it here posts
                    that loss to the ledger each month instead of leaving the books overstated.
                  </td>
                </tr>
              )}
              {assets.map((a) => {
                const done = Number(a.remaining_depreciable) <= 0;
                const disposed = a.status === "disposed";
                return (
                  <tr key={a.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">
                      <div className="font-medium">{a.name}</div>
                      <div className="text-xs text-neutral-500">
                        {a.acquired_date} · {a.useful_life_months} months
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMoney(a.cost)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                      {formatMoney(a.accumulated_depreciation)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {formatMoney(a.net_book_value)}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {disposed ? (
                        <span className="text-neutral-500">Disposed {a.disposed_date ?? ""}</span>
                      ) : done ? (
                        // Say it, don't just disable a button. The asset has reached salvage; depreciating
                        // further would claim it is worth less than scrap.
                        <span className="text-neutral-600">
                          Fully depreciated — it has reached its {formatMoney(a.salvage_value)} salvage value
                          and stops here.
                        </span>
                      ) : (
                        <span className="text-neutral-600">
                          {formatMoney(a.remaining_depreciable)} still to depreciate
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {!disposed && (
                        <div className="flex items-center justify-end gap-1">
                          {/* The wrong action is made unavailable, rather than left for the database to
                              reject. A Depreciate button on a fully-depreciated asset is a button that
                              exists only to throw. */}
                          {!done && (
                            <button
                              onClick={() => act(a.id, "depreciate")}
                              disabled={busy === a.id || !openPeriod}
                              className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs text-white disabled:opacity-40"
                            >
                              {busy === a.id ? "…" : "Depreciate"}
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const p = window.prompt(`Proceeds from disposing "${a.name}"? (0 if scrapped)`, "0");
                              if (p === null) return;
                              const v = parseMoneyInput(p);
                              if (!Number.isFinite(v) || v < 0) return toast.error("Enter a valid amount.");
                              void act(a.id, "dispose", v);
                            }}
                            disabled={busy === a.id || !openPeriod}
                            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs disabled:opacity-40"
                          >
                            Dispose
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <p className="text-xs text-neutral-500">
          Depreciating posts <strong>Dr Depreciation Expense / Cr Accumulated Depreciation</strong> for one
          month. Running it twice for the same month posts nothing the second time — so a retried job can
          never double-charge you.
        </p>
      </main>
    </>
  );
}
