"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import { Plus, Send, CheckCircle2, DollarSign } from "lucide-react";

type Account = { id: string; code: string; name: string; type: string };
type Report = {
  id: string;
  title: string;
  status: string;
  employee_user_id: string;
};

export default function ExpensesPage() {
  const toast = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [a, r] = await Promise.all([
      fetch("/api/finance/accounts").then((x) => x.json()),
      fetch("/api/finance/expenses/reports").then((x) => x.json()),
    ]);
    setAccounts(a.accounts ?? []);
    setReports(r.reports ?? []);
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const expenseAccounts = accounts.filter((a) => a.type === "expense");
  const [title, setTitle] = useState("");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");

  const create = async () => {
    if (!title || !account || !amount) {
      toast.error("Fill title, account, and amount");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/expenses/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, items: [{ accountId: account, amount: Number(amount) }] }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setTitle("");
      setAmount("");
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

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Expenses" subtitle="Employee expense reports & reimbursement" />
      <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
        <p className="text-xs text-muted">
          Functional first pass. Submitting a report and approving it (by a DIFFERENT finance user —
          you can&apos;t approve your own) posts Dr expense / Cr Employee Reimbursements Payable;
          reimbursing posts Dr that payable / Cr Cash. Single item, no tax here yet.
        </p>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">New expense report</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Client trip)" className="md:col-span-2 bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <select value={account} onChange={(e) => setAccount(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default">
              <option value="">Expense account…</option>
              {expenseAccounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} {a.name}</option>
              ))}
            </select>
            <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="Amount" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
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
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-3 text-primary">{r.title}</td>
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
