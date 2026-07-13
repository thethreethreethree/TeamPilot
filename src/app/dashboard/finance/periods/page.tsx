"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import { useToast } from "@/components/ui/toast";
import { Plus, Lock, LockOpen, CheckCircle2 } from "lucide-react";

type Period = { id: string; name: string; start_date: string; end_date: string; status: string };

export default function PeriodsPage() {
  const toast = useToast();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/finance/periods").then((x) => x.json());
      setPeriods(r.periods ?? []);
    } catch {
      toast.error("Couldn't load periods", "Check your connection and refresh.");
    }
  }, [toast]);
  useEffect(() => {
    void load();
  }, [load]);

  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const create = async () => {
    if (!name || !start || !end) {
      toast.error("Fill name, start, and end");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/finance/periods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate: start, endDate: end }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      setName("");
      setStart("");
      setEnd("");
      toast.success("Period created");
      void load();
    } else toast.error("Couldn't create period", j?.error ?? "");
  };

  const act = async (id: string, action: "close" | "reopen" | "lock") => {
    setBusy(true);
    const res = await fetch(`/api/finance/periods/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const j = await res.json();
    setBusy(false);
    if (res.ok) {
      toast.success(`Period ${action}d`);
      void load();
    } else toast.error(`Couldn't ${action}`, j?.error ?? "");
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Fiscal Periods" subtitle="Open, close, and lock accounting periods" />
      <FinanceNav />
      <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
        <p className="text-xs text-muted">
          Entries can only post into an OPEN period. Closing a period freezes it (corrections become
          reversing entries in an open period); locking is the year-end hard freeze (controller/CFO).
        </p>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">New period</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. 2027 or 2026-08)" className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="bg-surface rounded-lg px-2 py-2 text-sm text-primary border border-default" />
            <button onClick={create} disabled={busy} className="inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-brand text-black text-sm font-medium disabled:opacity-60">
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>
        </section>

        <section className="glass-card p-5">
          <h2 className="text-sm font-semibold text-primary mb-3">Periods</h2>
          {periods.length === 0 ? (
            <p className="text-xs text-muted">No periods yet — initialize finance to seed the current year.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-default text-muted text-xs uppercase tracking-wider">
                  <th className="text-left pb-2 pr-3">Name</th>
                  <th className="text-left pb-2 pr-3">Range</th>
                  <th className="text-left pb-2 pr-3">Status</th>
                  <th className="text-right pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {periods.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2 pr-3 text-primary">{p.name}</td>
                    <td className="py-2 pr-3 font-mono text-muted text-xs">{p.start_date} → {p.end_date}</td>
                    <td className="py-2 pr-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-surface-raised text-secondary">{p.status}</span>
                    </td>
                    <td className="py-2 text-right space-x-1">
                      {p.status === "open" && (
                        <button onClick={() => act(p.id, "close")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-amber-500/15 text-amber-300 disabled:opacity-60">
                          <CheckCircle2 className="w-3 h-3" /> Close
                        </button>
                      )}
                      {p.status === "closed" && (
                        <>
                          <button onClick={() => act(p.id, "reopen")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-surface-raised text-secondary disabled:opacity-60">
                            <LockOpen className="w-3 h-3" /> Reopen
                          </button>
                          <button onClick={() => act(p.id, "lock")} disabled={busy} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-red-500/15 text-red-300 disabled:opacity-60">
                            <Lock className="w-3 h-3" /> Lock
                          </button>
                        </>
                      )}
                      {p.status === "locked" && <span className="text-xs text-red-400 inline-flex items-center gap-1"><Lock className="w-3 h-3" /> Locked</span>}
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
