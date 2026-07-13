"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Plus, Upload, Wand2, Landmark } from "lucide-react";

type Account = { id: string; code: string; name: string; type: string };
type BankAccount = {
  id: string;
  name: string;
  institution: string | null;
  mask: string | null;
  gl_account_id: string;
  gl_balance: number;
  unmatched_count: number;
};
type Txn = {
  id: string;
  txn_date: string;
  amount: number;
  description: string | null;
  status: string;
};
const money = formatMoney;

// Minimal CSV parse: header row maps columns by name (date/amount/description/id|reference). Handles
// simple double-quoted fields. Returns rows the import API accepts.
function parseCsv(text: string): { txnDate: string; amount: number; description?: string; externalId?: string }[] {
  const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];
  const splitLine = (l: string) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < l.length; i++) {
      const c = l[i];
      if (q) {
        if (c === '"' && l[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === ",") { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = splitLine(lines[0]!).map((h) => h.toLowerCase());
  const iDate = header.findIndex((h) => h.includes("date"));
  const iAmt = header.findIndex((h) => h.includes("amount") || h.includes("value"));
  const iDesc = header.findIndex((h) => h.includes("desc") || h.includes("memo") || h.includes("payee") || h.includes("narrative"));
  const iId = header.findIndex((h) => h === "id" || h.includes("reference") || h.includes("ref") || h.includes("transaction id"));
  const rows: { txnDate: string; amount: number; description?: string; externalId?: string }[] = [];
  for (let r = 1; r < lines.length; r++) {
    const cols = splitLine(lines[r]!);
    const rawDate = (cols[iDate] ?? "").slice(0, 10);
    const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : toIso(rawDate);
    const amount = Number((cols[iAmt] ?? "").replace(/[$,]/g, ""));
    if (!date || !Number.isFinite(amount)) continue;
    rows.push({
      txnDate: date,
      amount,
      description: iDesc >= 0 ? cols[iDesc] || undefined : undefined,
      externalId: iId >= 0 ? cols[iId] || undefined : undefined,
    });
  }
  return rows;
}
// Accept MM/DD/YYYY or DD/MM/YYYY-ish → ISO (best-effort; ambiguous locales fall back to as-typed).
function toIso(s: string): string {
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return "";
  const [, a, b, y] = m;
  const mm = String(a).padStart(2, "0");
  const dd = String(b).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

export default function BankingPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([
        fetch("/api/finance/accounts").then((r) => r.json()),
        fetch("/api/finance/bank/accounts").then((r) => r.json()),
      ]);
      setAccounts(a.accounts ?? []);
      setBanks(b.accounts ?? []);
    } catch {
      toast.error("Couldn't load banking", "Check your connection and refresh.");
    } finally {
      setLoaded(true);
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const loadTxns = useCallback(async (bankId: string) => {
    const r = await fetch(`/api/finance/bank/accounts/${bankId}/transactions`).then((x) => x.json());
    setTxns(r.transactions ?? []);
  }, []);
  useEffect(() => {
    if (sel) void loadTxns(sel);
    else setTxns([]);
  }, [sel, loadTxns]);

  // Cash-like GL accounts to link (asset type; the 1000-range).
  const cashAccounts = accounts.filter((a) => a.type === "asset");

  const [nName, setNName] = useState("");
  const [nInst, setNInst] = useState("");
  const [nMask, setNMask] = useState("");
  const [nGl, setNGl] = useState("");
  const createBank = async () => {
    if (!nName || !nGl) {
      toast.error("Give the account a name and pick its cash GL account");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/bank/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nName, institution: nInst || undefined, mask: nMask || undefined, glAccountId: nGl }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setNName(""); setNInst(""); setNMask("");
      toast.success("Bank account added");
      void load();
    } else toast.error("Couldn't add bank account", j?.error ?? "");
  };

  const onFile = async (bankId: string, file: File) => {
    const text = await file.text();
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("No rows parsed", "Expected a CSV with date + amount columns (and a header row).");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/finance/bank/accounts/${bankId}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(`Imported ${j.imported} of ${j.submitted} rows`, j.imported < j.submitted ? "Duplicates skipped." : undefined);
      void load();
      void loadTxns(bankId);
    } else toast.error("Import failed", j?.error ?? "");
  };

  const autoMatch = async (bankId: string) => {
    setBusy(true);
    const res = await fetch(`/api/finance/bank/accounts/${bankId}/automatch`, { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(`Auto-matched ${j.matched} transaction${j.matched === 1 ? "" : "s"}`, "Equal amount, within ±3 days, single candidate.");
      void load();
      void loadTxns(bankId);
    } else toast.error("Auto-match failed", j?.error ?? "");
  };

  const ignore = async (txnId: string, bankId: string) => {
    setBusy(true);
    const res = await fetch(`/api/finance/bank/transactions/${txnId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ignore" }),
    });
    setBusy(false);
    if (res.ok) { void load(); void loadTxns(bankId); }
    else toast.error("Couldn't ignore");
  };

  if (loaded && accounts.length === 0)
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Banking & Reconciliation" subtitle="Bank accounts, statement import, reconcile to the ledger" />
        <FinanceNav />
        <FinanceNotSetUp feature="Banking" />
      </div>
    );

  const acctLabel = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} ${a.name}` : id.slice(0, 8);
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Banking & Reconciliation" subtitle="Bank accounts, statement import, reconcile to the ledger" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          The ledger stays the source of truth. Import a bank/card statement (CSV), then auto-match its
          lines to your posted cash entries (equal amount, within ±3 days). Anything unmatched is
          surfaced here — it means the bank and the books disagree, not that a figure is hidden.
        </p>

        {/* Bank accounts + positions */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Bank accounts</h2>
          {banks.length === 0 ? (
            <p className="text-xs text-muted mb-3">No bank accounts yet. Add one and link it to a cash GL account.</p>
          ) : (
            <div className="space-y-2 mb-4">
              {banks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSel(sel === b.id ? null : b.id)}
                  className={`w-full text-left glass-card p-3 flex items-center justify-between hover:border-brand/40 transition-colors ${sel === b.id ? "border-brand" : ""}`}
                >
                  <span className="flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-brand" />
                    <span>
                      <span className="text-sm text-primary">{b.name}</span>
                      <span className="text-[11px] text-muted ml-2">{b.institution ?? ""}{b.mask ? ` ••${b.mask}` : ""} · {acctLabel(b.gl_account_id)}</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="text-sm font-mono text-secondary">{money(b.gl_balance)}</span>
                    {b.unmatched_count > 0 && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300">{b.unmatched_count} unmatched</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          )}
          {/* Add bank account */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <input value={nName} onChange={(e) => setNName(e.target.value)} placeholder="Account name" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input value={nInst} onChange={(e) => setNInst(e.target.value)} placeholder="Institution" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input value={nMask} onChange={(e) => setNMask(e.target.value)} placeholder="Last 4" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <select value={nGl} onChange={(e) => setNGl(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Cash GL account…</option>
              {cashAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} {a.name}</option>))}
            </select>
            <button onClick={createBank} disabled={busy} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </section>

        {/* Selected account: import + reconcile */}
        {sel && (
          <section className="glass-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-primary">Reconcile — {banks.find((b) => b.id === sel)?.name}</h2>
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-surface-raised text-secondary hover:text-primary cursor-pointer">
                  <Upload className="w-3.5 h-3.5" /> Import CSV
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(sel, f); e.target.value = ""; }} />
                </label>
                <button onClick={() => autoMatch(sel)} disabled={busy} className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-brand/20 text-brand disabled:opacity-60">
                  <Wand2 className="w-3.5 h-3.5" /> Auto-match
                </button>
              </div>
            </div>
            {txns.length === 0 ? (
              <p className="text-xs text-muted">No transactions imported yet. Import a CSV statement to start.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                    <th className="text-left pb-2 pr-3">Date</th>
                    <th className="text-left pb-2 pr-3">Description</th>
                    <th className="text-right pb-2 pr-3">Amount</th>
                    <th className="text-left pb-2 pr-3">Status</th>
                    <th className="text-right pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-default">
                  {txns.map((t) => (
                    <tr key={t.id}>
                      <td className="py-2 pr-3 font-mono text-muted text-xs">{t.txn_date}</td>
                      <td className="py-2 pr-3 text-secondary">{t.description ?? "—"}</td>
                      <td className={`py-2 pr-3 text-right font-mono ${t.amount >= 0 ? "text-emerald-400" : "text-secondary"}`}>{money(t.amount)}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${t.status === "matched" ? "bg-emerald-500/15 text-emerald-300" : t.status === "ignored" ? "bg-surface-raised text-muted" : "bg-amber-500/15 text-amber-300"}`}>{t.status}</span>
                      </td>
                      <td className="py-2 text-right">
                        {t.status === "unmatched" && (
                          <button onClick={() => ignore(t.id, sel)} disabled={busy} className="text-xs text-muted hover:text-secondary disabled:opacity-60">Ignore</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
