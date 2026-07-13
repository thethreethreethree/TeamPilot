"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney, computeLineTax, parseMoneyInput } from "@/lib/finance/format";
import { todayIso } from "@/lib/finance/dateRange";
import { useToast } from "@/components/ui/toast";
import { Plus, CheckCircle2, DollarSign } from "lucide-react";

type Vendor = { id: string; name: string };
type Account = { id: string; code: string; name: string; type: string };
type Bill = {
  id: string;
  vendor_id: string;
  bill_number: string;
  bill_date: string;
  status: string;
  total?: number;
  paid?: number;
};
type Aging = { current: number; d1_30: number; d31_60: number; d61_90: number; d90_plus: number; total: number };
type BillLine = { accountId: string; amount: string; taxAmount: string; description: string; costCenterId: string; projectId: string; taxCodeId: string };
type Dim = { id: string; code: string; name: string };
type TaxCode = { id: string; code: string; name: string; rate_pct: number; direction: string };
type Dup = { bill_id: string; vendor_name: string; bill_number: string; bill_date: string; status: string; total: number; other_bill_number: string; other_bill_date: string; other_status: string; days_apart: number };
const money = formatMoney;

export default function ApPage() {
  const toast = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [busy, setBusy] = useState(false);
  const [openBill, setOpenBill] = useState<string | null>(null);
  const [billLines, setBillLines] = useState<Record<string, { line_no: number; account_id: string; amount: number; tax_amount: number }[]>>({});
  const [aging, setAging] = useState<Aging | null>(null);
  const [dups, setDups] = useState<Dup[]>([]);
  const [costCenters, setCostCenters] = useState<Dim[]>([]);
  const [projects, setProjects] = useState<Dim[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [loaded, setLoaded] = useState(false);

  const acctName = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} ${a.name}` : id.slice(0, 8);
  };
  const toggleBill = async (id: string) => {
    if (openBill === id) return setOpenBill(null);
    setOpenBill(id);
    if (!billLines[id]) {
      const r = await fetch(`/api/finance/ap/bills/${id}`).then((x) => x.json());
      setBillLines((m) => ({ ...m, [id]: r.lines ?? [] }));
    }
  };

  const load = useCallback(async () => {
    try {
      const [v, a, b, g, d, dim, tx] = await Promise.all([
        fetch("/api/finance/ap/vendors").then((r) => r.json()),
        fetch("/api/finance/accounts").then((r) => r.json()),
        fetch("/api/finance/ap/bills").then((r) => r.json()),
        fetch("/api/finance/ap/aging").then((r) => r.json()),
        fetch("/api/finance/ap/duplicates").then((r) => r.json()),
        fetch("/api/finance/dimensions").then((r) => r.json()),
        fetch("/api/finance/tax-codes").then((r) => r.json()),
      ]);
      setVendors(v.vendors ?? []);
      setAccounts(a.accounts ?? []);
      setBills(b.bills ?? []);
      setAging(g.aging ?? null);
      setDups(d.duplicates ?? []);
      setCostCenters(dim.costCenters ?? []);
      setProjects(dim.projects ?? []);
      setTaxCodes((tx.taxCodes ?? []).filter((t: TaxCode) => t.direction === "input"));
    } catch {
      toast.error("Couldn't load payables", "Check your connection and refresh.");
    } finally {
      setLoaded(true);
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  // new vendor
  const [vName, setVName] = useState("");
  const addVendor = async () => {
    if (!vName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/finance/ap/vendors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: vName.trim() }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setVName("");
      toast.success("Vendor added");
      void load();
    } else toast.error("Couldn't add vendor", j?.error ?? "");
  };

  // new bill (single line, minimal). A bill line is normally an expense; capital purchases hit a
  // fixed-asset account. Exclude Cash / AR / Tax-Receivable (1000/1100/1200) — picking those as a
  // bill line makes a nonsensical entry. (Prevents a real user error; the API accepts any account.)
  const expenseAccounts = accounts.filter(
    (a) => a.type === "expense" || (a.type === "asset" && !["1000", "1100", "1200"].includes(a.code))
  );
  const [bVendor, setBVendor] = useState("");
  const [bNumber, setBNumber] = useState("");
  const [bDate, setBDate] = useState("");
  const [bLines, setBLines] = useState<BillLine[]>([{ accountId: "", amount: "", taxAmount: "", description: "", costCenterId: "", projectId: "", taxCodeId: "" }]);
  const setBLine = (i: number, patch: Partial<BillLine>) =>
    setBLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  // Applies the patch, then auto-computes tax from the selected tax code's rate (overridable after).
  const setBLineTaxed = (i: number, patch: Partial<BillLine>) =>
    setBLines((ls) => ls.map((l, j) => {
      if (j !== i) return l;
      const m = { ...l, ...patch };
      if (m.taxCodeId) {
        const rate = taxCodes.find((t) => t.id === m.taxCodeId)?.rate_pct ?? 0;
        m.taxAmount = computeLineTax(m.amount, rate);
      }
      return m;
    }));
  const addBLine = () => setBLines((ls) => [...ls, { accountId: "", amount: "", taxAmount: "", description: "", costCenterId: "", projectId: "", taxCodeId: "" }]);
  const rmBLine = (i: number) => setBLines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls));
  const bTotal = bLines.reduce((s, l) => s + (parseMoneyInput(l.amount) || 0) + (parseMoneyInput(l.taxAmount) || 0), 0);
  const addBill = async () => {
    const validLines = bLines
      .filter((l) => l.accountId && l.amount)
      .map((l) => ({
        accountId: l.accountId,
        amount: parseMoneyInput(l.amount),
        taxAmount: parseMoneyInput(l.taxAmount) || 0,
        description: l.description || undefined,
        costCenterId: l.costCenterId || undefined,
        projectId: l.projectId || undefined,
        taxCodeId: l.taxCodeId || undefined,
      }));
    if (!bVendor || !bNumber || !bDate || validLines.length === 0) {
      toast.error("Fill vendor, number, date, and at least one line (account + amount)");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/ap/bills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId: bVendor, billNumber: bNumber, billDate: bDate, lines: validLines }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setBNumber("");
      setBLines([{ accountId: "", amount: "", taxAmount: "", description: "", costCenterId: "", projectId: "", taxCodeId: "" }]);
      toast.success("Draft bill created");
      void load();
    } else toast.error("Couldn't create bill", j?.error ?? "");
  };

  const act = async (billId: string, action: "approve" | "pay", amount?: number) => {
    setBusy(true);
    const url = `/api/finance/ap/bills/${billId}/${action}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:
        action === "pay"
          ? JSON.stringify({ amount, paymentDate: todayIso() })
          : undefined,
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(action === "approve" ? "Approved & posted to the ledger" : "Paid");
      void load();
    } else toast.error(`Couldn't ${action}`, j?.error ?? "");
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Accounts Payable" subtitle="Vendors, bills, approvals & payments" />
      <FinanceNav />
      {loaded && accounts.length === 0 ? (
        <FinanceNotSetUp feature="Accounts Payable" />
      ) : (
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          Functional first pass. Creating a bill and approving it posts a real double-entry journal
          entry (Dr expense / Cr Accounts Payable); paying posts Dr AP / Cr Cash. Single line + no
          tax here yet — the API supports multi-line + tax; a fuller UI is a follow-up.
        </p>

        {dups.length > 0 && (
          <section className="glass-card p-5 border-amber-500/30">
            <h2 className="text-sm font-semibold text-amber-300 mb-1">Possible duplicate bills ({dups.length})</h2>
            <p className="text-[11px] text-muted mb-3">Same vendor + same amount, within 7 days — the classic double-pay. Review before approving/paying; this is a prompt, not a verdict.</p>
            <div className="space-y-1.5">
              {dups.map((d) => (
                <div key={d.bill_id} className="flex items-center justify-between text-xs">
                  <span className="text-secondary">
                    <span className="text-primary">{d.vendor_name}</span> · {money(d.total)} —{" "}
                    <span className="font-mono">{d.bill_number}</span> ({d.bill_date}, {d.status}) vs{" "}
                    <span className="font-mono">{d.other_bill_number}</span> ({d.other_bill_date}, {d.other_status})
                  </span>
                  <span className="text-muted">{d.days_apart}d apart</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {aging && aging.total > 0 && (
          <section className="glass-card p-5">
            <h2 className="text-sm font-semibold text-primary mb-3">Aging — what you owe (by due date)</h2>
            <div className="grid grid-cols-3 md:grid-cols-6 gap-2 text-center">
              {[
                { label: "Current", v: aging.current },
                { label: "1–30", v: aging.d1_30 },
                { label: "31–60", v: aging.d31_60 },
                { label: "61–90", v: aging.d61_90 },
                { label: "90+", v: aging.d90_plus, warn: true },
                { label: "Total", v: aging.total, bold: true },
              ].map((b) => (
                <div key={b.label} className="rounded-lg bg-surface-raised p-2">
                  <p className="text-[10px] text-muted uppercase tracking-wider">{b.label}</p>
                  <p className={`text-sm font-mono ${b.warn && b.v > 0 ? "text-red-400" : b.bold ? "text-primary font-semibold" : "text-secondary"}`}>{money(b.v)}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Vendors */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Vendors</h2>
          <div className="flex gap-2 mb-3">
            <input
              value={vName}
              onChange={(e) => setVName(e.target.value)}
              placeholder="Vendor name"
              className="flex-1 bg-surface rounded-lg px-3 py-2 text-sm text-primary border border-default"
            />
            <button
              onClick={addVendor}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {vendors.map((v) => (
              <span key={v.id} className="text-xs px-2 py-1 rounded-full bg-surface-raised text-secondary">
                {v.name}
              </span>
            ))}
            {vendors.length === 0 && <span className="text-xs text-muted">No vendors yet.</span>}
          </div>
        </section>

        {/* New bill — multi-line + tax (the API/RPC support it; this surfaces it). */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">New bill</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <select value={bVendor} onChange={(e) => setBVendor(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Vendor…</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
            <input value={bNumber} onChange={(e) => setBNumber(e.target.value)} placeholder="Bill #" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input type="date" value={bDate} onChange={(e) => setBDate(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
          </div>
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted px-1">
              <span className="col-span-4">Account</span>
              <span className="col-span-4">Description</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-1 text-right">Tax</span>
              <span className="col-span-1" />
            </div>
            {bLines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select value={l.accountId} onChange={(e) => setBLine(i, { accountId: e.target.value })} className="col-span-12 md:col-span-4 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
                  <option value="">Account…</option>
                  {expenseAccounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.code} {a.name}</option>
                  ))}
                </select>
                <input value={l.description} onChange={(e) => setBLine(i, { description: e.target.value })} placeholder="Description" className="col-span-7 md:col-span-4 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
                <input value={l.amount} onChange={(e) => setBLineTaxed(i, { amount: e.target.value })} inputMode="decimal" placeholder="Amount" className="col-span-3 md:col-span-2 bg-surface rounded-lg px-2 py-2 text-sm text-right text-primary border border-default" />
                <input value={l.taxAmount} onChange={(e) => setBLine(i, { taxAmount: e.target.value })} inputMode="decimal" placeholder="Tax" className="col-span-2 md:col-span-1 bg-surface rounded-lg px-2 py-2 text-sm text-right text-primary border border-default" />
                <button onClick={() => rmBLine(i)} disabled={bLines.length === 1} title="Remove line" className="col-span-12 md:col-span-1 text-xs text-muted hover:text-red-400 disabled:opacity-30 py-1">✕</button>
                {(costCenters.length > 0 || projects.length > 0 || taxCodes.length > 0) && (
                  <div className="col-span-12 flex flex-wrap gap-2 pl-1">
                    {costCenters.length > 0 && (
                      <select value={l.costCenterId} onChange={(e) => setBLine(i, { costCenterId: e.target.value })} className="text-xs bg-surface rounded px-2 py-1 text-muted border border-default">
                        <option value="">Cost center…</option>
                        {costCenters.map((c) => (<option key={c.id} value={c.id}>{c.code} {c.name}</option>))}
                      </select>
                    )}
                    {projects.length > 0 && (
                      <select value={l.projectId} onChange={(e) => setBLine(i, { projectId: e.target.value })} className="text-xs bg-surface rounded px-2 py-1 text-muted border border-default">
                        <option value="">Project…</option>
                        {projects.map((p) => (<option key={p.id} value={p.id}>{p.code} {p.name}</option>))}
                      </select>
                    )}
                    {taxCodes.length > 0 && (
                      <select value={l.taxCodeId} onChange={(e) => setBLineTaxed(i, { taxCodeId: e.target.value })} className="text-xs bg-surface rounded px-2 py-1 text-muted border border-default">
                        <option value="">Tax code…</option>
                        {taxCodes.map((t) => (<option key={t.id} value={t.id}>{t.code} ({t.rate_pct}%)</option>))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <button onClick={addBLine} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add line
            </button>
            <span className="text-xs text-muted">Total <span className="font-mono text-secondary">{money(bTotal)}</span></span>
          </div>
          <button onClick={addBill} disabled={busy} className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
            <Plus className="w-4 h-4" /> Create draft bill
          </button>
        </section>

        {/* Bills */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Bills</h2>
          {bills.length === 0 ? (
            <p className="text-xs text-muted">No bills yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">Bill #</th>
                  <th className="text-left pb-2 pr-3">Date</th>
                  <th className="text-right pb-2 pr-3">Amount</th>
                  <th className="text-right pb-2 pr-3">Outstanding</th>
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {bills.map((b) => {
                  const bl = billLines[b.id];
                  return (
                  <Fragment key={b.id}>
                  <tr>
                    <td className="py-2 pr-3">
                      <button onClick={() => toggleBill(b.id)} className="text-primary hover:underline">{b.bill_number}</button>
                    </td>
                    <td className="py-2 pr-3 font-mono text-muted text-xs">{b.bill_date}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money(b.total ?? 0)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money((b.total ?? 0) - (b.paid ?? 0))}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary">{b.status}</span>
                    </td>
                    <td className="py-2 text-right">
                      {b.status === "draft" && (
                        <button onClick={() => act(b.id, "approve")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 disabled:opacity-60">
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {b.status === "approved" && (
                        <PayButton
                          defaultAmount={Math.max(0, (b.total ?? 0) - (b.paid ?? 0))}
                          onPay={(amt) => act(b.id, "pay", amt)}
                          disabled={busy}
                        />
                      )}
                      {b.status === "paid" && <span className="text-xs text-emerald-400">Paid</span>}
                    </td>
                  </tr>
                  {openBill === b.id && (
                    <tr>
                      <td colSpan={6} className="bg-surface/50 px-3 py-2">
                        {!bl ? (
                          <span className="text-xs text-muted">Loading…</span>
                        ) : bl.length === 0 ? (
                          <span className="text-xs text-muted">No lines.</span>
                        ) : (
                          <table className="w-full text-xs">
                            <tbody>
                              {bl.map((l) => (
                                <tr key={l.line_no}>
                                  <td className="py-0.5 text-secondary">{acctName(l.account_id)}</td>
                                  <td className="py-0.5 text-right font-mono text-secondary">{money(l.amount)}</td>
                                  <td className="py-0.5 text-right font-mono text-muted">tax {money(l.tax_amount)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      </div>
      )}
    </div>
  );
}

// Pre-fills the outstanding balance so paying-in-full (the common case) is one click; the user can
// still edit the field down for a partial payment. Saves eyeballing the Outstanding column + retyping.
function PayButton({ defaultAmount, onPay, disabled }: { defaultAmount: number; onPay: (amount: number) => void; disabled: boolean }) {
  // toFixed(2) (not Math.floor(defaultAmount*100)/100 — that is float-buggy: 0.29*100 = 28.9999… →
  // floor 28 → wrong $0.28). For realistic 2-decimal money toFixed is exact; the server's over-pay
  // guard + Zod still backstop the (rare) 3-4dp round-up case.
  const [amt, setAmt] = useState(defaultAmount > 0 ? defaultAmount.toFixed(2) : "");
  return (
    <span className="inline-flex items-center gap-1">
      <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="Amt" className="w-16 bg-surface rounded px-1.5 py-1 text-xs text-primary border border-default" />
      <button onClick={() => onPay(Number(amt))} disabled={disabled || !amt} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand/20 text-brand disabled:opacity-60">
        <DollarSign className="w-3 h-3" /> Pay
      </button>
    </span>
  );
}
