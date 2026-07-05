"use client";

import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import AwaitingEvidence from "@/components/ui/AwaitingEvidence";
import DesignPreviewBanner from "@/components/ui/DesignPreviewBanner";
import { supabaseEnabled } from "@/lib/supabase/client";
import { useCompanyName } from "@/lib/hooks/useCompany";
import {
  mockFinance,
  mockRevenueTrend,
  mockExpenses,
  mockInvoices,
} from "@/lib/mock-data";
import { Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

const fmtMoney = (n: number) =>
  n >= 1_000_000
    ? `$${(n / 1_000_000).toFixed(2)}M`
    : `$${(n / 1_000).toFixed(0)}K`;

const trendIcon = {
  up: <TrendingUp className="w-3 h-3 text-red-400" />,
  down: <TrendingDown className="w-3 h-3 text-emerald-400" />,
  flat: <Minus className="w-3 h-3 text-muted" />,
};

export default function FinancePage() {
  const companyName = useCompanyName();
  // Per C3 fix — aiDiagnosis state + Run handler removed (route is
  // deprecated; the dashboard is design-preview only).

  const overdue = mockInvoices.filter((i) => i.status === "Overdue");
  const outstanding = mockInvoices
    .filter((i) => i.status !== "Paid")
    .reduce((sum, i) => sum + i.amount, 0);
  const maxBar = Math.max(...mockRevenueTrend.map((m) => m.expenses));

  // Per TT.md A21 audit (2026-06-18) CRITICAL finding C3 — runDiagnosis
  // previously POSTed to /api/ai/finance which returns HTTP 410 (Gone). The
  // catch then surfaced "Check your API key" — a dishonest error implying
  // a config problem when the feature was intentionally deprecated. The
  // Run button + handler are removed. The AwaitingEvidence panel below
  // already speaks honestly about why nothing surfaces yet (§3.2).

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Finance" subtitle={`${companyName} · Financial Intelligence`} />

      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <DesignPreviewBanner
          domain="Finance"
          needs="A finance data source (accounting integration like Xero/QuickBooks, or a manual entry pipeline) must exist before runway, burn, and expense values become derived."
        />
        {/* Stats Row */}
        <LearningHint
          as="block"
          category="Finance · Vital signs"
          title="Finance health & headline numbers"
          whatItIs="The top-line finance vitals — a health ring plus cash on hand, monthly burn, and runway. In this design preview the values come from mock data, not a live accounting feed."
          why="Runway and burn are the numbers that decide how much time a company actually has. But the ring is honest: until a real accounting source is connected, these can't be derived, so they're marked demo rather than presented as fact."
          how="Read the layout and the relationships (burn against cash gives runway), not the specific figures. When Xero/QuickBooks or a manual pipeline is wired in, the same tiles will show your real position."
          principle="No instant numbers — a figure the system can't derive from real data is labeled demo, never dressed up as truth."
        >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted uppercase tracking-widest mb-1">
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
              <p className="text-xs text-muted uppercase tracking-widest mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
        </LearningHint>

        {/* MRR + AI Diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue trend */}
          <LearningHint
            as="block"
            category="Finance · Trend"
            title="Revenue vs. expenses"
            whatItIs="A month-by-month bar comparison of MRR against expenses, with the current MRR and its growth rate called out above the chart."
            why="The gap between the two bars is the story — widening revenue over flat expenses is the shape of a healthy trajectory. A single month says little; the trend across months is where the signal lives."
            how="Scan left to right for the direction of the gap, not any one bar's height. In the live version this replays real monthly totals from the accounting source instead of the current preview data."
            principle="Read the trend, not the tallest bar — direction over any single point."
          >
          <div className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-primary">Revenue vs. Expenses</h2>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-secondary">MRR {fmtMoney(mockFinance.mrr)}</span>
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
                      className="w-1/2 rounded-t bg-gradient-to-t from-ember-400 to-[#FDE047]"
                      style={{ height: `${(m.mrr / maxBar) * 100}%` }}
                      title={`MRR ${fmtMoney(m.mrr)}`}
                    />
                    <div
                      className="w-1/2 rounded-t bg-surface-raised"
                      style={{ height: `${(m.expenses / maxBar) * 100}%` }}
                      title={`Expenses ${fmtMoney(m.expenses)}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted uppercase tracking-wider">{m.month}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[10px] text-muted uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-ember-400" /> MRR
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-surface-raised" /> Expenses
              </span>
            </div>
          </div>
          </LearningHint>

          {/* AI Diagnosis */}
          <LearningHint
            as="block"
            category="Finance · Diagnosis"
            title="AI finance diagnosis"
            whatItIs="The panel where the System would surface a finance diagnosis — currently in design preview, awaiting the event chain that already powers Operations."
            why="A diagnosis is only honest once it rests on real evidence: events from accounting integrations, signals derived from at least two sources, and problems gated by enough signals (§3.2). Faking one on mock data would be confident, well-formed failure — exactly what the Understanding Gate exists to prevent."
            how="Nothing to run here yet — the deprecated Run button was removed rather than left to throw a misleading error. When the finance chain ships, diagnoses appear here the way they do in Operations."
            principle="Understanding precedes solving — no diagnosis surfaces until the evidence to earn it exists."
          >
          <div className="glass-card p-5 border-ember-400/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-primary">AI Finance Diagnosis</h2>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-muted">
                design preview
              </span>
            </div>
            <AwaitingEvidence
              domain="finance"
              mode="design-preview"
              hint="The chain pattern that produced Operations needs to be replayed for finance — events from real accounting integrations, signals derived from at least 2 sources, problems gated by ≥3 signals. Until that infrastructure ships, this dashboard is for layout review only."
            />
          </div>
          </LearningHint>
        </div>

        {/* Expense breakdown + Invoices */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LearningHint
            as="block"
            category="Finance · Expenses"
            title="Expense breakdown"
            whatItIs="Spend by category, each with a share bar and a trend arrow showing whether that category is rising, falling, or flat."
            why="Where money goes — and which categories are trending up — is where cost discipline starts. A rising category isn't automatically bad; it's a prompt to ask whether the spend is buying proportionate value."
            how="Scan for the trend arrows first, then the share bars. An up-arrow on a large share is worth a conversation. Live data will replace the preview categories once an accounting source is connected."
            principle="Surface where the money goes as counts and trends, not as a pass/fail on any single line."
          >
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-primary mb-4">Expense Breakdown</h2>
            <div className="space-y-3">
              {mockExpenses.map((e) => (
                <div key={e.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-secondary flex items-center gap-1.5">
                      {e.category} {trendIcon[e.trend as keyof typeof trendIcon]}
                    </span>
                    <span className="text-xs font-mono text-muted">{fmtMoney(e.amount)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-raised overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ember-400 to-[#FDE047]"
                      style={{ width: `${e.share}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          </LearningHint>

          <LearningHint
            as="block"
            category="Finance · Invoices"
            title="Invoices"
            whatItIs="A table of client invoices with amount, due date, and status, headed by the total outstanding and the count overdue."
            why="Outstanding and overdue are the cash-collection reality behind revenue — money booked isn't money received. The overdue count is the one to watch: it's revenue you've earned but haven't been paid."
            how="Start with the overdue count in the header, then scan the Status column for which clients it maps to. In the live version this reads from your billing source rather than the preview rows."
            principle="Earned isn't collected — track what's outstanding as plainly as what's booked."
          >
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-primary">Invoices</h2>
              <span className="text-xs text-muted">
                {fmtMoney(outstanding)} outstanding · {overdue.length} overdue
              </span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  {["Client", "Amount", "Due", "Status"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs font-medium text-muted pb-2 pr-4 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-default">
                {mockInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-surface transition-colors">
                    <td className="py-2.5 pr-4 text-sm text-primary">{inv.client}</td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-secondary">
                      {fmtMoney(inv.amount)}
                    </td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-muted">{inv.dueDate}</td>
                    <td className="py-2.5">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </LearningHint>
        </div>
      </div>
    </div>
  );
}
