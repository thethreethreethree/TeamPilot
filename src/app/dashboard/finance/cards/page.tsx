"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { CreditCard, Upload, Wand2, Plus } from "lucide-react";

/**
 * Corporate cards — reconciling card charges against expense claims.
 *
 * THE PAGE LEADS WITH THE RESIDUE, NOT THE PROGRESS.
 * The instinct for a reconciliation screen is to show "94% matched" and feel finished. That is exactly
 * backwards here. A bank reconciliation asks "did this entry clear?"; a CARD reconciliation asks the
 * uncomfortable question: "is this charge backed by a claim anyone actually submitted?" The UNMATCHED
 * total is company money spent that nobody has accounted for — it is the entire reason the feature
 * exists. So it is the headline figure on every card, and a card with unmatched spend is visually
 * flagged rather than folded into an average.
 *
 * Auto-match deliberately leaves ambiguous charges alone (two possible claims → no guess). So "matched
 * 0" after a run is a real, honest answer — not a failure — and the copy says so, because a user who
 * reads "0" as breakage will go looking for a bug that isn't there.
 */

type Card = {
  card_id: string;
  label: string;
  last4: string | null;
  provider: string | null;
  currency: string;
  unmatched_count: number;
  unmatched_total: number;
  imported_total: number;
};

export default function CardsPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [last4, setLast4] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const j = await fetch("/api/finance/cards").then((x) => x.json());
    // "No cards" and "we could not read your cards" are different facts. Only one of them means the
    // company has no card exposure — so a read failure is never rendered as an empty, reassuring list.
    if (j.error) {
      setLoadError(j.error);
      setReady(true);
      return;
    }
    setLoadError(null);
    setCards(j.cards ?? []);
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  async function addCard() {
    if (!label.trim()) return toast.error("Give the card a name.");
    const res = await fetch("/api/finance/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), last4: last4.trim() || undefined }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not register the card.");
    setLabel("");
    setLast4("");
    toast.success("Card registered");
    load();
  }

  async function importStatement(cardId: string, file: File) {
    setBusy(cardId);
    try {
      const csv = await file.text();
      const res = await fetch(`/api/finance/cards/${cardId}/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      const j = await res.json();
      if (!res.ok) return toast.error(j.error ?? "Import failed.");

      // Every row is accounted for out loud. A statement import that quietly loses charges is the exact
      // failure this control exists to prevent, so skipped/duplicate counts are reported, never hidden
      // behind a cheerful "imported!".
      const bits = [`${j.imported} imported`];
      if (j.duplicates) bits.push(`${j.duplicates} already on file`);
      if (j.skipped) bits.push(`${j.skipped} unreadable`);
      toast.success("Statement imported", bits.join(" · "));
      load();
    } finally {
      setBusy(null);
    }
  }

  async function autoMatch(cardId: string) {
    setBusy(cardId);
    try {
      const res = await fetch(`/api/finance/cards/${cardId}/automatch`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) return toast.error(j.error ?? "Could not reconcile.");
      if (j.matched === 0) {
        // A real answer, not a fault. Auto-match refuses to guess between two possible claims — saying
        // so prevents the user hunting a bug that does not exist.
        toast.success("Nothing matched automatically", "Charges only auto-match when exactly one claim fits. The rest need a human.");
      } else {
        toast.success(`${j.matched} charge${j.matched === 1 ? "" : "s"} matched to claims`);
      }
      load();
    } finally {
      setBusy(null);
    }
  }

  if (ready === false) return <FinanceNotSetUp feature="Corporate cards" />;

  const totalUnmatched = cards.reduce((s, c) => s + Number(c.unmatched_total || 0), 0);
  const totalUnmatchedCount = cards.reduce((s, c) => s + Number(c.unmatched_count || 0), 0);

  return (
    <>
      <TopBar title="Corporate cards" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load your cards: {loadError}. This is <strong>not</strong> the same as having none.
          </div>
        )}

        {/* The headline is the unaccounted-for money, not a completion percentage. */}
        <section className="rounded-lg border border-neutral-200 p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Unclaimed card spend</div>
          <div className="mt-1 flex items-baseline gap-3">
            <div
              className={`text-3xl font-bold tabular-nums ${
                totalUnmatched > 0 ? "text-amber-700" : "text-neutral-900"
              }`}
            >
              {formatMoney(totalUnmatched)}
            </div>
            <div className="text-sm text-neutral-600">
              across {totalUnmatchedCount} charge{totalUnmatchedCount === 1 ? "" : "s"}
            </div>
          </div>
          <p className="mt-2 text-sm text-neutral-600">
            Money spent on a company card that nobody has submitted an expense claim for. This is the
            number this page exists to shrink.
          </p>
        </section>

        <section className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-neutral-600">
            Card name
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Ops Amex"
              className="mt-1 block w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <label className="text-xs text-neutral-600">
            Last 4
            <input
              value={last4}
              onChange={(e) => setLast4(e.target.value)}
              inputMode="numeric"
              placeholder="4321"
              className="mt-1 block w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={addCard}
            className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
          >
            <Plus size={14} /> Register card
          </button>
        </section>

        <section className="space-y-3">
          {cards.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
              No cards registered. Register one, then import its statement to see what has been spent but
              never claimed.
            </div>
          )}

          {cards.map((c) => (
            <div
              key={c.card_id}
              className={`rounded-lg border p-4 ${
                c.unmatched_count > 0 ? "border-amber-300 bg-amber-50/40" : "border-neutral-200"
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-neutral-500" />
                  <div>
                    <div className="font-medium">
                      {c.label}
                      {c.last4 && <span className="ml-1 text-neutral-500">···{c.last4}</span>}
                    </div>
                    <div className="text-xs text-neutral-500">
                      {c.unmatched_count > 0 ? (
                        <span className="text-amber-800">
                          {formatMoney(c.unmatched_total)} unclaimed across {c.unmatched_count} charge
                          {c.unmatched_count === 1 ? "" : "s"}
                        </span>
                      ) : (
                        "Every imported charge is backed by a claim"
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
                    <Upload size={14} /> Import statement
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      disabled={busy === c.card_id}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) importStatement(c.card_id, f);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <button
                    onClick={() => autoMatch(c.card_id)}
                    disabled={busy === c.card_id}
                    className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                  >
                    <Wand2 size={14} /> {busy === c.card_id ? "Working…" : "Auto-match"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
