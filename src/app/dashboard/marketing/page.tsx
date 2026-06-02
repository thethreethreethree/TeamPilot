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
import { Brain, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useState } from "react";

const fmtMoney = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${(n / 1_000).toFixed(0)}K`;

const fmtNum = (n: number) => n.toLocaleString("en-US");

const trendIcon = {
  up: <TrendingUp className="w-3 h-3 text-emerald-400" />,
  down: <TrendingDown className="w-3 h-3 text-red-400" />,
  flat: <Minus className="w-3 h-3 text-[#5a6399]" />,
};

export default function MarketingPage() {
  const companyName = useCompanyName();
  const [aiDiagnosis, setAiDiagnosis] = useState("");
  const [loading, setLoading] = useState(false);

  const maxChannelLeads = Math.max(...mockMarketingChannels.map((c) => c.leads));
  const topFunnel = mockFunnel[0]?.count ?? 1;

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          marketing: mockMarketing,
          channels: mockMarketingChannels,
          campaigns: mockCampaigns,
          funnel: mockFunnel,
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
              <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-1">
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
              <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-2">{stat.label}</p>
              <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Funnel + AI Diagnosis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversion Funnel */}
          <div className="glass-card p-5 lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6]">Conversion Funnel</h2>
              <span className="text-xs text-[#8895c4]">
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
                      <span className="text-xs text-[#8895c4]">{stage.stage}</span>
                      <span className="text-xs font-mono text-[#5a6399]">
                        {fmtNum(stage.count)}
                        {i > 0 && <span className="ml-2 text-[#3a3f5c]">{stepRate}%</span>}
                      </span>
                    </div>
                    <div className="w-full h-5 rounded bg-[#252840] overflow-hidden">
                      <div
                        className="h-full rounded bg-gradient-to-r from-[#5470ff] to-[#7a96ff]"
                        style={{ width: `${(stage.count / topFunnel) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Diagnosis */}
          <div className="glass-card p-5 border-[#5470ff]/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[#5470ff]" />
                <h2 className="text-sm font-semibold text-[#e8eaf6]">AI Marketing Diagnosis</h2>
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
                domain="marketing"
                hint="Sustained ROI drop on a single channel across multiple weeks, paired with a corresponding funnel drop-off — channel-level numbers alone, without the stage they break at, are not yet a diagnosis."
              />
            )}
          </div>
        </div>

        {/* Channels + Campaigns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">Channel Performance</h2>
            <div className="space-y-3">
              {mockMarketingChannels.map((c) => (
                <div key={c.channel}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-[#8895c4] flex items-center gap-1.5">
                      {c.channel} {trendIcon[c.trend as keyof typeof trendIcon]}
                    </span>
                    <span className="text-xs font-mono text-[#5a6399]">
                      {fmtNum(c.leads)} leads · {c.roi} ROI
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[#252840] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#5470ff] to-[#7a96ff]"
                      style={{ width: `${(c.leads / maxChannelLeads) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">Active Campaigns</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#252840]">
                  {["Campaign", "Budget", "Leads", "Status"].map((h) => (
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
                {mockCampaigns.map((c) => (
                  <tr key={c.id} className="hover:bg-[#12141f] transition-colors">
                    <td className="py-2.5 pr-4 text-sm text-[#e8eaf6]">{c.name}</td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-[#8895c4]">
                      {fmtMoney(c.spent)}
                      <span className="text-[#3a3f5c]"> / {fmtMoney(c.budget)}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs font-mono text-[#5a6399]">{c.leads}</td>
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
