"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import { useToast } from "@/components/ui/toast";
import { Plus, Play, Power } from "lucide-react";

type Vendor = { id: string; name: string };
type Account = { id: string; code: string; name: string; type: string };
type Template = {
  id: string;
  vendor_id: string;
  description: string;
  account_id: string;
  amount: number;
  frequency: string;
  next_date: string;
  is_active: boolean;
};
const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

export default function RecurringPage() {
  const toast = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [v, a, t] = await Promise.all([
      fetch("/api/finance/ap/vendors").then((r) => r.json()),
      fetch("/api/finance/accounts").then((r) => r.json()),
      fetch("/api/finance/ap/recurring").then((r) => r.json()),
    ]);
    setVendors(v.vendors ?? []);
    setAccounts(a.accounts ?? []);
    setTemplates(t.templates ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const expenseAccounts = accounts.filter(
    (a) => a.type === "expense" || (a.type === "asset" && !["1000", "1100", "1200"].includes(a.code))
  );
  const [vendor, setVendor] = useState("");
  const [desc, setDesc] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [freq, setFreq] = useState("monthly");
  const [nextDate, setNextDate] = useState("");

  const create = async () => {
    if (!vendor || !desc || !account || !amount || !nextDate) {
      toast.error("Fill vendor, description, account, amount, and next date");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/ap/recurring", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vendorId: vendor, description: desc, accountId: account, amount: Number(amount), frequency: freq, nextDate }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setDesc("");
      setAmount("");
      toast.success("Recurring template created");
      void load();
    } else toast.error("Couldn't create template", j?.error ?? "");
  };

  const act = async (t: Template, action: "generate" | "toggle") => {
    setBusy(true);
    const res = await fetch(`/api/finance/ap/recurring/${t.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "toggle" ? { action, active: !t.is_active } : { action }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(action === "generate" ? "Draft bill generated (approve it on Payable)" : t.is_active ? "Paused" : "Resumed");
      void load();
    } else toast.error(`Couldn't ${action}`, j?.error ?? "");
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Recurring Bills" subtitle="Rent, subscriptions, utilities — templates that generate bills" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          A template generates a <strong>draft bill</strong> each period (then approve → post → pay on
          Payable). Use <strong>Generate now</strong> to create the next one manually; automatic
          generation runs when a scheduled job is wired (dormant until then).
        </p>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">New recurring template</h2>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            <select value={vendor} onChange={(e) => setVendor(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Vendor…</option>
              {vendors.map((v) => (<option key={v.id} value={v.id}>{v.name}</option>))}
            </select>
            <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" className="md:col-span-2 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Account…</option>
              {expenseAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} {a.name}</option>))}
            </select>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <select value={freq} onChange={(e) => setFreq(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              {["weekly", "monthly", "quarterly", "annual"].map((f) => (<option key={f} value={f}>{f}</option>))}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <label className="text-xs text-muted">Next date</label>
            <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <button onClick={create} disabled={busy} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Templates</h2>
          {templates.length === 0 ? (
            <p className="text-xs text-muted">No recurring templates yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">Description</th>
                  <th className="text-right pb-2 pr-3">Amount</th>
                  <th className="text-left pb-2 pr-3">Frequency</th>
                  <th className="text-left pb-2 pr-3">Next</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {templates.map((t) => (
                  <tr key={t.id} className={t.is_active ? "" : "opacity-50"}>
                    <td className="py-2 pr-3 text-primary">{t.description}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money(t.amount)}</td>
                    <td className="py-2 pr-3 text-secondary">{t.frequency}</td>
                    <td className="py-2 pr-3 font-mono text-muted text-xs">{t.next_date}</td>
                    <td className="py-2 text-right space-x-1">
                      {t.is_active && (
                        <button onClick={() => act(t, "generate")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand/20 text-brand disabled:opacity-60">
                          <Play className="w-3 h-3" /> Generate now
                        </button>
                      )}
                      <button onClick={() => act(t, "toggle")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-surface-raised text-secondary disabled:opacity-60">
                        <Power className="w-3 h-3" /> {t.is_active ? "Pause" : "Resume"}
                      </button>
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
