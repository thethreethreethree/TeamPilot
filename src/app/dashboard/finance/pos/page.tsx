"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import { useToast } from "@/components/ui/toast";
import { Plus, CheckCircle2, FileOutput } from "lucide-react";

type Vendor = { id: string; name: string };
type Account = { id: string; code: string; name: string; type: string };
type PO = { id: string; vendor_id: string; po_number: string; order_date: string; status: string };

export default function PosPage() {
  const toast = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pos, setPos] = useState<PO[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [v, a, p] = await Promise.all([
      fetch("/api/finance/ap/vendors").then((r) => r.json()),
      fetch("/api/finance/accounts").then((r) => r.json()),
      fetch("/api/finance/ap/pos").then((r) => r.json()),
    ]);
    setVendors(v.vendors ?? []);
    setAccounts(a.accounts ?? []);
    setPos(p.pos ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const expenseAccounts = accounts.filter(
    (a) => a.type === "expense" || (a.type === "asset" && !["1000", "1100", "1200"].includes(a.code))
  );
  const [vendor, setVendor] = useState("");
  const [num, setNum] = useState("");
  const [date, setDate] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");

  const create = async () => {
    if (!vendor || !num || !date || !account || !amount) {
      toast.error("Fill vendor, number, date, account, and amount");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/ap/pos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId: vendor, poNumber: num, orderDate: date, lines: [{ accountId: account, amount: Number(amount) }] }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setNum("");
      setAmount("");
      toast.success("Draft PO created");
      void load();
    } else toast.error("Couldn't create PO", j?.error ?? "");
  };

  const act = async (po: PO, action: "approve" | "convert") => {
    setBusy(true);
    const body =
      action === "convert"
        ? { action, billNumber: `BILL-${po.po_number}`, billDate: new Date().toISOString().slice(0, 10) }
        : { action };
    const res = await fetch(`/api/finance/ap/pos/${po.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(action === "approve" ? "PO approved" : "Converted to a draft bill (approve it on Payable)");
      void load();
    } else toast.error(`Couldn't ${action}`, j?.error ?? "");
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Purchase Orders" subtitle="Commitments to buy — convert to a bill when received" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          A PO is a commitment — it does <strong>not</strong> post to the ledger. Converting a PO
          creates a <strong>draft bill</strong> that then follows the normal approve → post → pay flow
          on Payable. Single line here; the API supports multi-line + tax.
        </p>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">New purchase order</h2>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <select value={vendor} onChange={(e) => setVendor(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Vendor…</option>
              {vendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
            <input value={num} onChange={(e) => setNum(e.target.value)} placeholder="PO #" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Account…</option>
              {expenseAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} {a.name}</option>))}
            </select>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
          </div>
          <button onClick={create} disabled={busy} className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
            <Plus className="w-4 h-4" /> Create draft PO
          </button>
        </section>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Purchase orders</h2>
          {pos.length === 0 ? (
            <p className="text-xs text-muted">No purchase orders yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">PO #</th>
                  <th className="text-left pb-2 pr-3">Date</th>
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {pos.map((po) => (
                  <tr key={po.id}>
                    <td className="py-2 pr-3 text-primary">{po.po_number}</td>
                    <td className="py-2 pr-3 font-mono text-muted text-xs">{po.order_date}</td>
                    <td className="py-2 pr-3"><span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary">{po.status}</span></td>
                    <td className="py-2 text-right space-x-1">
                      {po.status === "draft" && (
                        <button onClick={() => act(po, "approve")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 disabled:opacity-60">
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {(po.status === "draft" || po.status === "approved") && (
                        <button onClick={() => act(po, "convert")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand/20 text-brand disabled:opacity-60">
                          <FileOutput className="w-3 h-3" /> Convert to bill
                        </button>
                      )}
                      {po.status === "converted" && <span className="text-xs text-emerald-400">Converted</span>}
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
