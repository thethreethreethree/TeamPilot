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

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        <DesignPreviewBanner
          domain="Marketing"
          needs="A marketing data source (HubSpot, GA4, Mixpanel, or manual entry) must exist before lead/CAC/funnel values become derived."
        />
        {/* Stats Row */}
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

        {/* Funnel + AI Diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversion Funnel */}
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

          {/* AI Diagnosis */}
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
        </div>

        {/* Channels + Campaigns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
        </div>
      </div>
    </div>
  );
}
