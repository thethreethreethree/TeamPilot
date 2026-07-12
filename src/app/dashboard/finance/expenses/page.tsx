"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { Plus, Send, CheckCircle2, DollarSign } from "lucide-react";

type Account = { id: string; code: string; name: string; type: string };
type Report = {
  id: string;
  title: string;
  status: string;
  employee_user_id: string;
  total?: number;
};
type ExpItem = { accountId: string; category: string; amount: string; taxAmount: string; description: string };
const money = formatMoney;

export default function ExpensesPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      fetch("/api/finance/accounts").then((x) => x.json()),
      fetch("/api/finance/expenses/reports").then((x) => x.json()),
    ]);
    setAccounts(a.accounts ?? []);
    setLoaded(true);
    setReports(r.reports ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const expenseAccounts = accounts.filter((a) => a.type === "expense");
  const [title, setTitle] = useState("");
  const [items, setItems] = useState<ExpItem[]>([{ accountId: "", category: "", amount: "", taxAmount: "", description: "" }]);
  const setItem = (i: number, patch: Partial<ExpItem>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addItem = () => setItems((xs) => [...xs, { accountId: "", category: "", amount: "", taxAmount: "", description: "" }]);
  const rmItem = (i: number) => setItems((xs) => (xs.length > 1 ? xs.filter((_, j) => j !== i) : xs));
  const itemsTotal = items.reduce((s, x) => s + (Number(x.amount) || 0) + (Number(x.taxAmount) || 0), 0);

  const create = async () => {
    const valid = items
      .filter((x) => x.accountId && x.amount)
      .map((x) => ({
        accountId: x.accountId,
        amount: Number(x.amount),
        taxAmount: Number(x.taxAmount) || 0,
        category: x.category || undefined,
        description: x.description || undefined,
      }));
    if (!title || valid.length === 0) {
      toast.error("Fill a title and at least one item (account + amount)");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/expenses/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, items: valid }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setItems([{ accountId: "", category: "", amount: "", taxAmount: "", description: "" }]);
      toast.success("Draft report created");
      void load();
    } else toast.error("Couldn't create report", j?.error ?? "");
  };

  const act = async (id: string, action: "submit" | "approve" | "reimburse") => {
    setBusy(true);
    const res = await fetch(`/api/finance/expenses/reports/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(
        action === "submit" ? "Submitted" : action === "approve" ? "Approved & posted" : "Reimbursed"
      );
      void load();
    } else toast.error(`Couldn't ${action}`, j?.error ?? "");
  };

  if (loaded && accounts.length === 0)
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Expenses" subtitle="Employee expense reports & reimbursement" />
        <FinanceNav />
        <FinanceNotSetUp feature="Expenses" />
      </div>
    );

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Expenses" subtitle="Employee expense reports & reimbursement" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          Submitting a report and approving it (by a DIFFERENT finance user — you can&apos;t approve
          your own) posts Dr expense / Cr Employee Reimbursements Payable; reimbursing posts Dr that
          payable / Cr Cash. Add one line per expense (account, category, amount, tax).
        </p>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">New expense report</h2>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Report title (e.g. Client trip — Berlin)" className="w-full mb-3 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
          <div className="space-y-2">
            <div className="hidden md:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted px-1">
              <span className="col-span-4">Expense account</span>
              <span className="col-span-3">Category</span>
              <span className="col-span-2">Description</span>
              <span className="col-span-1 text-right">Amount</span>
              <span className="col-span-1 text-right">Tax</span>
              <span className="col-span-1" />
            </div>
            {items.map((x, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select value={x.accountId} onChange={(e) => setItem(i, { accountId: e.target.value })} className="col-span-12 md:col-span-4 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
                  <option value="">Expense account…</option>
                  {expenseAccounts.map((a) => (<option key={a.id} value={a.id}>{a.code} {a.name}</option>))}
                </select>
                <input value={x.category} onChange={(e) => setItem(i, { category: e.target.value })} placeholder="Category" className="col-span-6 md:col-span-3 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
                <input value={x.description} onChange={(e) => setItem(i, { description: e.target.value })} placeholder="Note" className="col-span-6 md:col-span-2 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
                <input value={x.amount} onChange={(e) => setItem(i, { amount: e.target.value })} inputMode="decimal" placeholder="Amount" className="col-span-6 md:col-span-1 bg-surface rounded-lg px-2 py-2 text-sm text-right text-primary border border-default" />
                <input value={x.taxAmount} onChange={(e) => setItem(i, { taxAmount: e.target.value })} inputMode="decimal" placeholder="Tax" className="col-span-4 md:col-span-1 bg-surface rounded-lg px-2 py-2 text-sm text-right text-primary border border-default" />
                <button onClick={() => rmItem(i)} disabled={items.length === 1} title="Remove item" className="col-span-2 md:col-span-1 text-xs text-muted hover:text-red-400 disabled:opacity-30 py-1">✕</button>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3">
            <button onClick={addItem} className="text-xs text-brand hover:underline inline-flex items-center gap-1">
              <Plus className="w-3 h-3" /> Add item
            </button>
            <span className="text-xs text-muted">Total <span className="font-mono text-secondary">{money(itemsTotal)}</span></span>
          </div>
          <button onClick={create} disabled={busy} className="mt-3 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
            <Plus className="w-4 h-4" /> Create draft
          </button>
        </section>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Reports</h2>
          {reports.length === 0 ? (
            <p className="text-xs text-muted">No reports yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">Title</th>
                  <th className="text-right pb-2 pr-3">Amount</th>
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 text-primary">{r.title}</td>
                    <td className="py-2 pr-3 text-right font-mono text-secondary">{money(r.total ?? 0)}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary">{r.status}</span>
                    </td>
                    <td className="py-2 text-right space-x-1">
                      {r.status === "draft" && (
                        <button onClick={() => act(r.id, "submit")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand/20 text-brand disabled:opacity-60">
                          <Send className="w-3 h-3" /> Submit
                        </button>
                      )}
                      {r.status === "submitted" && (
                        <button onClick={() => act(r.id, "approve")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-emerald-500/15 text-emerald-300 disabled:opacity-60">
                          <CheckCircle2 className="w-3 h-3" /> Approve
                        </button>
                      )}
                      {r.status === "approved" && (
                        <button onClick={() => act(r.id, "reimburse")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-brand/20 text-brand disabled:opacity-60">
                          <DollarSign className="w-3 h-3" /> Reimburse
                        </button>
                      )}
                      {r.status === "reimbursed" && <span className="text-xs text-emerald-400">Reimbursed</span>}
                      {r.status === "rejected" && <span className="text-xs text-red-400">Rejected</span>}
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
