"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import { Plus, Send, DollarSign } from "lucide-react";

type Customer = { id: string; name: string };
type Account = { id: string; code: string; name: string; type: string };
type Invoice = { id: string; invoice_number: string; invoice_date: string; status: string };

export default function ArPage() {
  const toast = useToast();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [c, a, i] = await Promise.all([
      fetch("/api/finance/ar/customers").then((r) => r.json()),
      fetch("/api/finance/accounts").then((r) => r.json()),
      fetch("/api/finance/ar/invoices").then((r) => r.json()),
    ]);
    setCustomers(c.customers ?? []);
    setAccounts(a.accounts ?? []);
    setInvoices(i.invoices ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const revenueAccounts = accounts.filter((a) => a.type === "revenue");
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
  const [iAcct, setIAcct] = useState("");
  const [iAmt, setIAmt] = useState("");
  const addInvoice = async () => {
    if (!iCust || !iNum || !iDate || !iAcct || !iAmt) {
      toast.error("Fill customer, number, date, account, and amount");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/ar/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerId: iCust,
        invoiceNumber: iNum,
        invoiceDate: iDate,
        lines: [{ revenueAccountId: iAcct, amount: Number(iAmt) }],
      }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setINum("");
      setIAmt("");
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

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Accounts Receivable" subtitle="Customers, invoices & receipts" />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          Issuing an invoice posts Dr Accounts Receivable / Cr Revenue; recording a payment posts Dr
          Cash / Cr AR. Note: you can&apos;t issue an invoice you created (segregation of duties) — a
          second finance user issues it. Single line + no tax here yet.
        </p>

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
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <select value={iCust} onChange={(e) => setICust(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Customer…</option>
              {customers.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
            <input value={iNum} onChange={(e) => setINum(e.target.value)} placeholder="Invoice #" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input type="date" value={iDate} onChange={(e) => setIDate(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <select value={iAcct} onChange={(e) => setIAcct(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Revenue account…</option>
              {revenueAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} {a.name}</option>))}
            </select>
            <input value={iAmt} onChange={(e) => setIAmt(e.target.value)} inputMode="decimal" placeholder="Amount" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
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
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="py-2 pr-3 text-primary">{inv.invoice_number}</td>
                    <td className="py-2 pr-3 font-mono text-muted text-xs">{inv.invoice_date}</td>
                    <td className="py-2 pr-3"><span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary">{inv.status}</span></td>
                    <td className="py-2 text-right">
                      {inv.status === "draft" && (
                        <button onClick={() => act(inv.id, "issue")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 disabled:opacity-60">
                          <Send className="w-3 h-3" /> Issue
                        </button>
                      )}
                      {inv.status === "sent" && <ReceiptButton onReceipt={(amt) => act(inv.id, "receipt", amt)} disabled={busy} />}
                      {inv.status === "paid" && <span className="text-xs text-emerald-400">Paid</span>}
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

function ReceiptButton({ onReceipt, disabled }: { onReceipt: (amount: number) => void; disabled: boolean }) {
  const [amt, setAmt] = useState("");
  return (
    <span className="inline-flex items-center gap-1">
      <input value={amt} onChange={(e) => setAmt(e.target.value)} inputMode="decimal" placeholder="Amt" className="w-16 bg-surface rounded px-1.5 py-1 text-xs text-primary border border-default" />
      <button onClick={() => onReceipt(Number(amt))} disabled={disabled || !amt} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand/20 text-brand disabled:opacity-60">
        <DollarSign className="w-3 h-3" /> Receive
      </button>
    </span>
  );
}
