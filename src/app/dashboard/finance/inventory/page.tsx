"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney, parseMoneyInput } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Package, AlertTriangle, Plus } from "lucide-react";

/**
 * Inventory — weighted average, perpetual.
 *
 * THE PAGE WILL NOT LET YOU SELL STOCK YOU DO NOT HAVE, AND IT DOES NOT APOLOGISE FOR IT.
 *
 * The tempting behaviour is to let the sale through and sort it out later — the customer is waiting, the
 * warehouse probably has it, the count is probably stale. Every inventory system that does this ends up
 * with a negative inventory balance: an asset account holding less than nothing, and a COGS figure computed
 * against the average cost of stock that never existed. A fabricated number, in the ledger, permanently.
 * And the books balance, so nothing ever objects.
 *
 * So the refusal is the database's, and this page simply shows it: "Only 6 are on hand — receive the stock
 * first, or record an adjustment if the count is wrong." That names both honest paths and offers no
 * dishonest one.
 *
 * SHRINKAGE HAS ITS OWN ACCOUNT (5900), NEVER COGS. Stock written off is not the cost of a sale — it is the
 * cost of a loss, and burying it inside COGS makes theft indistinguishable from a good month of trading.
 */

type Item = {
  id: string;
  sku: string;
  name: string;
  qty_on_hand: number;
  avg_cost: number;
  is_active: boolean;
};
type Disc = { item_id: string; sku: string; discrepancy: number; stated_value: number };
type Shrink = { month: string; write_offs: number; units_lost: number; value_lost: number };

export default function InventoryPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [discrepancies, setDiscrepancies] = useState<Disc[]>([]);
  const [shrinkage, setShrinkage] = useState<Shrink[]>([]);
  const [periodId, setPeriodId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sku, setSku] = useState("");
  const [name, setName] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [cost, setCost] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/finance/inventory");
    const j = await res.json();
    if (!res.ok || j.error) {
      setLoadError(j.error ?? "Could not load inventory.");
      setReady(true);
      return;
    }
    setLoadError(null);
    setItems(j.items ?? []);
    setDiscrepancies(j.discrepancies ?? []);
    setShrinkage(j.shrinkage ?? []);
    setPeriodId(j.openPeriodId ?? null);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  async function post(body: Record<string, unknown>, ok: string) {
    if (!periodId) {
      return toast.error("No open period", "Inventory movements post to the ledger, so they need one.");
    }
    setBusy(true);
    try {
      const res = await fetch("/api/finance/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, periodId }),
      });
      const j = await res.json();
      // The database's message is the useful one — it names the quantity actually on hand.
      if (!res.ok) return toast.error(j.error ?? "That didn't work.");
      toast.success(ok);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function adjust(item: Item) {
    const raw = window.prompt(
      `Adjust ${item.sku} (currently ${item.qty_on_hand} on hand).\n\nEnter the change: -3 for stock lost, +3 for stock found.`,
    );
    if (!raw) return;
    const delta = Number(raw);
    if (!Number.isFinite(delta) || delta === 0) return toast.error("Enter a number, positive or negative.");
    // The reason is required by the API schema, not merely requested here. A write-off with no reason is the
    // shape every inventory fraud takes.
    const reason = window.prompt("Why? (required — damaged, miscounted, stolen, expired…)");
    if (!reason || reason.trim().length < 3) {
      return toast.error("An adjustment needs a reason", "This is the record of where the stock went.");
    }
    post({ action: "adjust", itemId: item.id, qtyDelta: delta, reason: reason.trim() }, "Adjustment posted");
  }

  if (ready === false) return <FinanceNotSetUp feature="Inventory" />;

  const totalValue = items.reduce((s, i) => s + Number(i.qty_on_hand) * Number(i.avg_cost), 0);
  const recentShrink = shrinkage[0];

  return (
    <>
      <TopBar title="Inventory" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load inventory: {loadError}.
          </div>
        )}

        {/* The stated quantity disagreeing with the movement history means something wrote to the item
            directly, bypassing the locked RPCs. The movements are what actually happened. */}
        {discrepancies.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">
                  {discrepancies.length} {discrepancies.length === 1 ? "item's" : "items'"} stock level
                  disagrees with its own movement history.
                </div>
                <p className="mt-1">
                  Something changed these quantities without going through a receipt, sale or adjustment.
                  The movement history is what actually happened — trust it over the number on the shelf
                  label.
                </p>
                <ul className="mt-1 list-disc pl-4">
                  {discrepancies.map((d) => (
                    <li key={d.item_id}>
                      {d.sku}: out by {d.discrepancy}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-neutral-200 p-4">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Stock on hand, at cost</div>
            <div className="mt-1 text-3xl font-bold tabular-nums">{formatMoney(totalValue)}</div>
            <p className="mt-1 text-sm text-neutral-600">
              This is an <strong>asset</strong>, not an expense. It becomes an expense (cost of goods sold)
              at the moment you sell it — never before.
            </p>
          </div>

          {/* Shrinkage has its own account. Buried in COGS, theft looks like a good month of trading. */}
          <div
            className={`rounded-lg border p-4 ${
              recentShrink && Number(recentShrink.value_lost) > 0
                ? "border-amber-300 bg-amber-50"
                : "border-neutral-200"
            }`}
          >
            <div className="text-xs uppercase tracking-wide text-neutral-500">
              Stock written off this month
            </div>
            <div className="mt-1 text-3xl font-bold tabular-nums">
              {formatMoney(recentShrink?.value_lost ?? 0)}
            </div>
            <p className="mt-1 text-sm text-neutral-600">
              Kept in its <strong>own account</strong>, never inside cost of goods sold. Losses hidden among
              the costs of real sales are indistinguishable from a good month of trading.
            </p>
          </div>
        </div>

        <section className="rounded-lg border border-neutral-200 p-4">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-600">
              SKU
              <input
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="WIDGET-01"
                className="mt-1 block w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-neutral-600">
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Blue widget"
                className="mt-1 block w-44 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={() => {
                if (!sku.trim() || !name.trim()) return toast.error("A SKU and a name, please.");
                post({ action: "create", sku, name }, "Item added").then(() => {
                  setSku("");
                  setName("");
                });
              }}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
            >
              <Plus size={14} /> Add item
            </button>
          </div>
        </section>

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">Item</th>
                <th className="px-3 py-2 text-right">On hand</th>
                <th className="px-3 py-2 text-right">Avg cost</th>
                <th className="px-3 py-2 text-right">Value</th>
                <th className="px-3 py-2">Receive / sell</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-neutral-500">
                    <Package className="mx-auto mb-2 text-neutral-400" size={20} />
                    No items yet.
                  </td>
                </tr>
              )}
              {items.map((i) => (
                <tr key={i.id} className="border-t border-neutral-100">
                  <td className="px-3 py-2">
                    <div className="font-medium">{i.sku}</div>
                    <div className="text-xs text-neutral-500">{i.name}</div>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{i.qty_on_hand}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-neutral-600">
                    {formatMoney(i.avg_cost)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-medium">
                    {formatMoney(Number(i.qty_on_hand) * Number(i.avg_cost))}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <input
                        value={qty[i.id] ?? ""}
                        onChange={(e) => setQty({ ...qty, [i.id]: e.target.value })}
                        placeholder="qty"
                        inputMode="decimal"
                        className="w-16 rounded-md border border-neutral-300 px-1.5 py-1 text-xs"
                      />
                      <input
                        value={cost[i.id] ?? ""}
                        onChange={(e) => setCost({ ...cost, [i.id]: e.target.value })}
                        placeholder="unit cost"
                        inputMode="decimal"
                        className="w-20 rounded-md border border-neutral-300 px-1.5 py-1 text-xs"
                      />
                      <button
                        onClick={() => {
                          const q = parseMoneyInput(qty[i.id] ?? "");
                          const c = parseMoneyInput(cost[i.id] ?? "");
                          if (!Number.isFinite(q) || q <= 0) return toast.error("Enter a quantity.");
                          if (!Number.isFinite(c)) return toast.error("Enter the unit cost you paid.");
                          post({ action: "receive", itemId: i.id, qty: q, unitCost: c }, "Stock received");
                        }}
                        disabled={busy}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs disabled:opacity-40"
                      >
                        Receive
                      </button>
                      <button
                        onClick={() => {
                          const q = parseMoneyInput(qty[i.id] ?? "");
                          if (!Number.isFinite(q) || q <= 0) return toast.error("Enter a quantity.");
                          post({ action: "sell", itemId: i.id, qty: q }, "Sale posted — COGS recorded");
                        }}
                        disabled={busy}
                        className="rounded-md bg-neutral-900 px-2 py-1 text-xs text-white disabled:opacity-40"
                      >
                        Sell
                      </button>
                      <button
                        onClick={() => adjust(i)}
                        disabled={busy}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs text-neutral-600 disabled:opacity-40"
                      >
                        Adjust
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className="text-xs text-neutral-500">
          Costs use a <strong>weighted average</strong>: each delivery re-averages the unit cost, and every
          sale is costed at that average. Selling more than you hold is <strong>refused</strong> — we will
          not post a negative stock level or invent a cost for goods that never existed.
        </p>
      </main>
    </>
  );
}
