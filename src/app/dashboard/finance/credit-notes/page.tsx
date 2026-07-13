"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Plus, CheckCircle2 } from "lucide-react";

type Customer = { id: string; name: string };
type Invoice = { id: string; invoice_number: string; customer_id: string; status: string };
type CreditNote = {
  id: string;
  credit_number: string;
  credit_date: string;
  invoice_id: string;
  status: string;
  reason: string | null;
  total?: number;
};

const money = formatMoney;

export default function CreditNotesPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [notes, setNotes] = useState<CreditNote[]>([]);
  const [accountsCount, setAccountsCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const [cu, inv, cn, ac] = await Promise.all([
        fetch("/api/finance/ar/customers").then((r) => r.json()),
        fetch("/api/finance/ar/invoices").then((r) => r.json()),
        fetch("/api/finance/ar/credit-notes").then((r) => r.json()),
        fetch("/api/finance/accounts").then((r) => r.json()),
      ]);
      setCustomers(cu.customers ?? []);
      setInvoices(inv.invoices ?? []);
      setNotes(cn.creditNotes ?? []);
      setAccountsCount((ac.accounts ?? []).length);
    } catch {
      toast.error("Couldn't load credit notes", "Check your connection and refresh.");
    } finally {
      setLoaded(true);
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  // Only issued invoices ("sent") have a receivable to credit against.
  const creditableInvoices = invoices.filter((i) => i.status === "sent");
  const invLabel = (id: string) => invoices.find((i) => i.id === id)?.invoice_number ?? id.slice(0, 8);

  const [cCust, setCCust] = useState("");
  const [cInv, setCInv] = useState("");
  const [cNum, setCNum] = useState("");
  const [cDate, setCDate] = useState("");
  const [cReason, setCReason] = useState("");
  const [cAmount, setCAmount] = useState("");
  const create = async () => {
    if (!cCust || !cInv || !cNum || !cDate || !cAmount) {
      toast.error("Fill customer, invoice, number, date, and amount");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/ar/credit-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: cCust,
        invoiceId: cInv,
        creditNumber: cNum,
        creditDate: cDate,
        reason: cReason || undefined,
        lines: [{ amount: Number(cAmount), description: cReason || undefined }],
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setCNum("");
      setCAmount("");
      setCReason("");
      toast.success("Draft credit note created");
      void load();
    } else toast.error("Couldn't create credit note", j?.error ?? "");
  };

  const issue = async (id: string) => {
    setBusy(true);
    const res = await fetch(`/api/finance/ar/credit-notes/${id}/issue`, { method: "POST" });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success("Credit note issued & posted", "Dr Sales Returns / Cr Accounts Receivable");
      void load();
    } else toast.error("Couldn't issue", j?.error ?? "");
  };

  if (loaded && accountsCount === 0)
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Credit Notes" subtitle="Reduce an issued invoice — returns, over-billing, allowances" />
        <FinanceNav />
        <FinanceNotSetUp feature="Credit Notes" />
      </div>
    );

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Credit Notes" subtitle="Reduce an issued invoice — returns, over-billing, allowances" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          A credit note reduces what a customer owes on an <strong>issued</strong> invoice. Issuing it
          posts a real entry (Dr Sales Returns &amp; Allowances 4900 / Cr Accounts Receivable) and
          lowers the invoice&apos;s outstanding in Receivables + aging. Contra-revenue treatment keeps
          gross revenue visible. A credit can&apos;t exceed the invoice&apos;s outstanding, and (SoD)
          the person who created it can&apos;t issue it.
        </p>

        {/* New credit note */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">New credit note</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            <select value={cCust} onChange={(e) => setCCust(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select value={cInv} onChange={(e) => setCInv(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Invoice…</option>
              {creditableInvoices
                .filter((i) => !cCust || i.customer_id === cCust)
                .map((i) => (
                  <option key={i.id} value={i.id}>{i.invoice_number}</option>
                ))}
            </select>
            <input value={cNum} onChange={(e) => setCNum(e.target.value)} placeholder="Credit #" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input type="date" value={cDate} onChange={(e) => setCDate(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input value={cAmount} onChange={(e) => setCAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input value={cReason} onChange={(e) => setCReason(e.target.value)} placeholder="Reason (optional)" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
          </div>
          <button onClick={create} disabled={busy} className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
            <Plus className="w-4 h-4" /> Create draft credit note
          </button>
          {creditableInvoices.length === 0 && (
            <p className="text-[11px] text-muted mt-2">No issued invoices yet — a credit note applies to an invoice that&apos;s been issued (sent).</p>
          )}
        </section>

        {/* Credit notes list */}
        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Credit notes</h2>
          {notes.length === 0 ? (
            <p className="text-xs text-muted">No credit notes yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">Credit #</th>
                  <th className="text-left pb-2 pr-3">Date</th>
                  <th className="text-left pb-2 pr-3">Invoice</th>
                  <th className="text-right pb-2 pr-3">Amount</th>
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {notes.map((n) => (
                  <tr key={n.id}>
                    <td className="py-2 pr-3 text-primary">{n.credit_number}</td>
                    <td className="py-2 pr-3 font-mono text-muted text-xs">{n.credit_date}</td>
                    <td className="py-2 pr-3 text-secondary">{invLabel(n.invoice_id)}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money(n.total ?? 0)}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary">{n.status}</span>
                    </td>
                    <td className="py-2 text-right">
                      {n.status === "draft" && (
                        <button onClick={() => issue(n.id)} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 disabled:opacity-60">
                          <CheckCircle2 className="w-3 h-3" /> Issue
                        </button>
                      )}
                      {n.status === "issued" && <span className="text-xs text-emerald-400">Issued</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
