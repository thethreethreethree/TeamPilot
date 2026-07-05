"use client";

import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import AwaitingEvidence from "@/components/ui/AwaitingEvidence";
import DesignPreviewBanner from "@/components/ui/DesignPreviewBanner";
import { supabaseEnabled } from "@/lib/supabase/client";
import { useCompanyName } from "@/lib/hooks/useCompany";
import {
  mockMarketing,
  mockMarketingChannels,
  mockCampaigns,
  mockFunnel,
} from "@/lib/mock-data";
import { Brain, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1_000).toFixed(0)}K`;

const fmtNum = (n: number) => n.toLocaleString("en-US");

const trendIcon = {
  up: <TrendingUp className="w-3 h-3 text-emerald-400" />,
  down: <TrendingDown className="w-3 h-3 text-red-400" />,
  flat: <Minus className="w-3 h-3 text-muted" />,
};

export default function MarketingPage() {
  const companyName = useCompanyName();
  const maxChannelLeads = Math.max(...mockMarketingChannels.map((c) => c.leads));
  const topFunnel = mockFunnel[0]?.count ?? 1;

  // Per TT.md A21 audit (2026-06-18) CRITICAL finding C3 — runDiagnosis
  // previously POSTed to /api/ai/marketing which returns HTTP 410 (Gone).
  // The catch surfaced "Check your API key" — a dishonest error implying
  // a config problem when the feature was intentionally deprecated. The
  // Run button + handler are removed. The AwaitingEvidence panel speaks
  // honestly about why nothing surfaces yet (§3.2).

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Marketing" subtitle={`${companyName} · Growth Intelligence`} />

      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <DesignPreviewBanner
          domain="Marketing"
          needs="A marketing data source (HubSpot, GA4, Mixpanel, or manual entry) must exist before lead/CAC/funnel values become derived."
        />
        {/* Stats Row */}
        <LearningHint
          as="block"
          category="Marketing · Vital signs"
          title="Marketing health & headline numbers"
          whatItIs="The top-line growth vitals — a health ring plus monthly leads, average CAC, and pipeline value. In this design preview the values come from mock data, not a live marketing feed."
          why="Leads, cost to acquire them, and pipeline are the pump that feeds revenue. But the ring is honest: until a real source (HubSpot, GA4, Mixpanel, or manual entry) is connected, these can't be derived, so they're marked demo."
          how="Read CAC against pipeline value to see whether acquisition is paying for itself, and treat the specific numbers as placeholders. The same tiles fill with real figures once a marketing source is wired in."
          principle="No instant numbers — a figure the system can't derive from real data is labeled demo, never dressed up as truth."
        >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted uppercase tracking-widest mb-1">
                Marketing Health
              </p>
              <ScoreRing score={mockMarketing.marketingScore} size={60} isDemo={!supabaseEnabled} />
            </div>
          </div>
          {[
            { label: "Monthly Leads", value: fmtNum(mockMarketing.monthlyLeads), color: "text-emerald-400" },
            { label: "Avg. CAC", value: `$${mockMarketing.cac}`, color: "text-orange-400" },
            { label: "Pipeline Value", value: fmtMoney(mockMarketing.pipelineValue), color: "text-blue-400" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4">
              <p className="text-xs text-muted uppercase tracking-widest mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
        </LearningHint>

        {/* Funnel + AI Diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversion Funnel */}
          <LearningHint
            as="block"
            category="Marketing · Funnel"
            title="Conversion funnel"
            whatItIs="Each stage from lead to customer with its count, the step-to-step conversion rate between stages, and the overall lead-to-customer rate up top."
            why="The funnel makes the drop-offs visible — the stage where the steepest fall happens is where the biggest, cheapest improvement usually lives. The step rates matter more than the raw counts because they isolate where you're actually losing people."
            how="Find the stage with the lowest step rate — that's the leak. Fixing the worst step compounds through every stage below it. Live data will replace the preview stages once a marketing source is connected."
            principle="The steepest drop-off is the leverage point — read the step rates, not just the totals."
          >
          <div className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-primary">Conversion Funnel</h2>
              <span className="text-xs text-secondary">
                {mockMarketing.conversionRate}% lead → customer
              </span>
            </div>
            <div className="space-y-2">
              {mockFunnel.map((stage, i) => {
                const prev = i === 0 ? stage.count : (mockFunnel[i - 1]?.count ?? stage.count);
                const stepRate = ((stage.count / prev) * 100).toFixed(0);
                return (
                  <div key={stage.stage}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-secondary">{stage.stage}</span>
                      <span className="text-xs font-mono text-muted">
                        {fmtNum(stage.count)}
                        {i > 0 && <span className="ml-2 text-muted">{stepRate}%</span>}
                      </span>
                    </div>
                    <div className="w-full h-5 rounded bg-surface-raised overflow-hidden">
                      <div
                        className="h-full rounded bg-gradient-to-r from-ember-400 to-[#FDE047]"
                        style={{ width: `${(stage.count / topFunnel) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </LearningHint>

          {/* AI Diagnosis */}
          <LearningHint
            as="block"
            category="Marketing · Diagnosis"
            title="AI marketing diagnosis"
            whatItIs="The panel where the System would surface a marketing diagnosis — currently in design preview, awaiting the event chain that already powers Operations."
            why="A diagnosis is only honest once it rests on real evidence: events from ad/CRM integrations, signals derived from at least two sources, and problems gated by enough signals (§3.2). Fabricating one on mock data would be confident, well-formed failure — the thing the Understanding Gate exists to prevent."
            how="Nothing to run here yet — the deprecated Run button was removed rather than left to throw a misleading 'check your API key' error. When the marketing chain ships, diagnoses appear here the way they do in Operations."
            principle="Understanding precedes solving — no diagnosis surfaces until the evidence to earn it exists."
          >
          <div className="glass-card p-5 border-ember-400/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-brand" />
                <h2 className="text-sm font-semibold text-primary">AI Marketing Diagnosis</h2>
              </div>
              <span className="text-[10px] uppercase tracking-widest font-mono text-muted">
                design preview
              </span>
            </div>
            <AwaitingEvidence
              domain="marketing"
              mode="design-preview"
              hint="The chain pattern that produced Operations needs to be replayed for marketing — events from real ad/CRM integrations, signals derived from at least 2 sources, problems gated by ≥3 signals. Until that infrastructure ships, this dashboard is for layout review only."
            />
          </div>
          </LearningHint>
        </div>

        {/* Channels + Campaigns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LearningHint
            as="block"
            category="Marketing · Channels"
            title="Channel performance"
            whatItIs="Each acquisition channel with its lead count, ROI, and a trend arrow, bars scaled to the strongest channel."
            why="Not all leads cost the same. Comparing lead volume against ROI shows which channels are pulling weight and which are expensive noise — the input to where the next marketing dollar should go."
            how="Look for a channel that's high volume but low ROI (expensive) or low volume but high ROI (worth scaling). The trend arrows tell you which way each is moving before you decide. Preview data now; live channel data once connected."
            principle="Volume without ROI is just spend — compare the two, don't celebrate leads alone."
          >
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-primary mb-4">Channel Performance</h2>
            <div className="space-y-3">
              {mockMarketingChannels.map((c) => (
                <div key={c.channel}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-secondary flex items-center gap-1.5">
                      {c.channel} {trendIcon[c.trend as keyof typeof trendIcon]}
                    </span>
                    <span className="text-xs font-mono text-muted">
                      {fmtNum(c.leads)} leads · {c.roi} ROI
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-surface-raised overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ember-400 to-[#FDE047]"
                      style={{ width: `${(c.leads / maxChannelLeads) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          </LearningHint>

          <LearningHint
            as="block"
            category="Marketing · Campaigns"
            title="Active campaigns"
            whatItIs="A table of running campaigns showing spend against budget, leads generated, and status."
            why="Budget-versus-spend against leads is the live efficiency check on each campaign — it shows which ones are converting budget into pipeline and which are burning it. Status keeps the picture honest about what's actually running."
            how="Read spent/budget alongside the leads column: a campaign near its budget cap with few leads is the one to question. Live data replaces the preview rows once a marketing source is connected."
            principle="Judge a campaign by leads per dollar spent, not by how much budget it's moved."
          >
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-primary mb-4">Active Campaigns</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-default">
                  {["Campaign", "Budget", "Leads", "Status"].map((h) => (
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
                {mockCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-surface transition-colors">
                    <td className="py-2.5 pr-4 text-sm text-primary">{c.name}</td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-secondary">
                      {fmtMoney(c.spent)}
                      <span className="text-muted"> / {fmtMoney(c.budget)}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-muted">{c.leads}</td>
                    <td className="py-2.5">
                      <StatusBadge status={c.status} />
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
