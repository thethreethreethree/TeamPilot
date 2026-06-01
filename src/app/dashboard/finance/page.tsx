"use client";

import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import AwaitingEvidence from "@/components/ui/AwaitingEvidence";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  mockCompany,
  mockFinance,
  mockRevenueTrend,
  mockExpenses,
  mockInvoices,
} from "@/lib/mock-data";
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";

const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${(n / 1_000).toFixed(0)}K`;

const trendIcon = {
  up: <TrendingUp className="w-3 h-3 text-red-400" />,
  down: <TrendingDown className="w-3 h-3 text-emerald-400" />,
  flat: <Minus className="w-3 h-3 text-[#5a6399]" />,
};

export default function FinancePage() {
  const [aiDiagnosis, setAiDiagnosis] = useState("");
  const [loading, setLoading] = useState(false);

  const overdue = mockInvoices.filter((i) => i.status === "Overdue");
  const outstanding = mockInvoices
    .filter((i) => i.status !== "Paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const maxBar = Math.max(...mockRevenueTrend.map((m) => m.expenses));

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          finance: mockFinance,
          revenueTrend: mockRevenueTrend,
          expenses: mockExpenses,
          invoices: mockInvoices,
        }),
      });
      const data = await res.json();
      setAiDiagnosis(data.diagnosis || JSON.stringify(data, null, 2));
    } catch {
      setAiDiagnosis("Unable to run diagnosis. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar title="Finance" subtitle={`${mockCompany.name} · Financial Intelligence`} />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-1">
                Finance Health
              </p>
              <ScoreRing score={mockFinance.financeScore} size={60} isDemo={!supabaseEnabled} />
            </div>
          </div>
          {[
            { label: "Cash on Hand", value: fmtMoney(mockFinance.cashOnHand), color: "text-emerald-400" },
            { label: "Monthly Burn", value: fmtMoney(mockFinance.monthlyBurn), color: "text-orange-400" },
            { label: "Runway", value: `${mockFinance.runwayMonths} mo`, color: "text-yellow-400" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4">
              <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* MRR + AI Diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue trend */}
          <div className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6]">Revenue vs. Expenses</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#8895c4]">MRR {fmtMoney(mockFinance.mrr)}</span>
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <TrendingUp className="w-3 h-3" />
                  {mockFinance.mrrGrowth}%
                </span>
              </div>
            </div>
            <div className="flex items-end justify-between gap-3 h-40">
              {mockRevenueTrend.map((m) => (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-end justify-center gap-1 h-32">
                    <div
                      className="w-1/2 rounded-t bg-gradient-to-t from-[#5470ff] to-[#7a96ff]"
                      style={{ height: `${(m.mrr / maxBar) * 100}%` }}
                      title={`MRR ${fmtMoney(m.mrr)}`}
                    />
                    <div
                      className="w-1/2 rounded-t bg-[#3a3f5c]"
                      style={{ height: `${(m.expenses / maxBar) * 100}%` }}
                      title={`Expenses ${fmtMoney(m.expenses)}`}
                    />
                  </div>
                  <span className="text-[10px] text-[#5a6399] uppercase tracking-wider">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-[#5a6399] uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#5470ff]" /> MRR
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#3a3f5c]" /> Expenses
              </span>
            </div>
          </div>

          {/* AI Diagnosis */}
          <div className="glass-card p-5 border-[#5470ff]/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#5470ff]" />
                <h2 className="text-sm font-semibold text-[#e8eaf6]">AI Finance Diagnosis</h2>
              </div>
              <button
                onClick={runDiagnosis}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                {loading ? "..." : "Run"}
              </button>
            </div>
            {aiDiagnosis ? (
              <pre className="text-xs text-[#8895c4] leading-relaxed whitespace-pre-wrap font-mono">
                {aiDiagnosis}
              </pre>
            ) : (
              <AwaitingEvidence
                domain="finance"
                hint="Multiple months of widening gap between MRR growth and burn, paired with at least one independent signal (overdue invoices spiking, expense category drift) — patterns from one number alone are anecdote."
              />
            )}
          </div>
        </div>

        {/* Expense breakdown + Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">Expense Breakdown</h2>
            <div className="space-y-3">
              {mockExpenses.map((e) => (
                <div key={e.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#8895c4] flex items-center gap-1.5">
                      {e.category} {trendIcon[e.trend as keyof typeof trendIcon]}
                    </span>
                    <span className="text-xs font-mono text-[#5a6399]">{fmtMoney(e.amount)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#252840] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#5470ff] to-[#7a96ff]"
                      style={{ width: `${e.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-[#e8eaf6]">Invoices</h2>
              <span className="text-xs text-[#5a6399]">
                {fmtMoney(outstanding)} outstanding · {overdue.length} overdue
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#252840]">
                  {["Client", "Amount", "Due", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-[#5a6399] pb-2 pr-4 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1d2e]">
                {mockInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#12141f] transition-colors">
                    <td className="py-2.5 pr-4 text-sm text-[#e8eaf6]">{inv.client}</td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-[#8895c4]">
                      {fmtMoney(inv.amount)}
                    </td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-[#5a6399]">{inv.dueDate}</td>
                    <td className="py-2.5">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
