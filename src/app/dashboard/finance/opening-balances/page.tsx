"use client";

import { useEffect, useState, useCallback } from "react";
// LOCAL calendar day — new Date().toISOString() is UTC, dating the record a day ahead
// for an evening user west of UTC. (Same fix pos/ap/ar already use.)
import { todayIso } from "@/lib/finance/dateRange";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { parseTrialBalance, tbImbalance } from "@/lib/finance/trialBalance";
import { useToast } from "@/components/ui/toast";
import { Upload, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Opening balances — bringing the old books in.
 *
 * THE IMBALANCE IS THE HEADLINE, NOT THE ERROR.
 *
 * A trial balance exported from a real company's old system very often does not balance. The obvious UI
 * would refuse it: a red error, "debits must equal credits", fix your file and try again. That would be a
 * quiet catastrophe — the user would open the spreadsheet, force the numbers to tie, and re-upload. The
 * discrepancy, which is the single most valuable thing the import had to tell them and the only moment
 * anyone will ever be positioned to find it, would be erased by hand and never recorded.
 *
 * So this page ACCEPTS the imbalanced trial balance, shows the gap in the largest type on the screen, and
 * explains what it means in words a non-accountant can act on. The difference posts to Opening Balance
 * Equity, where it stays on the balance sheet until a human resolves it.
 *
 * The screen never says "balanced" unless it is. And it never says "unbalanced by 0.00" either — a zero
 * imbalance gets the green state, because a warning that fires when nothing is wrong is how users learn to
 * ignore warnings.
 */

type Account = { id: string; code: string; name: string };
type Period = { id: string; status: string };
type Summary = { line_count: number; total_debits: number; total_credits: number; imbalance: number };
type Batch = {
  id: string;
  as_of: string;
  source: string | null;
  status: string;
  posted_at: string | null;
  summary: Summary | null;
};

const today = todayIso;

export default function OpeningBalancesPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [obe, setObe] = useState<number | null>(null);
  const [obeUnknown, setObeUnknown] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [raw, setRaw] = useState("");
  const [asOf, setAsOf] = useState(today());
  const [source, setSource] = useState("");

  const load = useCallback(async () => {
    const [a, p, o] = await Promise.all([
      fetch("/api/finance/accounts").then((x) => x.json()),
      fetch("/api/finance/periods").then((x) => x.json()),
      fetch("/api/finance/opening-balances").then((x) => x.json()),
    ]);
    if (o.error) {
      setLoadError(o.error);
      setReady(true);
      return;
    }
    setLoadError(null);
    setAccounts(a.accounts ?? []);
    setPeriods((p.periods ?? []).filter((x: Period) => x.status === "open"));
    setBatches(o.batches ?? []);
    setObe(o.imbalance ?? null);
    setObeUnknown(Boolean(o.imbalanceUnknown));
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  const parsed = parseTrialBalance(raw, accounts);
  const debits = parsed.lines.reduce((s, l) => s + l.debit, 0);
  const credits = parsed.lines.reduce((s, l) => s + l.credit, 0);
  const imbalance = tbImbalance(parsed.lines);
  const openPeriod = periods[0];

  async function stage() {
    if (parsed.lines.length === 0) return toast.error("Nothing to import — paste a trial balance first.");
    if (parsed.bad.length > 0) {
      // We do NOT import a partial trial balance. An import missing an account still looks complete, and
      // its imbalance would be blamed on the old system rather than on us dropping a row.
      return toast.error(
        `${parsed.bad.length} row(s) could not be read`,
        "We won't import a partial trial balance — the missing accounts would look like the old system's error, not ours. Fix or remove them first.",
      );
    }
    setBusy(true);
    try {
      const res = await fetch("/api/finance/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "stage",
          asOf,
          source: source.trim() || undefined,
          lines: parsed.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit })),
        }),
      });
      const j = await res.json();
      if (!res.ok) return toast.error(j.error ?? "Could not stage the import.");
      setRaw("");
      toast.success("Trial balance staged", "Review it below, then post it to the ledger.");
      load();
    } finally {
      setBusy(false);
    }
  }

  async function post(id: string) {
    if (!openPeriod) return toast.error("No open period", "Opening balances need an open period to post into — open or create one in Finance → Periods first.");
    setBusy(true);
    try {
      const res = await fetch("/api/finance/opening-balances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "post", batchId: id, periodId: openPeriod.id }),
      });
      const j = await res.json();
      if (!res.ok) return toast.error(j.error ?? "Could not post opening balances.");
      toast.success("Opening balances posted", "Your books now start where the old ones ended.");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (ready === false) return <FinanceNotSetUp feature="Opening balances" />;

  return (
    <>
      <TopBar title="Opening balances" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load opening balances: {loadError}.
          </div>
        )}

        {/* An unresolved OBE balance is the most important thing on this page, so it sits at the top and
            stays there until someone clears it. "Unknown" is never rendered as "clear". */}
        {obeUnknown && (
          <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-sm text-neutral-700">
            We couldn&apos;t check whether an opening difference is outstanding. That is not the same as
            there being none.
          </div>
        )}
        {!obeUnknown && obe != null && Math.abs(obe) > 0.005 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            <div className="flex items-start gap-2">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">
                  Your old books were out by {formatMoney(Math.abs(obe))}.
                </div>
                <p className="mt-1">
                  That difference is sitting in <strong>Opening Balance Equity</strong> on your balance
                  sheet. We did <strong>not</strong> hide it inside another account — if we had, your books
                  would look perfect and be wrong. It stays there until someone finds what it was: usually a
                  missing account, a rounding difference, or a half-migrated subledger. Post a journal entry
                  clearing it once you know.
                </p>
              </div>
            </div>
          </div>
        )}

        <section className="rounded-lg border border-neutral-200 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Upload size={18} /> Bring in your old books
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Paste your trial balance from your old system — one line per account:{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-xs">account code, debit, credit</code>.
            Balances are as at the close of the date you choose; trading from the next day onwards is
            recorded here.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-600">
              Balances as at
              <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)}
                className="mt-1 block rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
            <label className="text-xs text-neutral-600">
              Where from
              <input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Xero export"
                className="mt-1 block w-40 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
            </label>
          </div>

          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder={"1000, 10000.00, 0\n2000, 0, 3000.00\n3100, 0, 6500.00"}
            className="mt-3 w-full rounded-md border border-neutral-300 p-2 font-mono text-xs"
          />

          {/* THE PREVIEW. The user must see the imbalance BEFORE committing — after posting, the moment to
              catch it has passed. */}
          {parsed.lines.length > 0 && (
            <div className="mt-3 rounded-lg border border-neutral-200 p-3">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Debits</div>
                  <div className="tabular-nums">{formatMoney(debits)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Credits</div>
                  <div className="tabular-nums">{formatMoney(credits)}</div>
                </div>
                <div>
                  <div className="text-xs uppercase tracking-wide text-neutral-500">Accounts</div>
                  <div className="tabular-nums">{parsed.lines.length}</div>
                </div>
              </div>

              {Math.abs(imbalance) < 0.005 ? (
                <div className="mt-3 flex items-center gap-2 text-sm text-emerald-800">
                  <CheckCircle2 size={16} /> Your trial balance balances. Nothing will go to Opening Balance
                  Equity.
                </div>
              ) : (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                  <div className="font-semibold">
                    This trial balance is out by {formatMoney(Math.abs(imbalance))}.
                  </div>
                  <p className="mt-1">
                    You can still import it — that&apos;s normal, and the gap is worth knowing about. It will
                    be posted to <strong>Opening Balance Equity</strong> so it stays visible on your balance
                    sheet rather than being quietly absorbed into another account.{" "}
                    <strong>We will not make it balance for you</strong>: books that were forced to tie would
                    look right and be wrong.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Unreadable rows are NAMED. A silent skip yields an import that looks complete and isn't. */}
          {parsed.bad.length > 0 && (
            <div className="mt-3 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800">
              <div className="font-semibold">
                {parsed.bad.length} row(s) couldn&apos;t be read and were <strong>not</strong> imported:
              </div>
              <ul className="mt-1 list-disc pl-4 font-mono">
                {parsed.bad.slice(0, 5).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
              <p className="mt-1 font-sans">
                Usually an account code that doesn&apos;t exist in your chart of accounts yet. Add it first —
                we won&apos;t invent it, and we won&apos;t import a trial balance with a hole in it.
              </p>
            </div>
          )}

          <button
            onClick={stage}
            disabled={busy || parsed.lines.length === 0}
            className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
          >
            {busy ? "…" : "Stage for review"}
          </button>
        </section>

        <section className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-left text-neutral-600">
              <tr>
                <th className="px-3 py-2">As at</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2 text-right">Accounts</th>
                <th className="px-3 py-2 text-right">Out by</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {batches.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-10 text-center text-sm text-neutral-500">
                    No opening balances imported. If this company traded before using us, its books don&apos;t
                    start at zero — bring them in above.
                  </td>
                </tr>
              )}
              {batches.map((b) => {
                const imb = b.summary?.imbalance ?? 0;
                return (
                  <tr key={b.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 tabular-nums">{b.as_of}</td>
                    <td className="px-3 py-2 text-neutral-600">{b.source ?? "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.summary?.line_count ?? 0}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.abs(Number(imb)) < 0.005 ? (
                        <span className="text-neutral-400">—</span>
                      ) : (
                        <span className="text-amber-700">{formatMoney(Math.abs(Number(imb)))}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          b.status === "posted"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-900"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      {b.status === "draft" && (
                        <button
                          onClick={() => post(b.id)}
                          disabled={busy || !openPeriod}
                          className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs text-white disabled:opacity-40"
                        >
                          Post to ledger
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}
