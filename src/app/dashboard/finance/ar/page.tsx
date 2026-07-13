"use client";

import { useEffect, useState, useCallback, Fragment } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Plus, Send, DollarSign } from "lucide-react";

type Customer = { id: string; name: string };
type Account = { id: string; code: string; name: string; type: string };
type Invoice = { id: string; invoice_number: string; invoice_date: string; status: string; total?: number; received?: number };
type Aging = {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
};
type Overdue = { invoice_number: string; customer_name: string; outstanding: number; days_overdue: number };
type InvLine = { revenueAccountId: string; amount: string; taxAmount: string; description: string; costCenterId: string; projectId: string; taxCodeId: string };
type Dim = { id: string; code: string; name: string };
type TaxCode = { id: string; code: string; name: string; rate_pct: number; direction: string };
const money = formatMoney;

export default function ArPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [costCenters, setCostCenters] = useState<Dim[]>([]);
  const [projects, setProjects] = useState<Dim[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [aging, setAging] = useState<Aging | null>(null);
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [busy, setBusy] = useState(false);
  const [openInv, setOpenInv] = useState<string | null>(null);
  const [invLines, setInvLines] = useState<Record<string, { line_no: number; revenue_account_id: string; amount: number; tax_amount: number }[]>>({});

  const acctName = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? `${a.code} ${a.name}` : id.slice(0, 8);
  };
  const toggleInv = async (id: string) => {
    if (openInv === id) return setOpenInv(null);
    setOpenInv(id);
    if (!invLines[id]) {
      const r = await fetch(`/api/finance/ar/invoices/${id}`).then((x) => x.json());
      setInvLines((m) => ({ ...m, [id]: r.lines ?? [] }));
    }
  };

  const load = useCallback(async () => {
    try {
      const [c, a, i, g, o, dim, tx] = await Promise.all([
        fetch("/api/finance/ar/customers").then((r) => r.json()),
        fetch("/api/finance/accounts").then((r) => r.json()),
        fetch("/api/finance/ar/invoices").then((r) => r.json()),
        fetch("/api/finance/ar/aging").then((r) => r.json()),
        fetch("/api/finance/ar/collections").then((r) => r.json()),
        fetch("/api/finance/dimensions").then((r) => r.json()),
        fetch("/api/finance/tax-codes").then((r) => r.json()),
      ]);
      setCustomers(c.customers ?? []);
      setAccounts(a.accounts ?? []);
      setInvoices(i.invoices ?? []);
      setAging(g.aging ?? null);
      setOverdue(o.overdue ?? []);
      setCostCenters(dim.costCenters ?? []);
      setProjects(dim.projects ?? []);
      setTaxCodes((tx.taxCodes ?? []).filter((t: TaxCode) => t.direction === "output"));
    } catch {
      toast.error("Couldn't load receivables", "Check your connection and refresh.");
    } finally {
      setLoaded(true);
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const revenueAccounts = accounts.filter((a) => a.type === "revenue");
  // (InvLine declared at module scope below)
  const [cName, setCName] = useState("");
  const addCustomer = async () => {
    if (!cName.trim()) return;
    setBusy(true);
    const res = await fetch("/api/finance/ar/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: cName.trim() }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setCName("");
      toast.success("Customer added");
      void load();
    } else toast.error("Couldn't add customer", j?.error ?? "");
  };

  const [iCust, setICust] = useState("");
  const [iNum, setINum] = useState("");
  const [iDate, setIDate] = useState("");
  const [iLines, setILines] = useState<InvLine[]>([{ revenueAccountId: "", amount: "", taxAmount: "", description: "", costCenterId: "", projectId: "", taxCodeId: "" }]);
  const setILine = (i: number, patch: Partial<InvLine>) =>
    setILines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const setILineTaxed = (i: number, patch: Partial<InvLine>) =>
    setILines((ls) => ls.map((l, j) => {
      if (j !== i) return l;
      const m = { ...l, ...patch };
      if (m.taxCodeId) {
        const rate = taxCodes.find((t) => t.id === m.taxCodeId)?.rate_pct ?? 0;
        m.taxAmount = (((Number(m.amount) || 0) * Number(rate)) / 100).toFixed(2);
      }
      return m;
    }));
  const addILine = () => setILines((ls) => [...ls, { revenueAccountId: "", amount: "", taxAmount: "", description: "", costCenterId: "", projectId: "", taxCodeId: "" }]);
  const rmILine = (i: number) => setILines((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls));
  const iTotal = iLines.reduce((s, l) => s + (Number(l.amount) || 0) + (Number(l.taxAmount) || 0), 0);
  const addInvoice = async () => {
    const validLines = iLines
      .filter((l) => l.revenueAccountId && l.amount)
      .map((l) => ({
        revenueAccountId: l.revenueAccountId,
        amount: Number(l.amount),
        taxAmount: Number(l.taxAmount) || 0,
        description: l.description || undefined,
        costCenterId: l.costCenterId || undefined,
        projectId: l.projectId || undefined,
        taxCodeId: l.taxCodeId || undefined,
      }));
    if (!iCust || !iNum || !iDate || validLines.length === 0) {
      toast.error("Fill customer, number, date, and at least one line (account + amount)");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/ar/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId: iCust, invoiceNumber: iNum, invoiceDate: iDate, lines: validLines }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setINum("");
      setILines([{ revenueAccountId: "", amount: "", taxAmount: "", description: "", costCenterId: "", projectId: "", taxCodeId: "" }]);
      toast.success("Draft invoice created");
      void load();
    } else toast.error("Couldn't create invoice", j?.error ?? "");
  };

  const act = async (id: string, action: "issue" | "receipt", amount?: number) => {
    setBusy(true);
    const res = await fetch(`/api/finance/ar/invoices/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:
        action === "receipt"
          ? JSON.stringify({ amount, receiptDate: new Date().toISOString().slice(0, 10) })
          : undefined,
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(action === "issue" ? "Issued & posted to the ledger" : "Payment recorded");
      void load();
    } else toast.error(`Couldn't ${action}`, j?.error ?? "");
  };

  if (loaded && accounts.length === 0)
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Accounts Receivable" subtitle="Customers, invoices & receipts" />
        <FinanceNav />
        <FinanceNotSetUp feature="Accounts Receivable" />
      </div>
    );

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Accounts Receivable" subtitle="Customers, invoices & receipts" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          Issuing an invoice posts Dr Accounts Receivable / Cr Revenue; recording a payment posts Dr
          Cash / Cr AR. Note: you can&apos;t issue an invoice you created (segregation of duties) — a
          second finance user issues it. Single line + no tax here yet.
        </p>

        {aging && aging.total > 0 && (
          <section className="glass-card p-5">
            <h2 className="text-sm font-semibold text-primary mb-3">Aging — outstanding receivables</h2>
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

        {overdue.length > 0 && (
          <section className="glass-card p-5 border-red-500/20">
            <h2 className="text-sm font-semibold text-primary mb-3">Collections — overdue invoices</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">Invoice #</th>
                  <th className="text-left pb-2 pr-3">Customer</th>
                  <th className="text-right pb-2 pr-3">Outstanding</th>
                  <th className="text-right pb-2">Days overdue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {overdue.map((o) => (
                  <tr key={o.invoice_number}>
                    <td className="py-2 pr-3 text-primary">{o.invoice_number}</td>
                    <td className="py-2 pr-3 text-secondary">{o.customer_name}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money(o.outstanding)}</td>
                    <td className={`py-2 text-right font-mono ${o.days_overdue > 60 ? "text-red-400" : "text-amber-300"}`}>{o.days_overdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-muted mt-2">Follow-up worklist. Automated reminders (email) are an integration follow-up.</p>
          </section>
        )}

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Customers</h2>
          <div className="flex gap-2 mb-3">
            <input value={cName} onChange={(e) => setCName(e.target.value)} placeholder="Customer name" className="flex-1 bg-surface rounded-lg px-3 py-2 text-sm text-primary border border-default" />
            <button onClick={addCustomer} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {customers.map((c) => (
              <span key={c.id} className="text-xs px-2 py-1 rounded-full bg-surface-raised text-secondary">{c.name}</span>
            ))}
            {customers.length === 0 && <span className="text-xs text-muted">No customers yet.</span>}
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">New invoice</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-3">
            <select value={iCust} onChange={(e) => setICust(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Customer…</option>
              {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <input value={iNum} onChange={(e) => setINum(e.target.value)} placeholder="Invoice #" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input type="date" value={iDate} onChange={(e) => setIDate(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
          </div>
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted px-1">
              <span className="col-span-4">Revenue account</span>
              <span className="col-span-4">Description</span>
              <span className="col-span-2 text-right">Amount</span>
              <span className="col-span-1 text-right">Tax</span>
              <span className="col-span-1" />
            </div>
            {iLines.map((l, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select value={l.revenueAccountId} onChange={(e) => setILine(i, { revenueAccountId: e.target.value })} className="col-span-12 md:col-span-4 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
                  <option value="">Revenue account…</option>
                  {revenueAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} {a.name}</option>))}
                </select>
                <input value={l.description} onChange={(e) => setILine(i, { description: e.target.value })} placeholder="Description" className="col-span-7 md:col-span-4 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
                <input value={l.amount} onChange={(e) => setILineTaxed(i, { amount: e.target.value })} inputMode="decimal" placeholder="Amount" className="col-span-3 md:col-span-2 bg-surface rounded-lg px-2 py-2 text-sm text-right text-primary border border-default" />
                <input value={l.taxAmount} onChange={(e) => setILine(i, { taxAmount: e.target.value })} inputMode="decimal" placeholder="Tax" className="col-span-2 md:col-span-1 bg-surface rounded-lg px-2 py-2 text-sm text-right text-primary border border-default" />
                <button onClick={() => rmILine(i)} disabled={iLines.length === 1} title="Remove line" className="col-span-12 md:col-span-1 text-xs text-muted hover:text-red-400 disabled:opacity-30 py-1">✕</button>
                {(costCenters.length > 0 || projects.length > 0 || taxCodes.length > 0) && (
                  <div className="col-span-12 flex flex-wrap gap-2 pl-1">
                    {costCenters.length > 0 && (
                      <select value={l.costCenterId} onChange={(e) => setILine(i, { costCenterId: e.target.value })} className="text-xs bg-surface rounded px-2 py-1 text-muted border border-default">
                        <option value="">Cost center…</option>
                        {costCenters.map((c) => (<option key={c.id} value={c.id}>{c.code} {c.name}</option>))}
                      </select>
                    )}
                    {projects.length > 0 && (
                      <select value={l.projectId} onChange={(e) => setILine(i, { projectId: e.target.value })} className="text-xs bg-surface rounded px-2 py-1 text-muted border border-default">
                        <option value="">Project…</option>
                        {projects.map((p) => (<option key={p.id} value={p.id}>{p.code} {p.name}</option>))}
                      </select>
                    )}
                    {taxCodes.length > 0 && (
                      <select value={l.taxCodeId} onChange={(e) => setILineTaxed(i, { taxCodeId: e.target.value })} className="text-xs bg-surface rounded px-2 py-1 text-muted border border-default">
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
            <button onClick={addILine} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add line
            </button>
            <span className="text-xs text-muted">Total <span className="font-mono text-secondary">{money(iTotal)}</span></span>
          </div>
          <button onClick={addInvoice} disabled={busy} className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
            <Plus className="w-4 h-4" /> Create draft invoice
          </button>
        </section>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Invoices</h2>
          {invoices.length === 0 ? (
            <p className="text-xs text-muted">No invoices yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">Invoice #</th>
                  <th className="text-left pb-2 pr-3">Date</th>
                  <th className="text-right pb-2 pr-3">Amount</th>
                  <th className="text-right pb-2 pr-3">Outstanding</th>
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {invoices.map((inv) => {
                  const il = invLines[inv.id];
                  return (
                  <Fragment key={inv.id}>
                  <tr>
                    <td className="py-2 pr-3">
                      <button onClick={() => toggleInv(inv.id)} className="text-primary hover:underline">{inv.invoice_number}</button>
                    </td>
                    <td className="py-2 pr-3 font-mono text-muted text-xs">{inv.invoice_date}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money(inv.total ?? 0)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money((inv.total ?? 0) - (inv.received ?? 0))}</td>
                    <td className="py-2 pr-3"><span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary">{inv.status}</span></td>
                    <td className="py-2 text-right">
                      {inv.status === "draft" && (
                        <button onClick={() => act(inv.id, "issue")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 disabled:opacity-60">
                          <Send className="w-3 h-3" /> Issue
                        </button>
                      )}
                      {inv.status === "sent" && (
                        <ReceiptButton
                          defaultAmount={Math.max(0, (inv.total ?? 0) - (inv.received ?? 0))}
                          onReceipt={(amt) => act(inv.id, "receipt", amt)}
                          disabled={busy}
                        />
                      )}
                      {inv.status === "paid" && <span className="text-xs text-emerald-400">Paid</span>}
                    </td>
                  </tr>
                  {openInv === inv.id && (
                    <tr>
                      <td colSpan={6} className="bg-surface/50 px-3 py-2">
                        {!il ? (
                          <span className="text-xs text-muted">Loading…</span>
                        ) : il.length === 0 ? (
                          <span className="text-xs text-muted">No lines.</span>
                        ) : (
                          <table className="w-full text-xs">
                            <tbody>
                              {il.map((l) => (
                                <tr key={l.line_no}>
                                  <td className="py-0.5 text-secondary">{acctName(l.revenue_account_id)}</td>
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
    </div>
  );
}

// Pre-fills the outstanding balance so recording a full receipt (the common case) is one click; the
// user can still edit down for a partial receipt. Mirrors AP's PayButton for consistency.
function ReceiptButton({ defaultAmount, onReceipt, disabled }: { defaultAmount: number; onReceipt: (amount: number) => void; disabled: boolean }) {
  // toFixed(2) (not Math.floor(defaultAmount*100)/100 — that is float-buggy: 0.29*100 = 28.9999… →
  // floor 28 → wrong $0.28). For realistic 2-decimal money toFixed is exact; the server's
  // over-receipt guard + Zod still backstop the (rare) 3-4dp round-up case.
  const [amt, setAmt] = useState(defaultAmount > 0 ? defaultAmount.toFixed(2) : "");
  return (
    <span className="inline-flex items-center gap-1">
      <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="Amt" className="w-16 bg-surface rounded px-1.5 py-1 text-xs text-primary border border-default" />
      <button onClick={() => onReceipt(Number(amt))} disabled={disabled || !amt} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand/20 text-brand disabled:opacity-60">
        <DollarSign className="w-3 h-3" /> Receive
      </button>
    </span>
  );
}
