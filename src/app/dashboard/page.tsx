"use client";

import TopBar from "@/components/layout/TopBar";
import ScoreRing from "@/components/ui/ScoreRing";
import StatusBadge from "@/components/ui/StatusBadge";
import AwaitingEvidence from "@/components/ui/AwaitingEvidence";
import { supabaseEnabled } from "@/lib/supabase/client";
import {
  mockCompany,
  mockAlerts,
  mockTasks,
  mockDecisionHistory,
} from "@/lib/mock-data";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Info,
  Lightbulb,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

interface DailyQuestions {
  todaysQuestions: string[];
  uncertainties: string[];
  thingsWorthNoticing: string[];
}

export default function CommandDashboard() {
  const [questions, setQuestions] = useState<DailyQuestions | null>(null);
  const [loadingBriefing, setLoadingBriefing] = useState(false);
  const [briefingError, setBriefingError] = useState("");

  const criticalTasks = mockTasks.filter(
    (t) => t.status === "Blocked" || t.priority === "Critical"
  );

  const generateBriefing = async () => {
    setLoadingBriefing(true);
    setBriefingError("");
    try {
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: mockCompany,
          alerts: mockAlerts,
          tasks: mockTasks,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuestions(data as DailyQuestions);
    } catch (err) {
      setBriefingError(
        err instanceof Error ? err.message : "Unable to generate."
      );
    } finally {
      setLoadingBriefing(false);
    }
  };

  const alertIcon = (type: string) => {
    if (type === "critical")
      return <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    if (type === "warning")
      return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
    return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar
        title="Command Center"
        subtitle={`${mockCompany.name} · CEO View`}
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Business Health Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Business Health",
              score: mockCompany.healthScore,
              detail: "Overall company health",
            },
            {
              label: "Operations",
              score: mockCompany.operationsScore,
              detail: "Execution & task flow",
            },
            {
              label: "Team Intelligence",
              score: mockCompany.teamScore,
              detail: "Workload & performance",
            },
          ].map((item) => (
            <div key={item.label} className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm text-[#8895c4]">{item.detail}</p>
                </div>
                <ScoreRing score={item.score} size={72} isDemo={!supabaseEnabled} />
              </div>
              <div className="mt-4 h-1 rounded-full bg-[#252840] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${item.score}%`,
                    background:
                      item.score >= 80
                        ? "#34d399"
                        : item.score >= 60
                        ? "#fbbf24"
                        : "#f87171",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — Briefing + Priorities */}
          <div className="lg:col-span-2 space-y-5">
            {/* Today's Open Questions (formerly "AI Executive Briefing") */}
            <div className="glass-card p-5 border-[#5470ff]/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <CircleHelp className="w-4 h-4 text-[#5470ff]" />
                  <h2 className="text-sm font-semibold text-[#e8eaf6]">
                    Today&apos;s Open Questions
                  </h2>
                  <span className="text-[10px] font-medium text-[#5470ff] bg-[#5470ff]/10 border border-[#5470ff]/20 px-2 py-0.5 rounded-full">
                    Guide, don&apos;t overtake
                  </span>
                </div>
                <button
                  onClick={generateBriefing}
                  disabled={loadingBriefing}
                  className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingBriefing ? "animate-spin" : ""}`} />
                  {loadingBriefing ? "Surfacing…" : "Surface questions"}
                </button>
              </div>

              {questions ? (
                <div className="space-y-4">
                  <Section
                    icon={<CircleHelp className="w-3 h-3" />}
                    label="Questions worth holding open today"
                    items={questions.todaysQuestions}
                    tone="violet"
                  />
                  <Section
                    icon={<Sparkles className="w-3 h-3" />}
                    label="Things worth noticing"
                    items={questions.thingsWorthNoticing}
                    tone="blue"
                  />
                  <Section
                    icon={<Lightbulb className="w-3 h-3" />}
                    label="Uncertainties — would benefit from more signal"
                    items={questions.uncertainties}
                    tone="amber"
                  />
                </div>
              ) : briefingError ? (
                <p className="text-xs text-red-400">{briefingError}</p>
              ) : (
                <AwaitingEvidence
                  domain="executive"
                  hint="Click 'Surface questions' to ask the System what's worth holding open today. The System will surface questions and uncertainties — it will not tell you what to do."
                />
              )}
            </div>

            {/* Critical Tasks */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-semibold text-[#e8eaf6]">
                    Critical & Blocked Tasks
                  </h2>
                  <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                    {criticalTasks.length}
                  </span>
                </div>
                <Link
                  href="/dashboard/operations"
                  className="text-xs text-[#5a6399] hover:text-[#7a96ff] flex items-center gap-1 transition-colors"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {criticalTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#12141f] border border-[#252840] hover:border-[#3a3f5c] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#e8eaf6] truncate">
                        {task.title}
                      </p>
                      {task.blockerReason && (
                        <p className="text-xs text-[#5a6399] mt-0.5 truncate">
                          Blocker: {task.blockerReason}
                        </p>
                      )}
                      <p className="text-xs text-[#5a6399] mt-0.5">
                        {task.assignee} · Due {task.dueDate}
                      </p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — Alerts + Decision History */}
          <div className="space-y-5">
            {/* Alerts */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">
                AI Alerts
              </h2>
              <div className="space-y-3">
                {mockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border text-sm ${
                      alert.type === "critical"
                        ? "bg-red-500/5 border-red-500/20"
                        : alert.type === "warning"
                        ? "bg-yellow-500/5 border-yellow-500/20"
                        : "bg-blue-500/5 border-blue-500/20"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {alertIcon(alert.type)}
                      <div>
                        <p className="font-medium text-[#e8eaf6] text-xs">
                          {alert.title}
                        </p>
                        <p className="text-[#5a6399] text-xs mt-0.5 leading-relaxed">
                          {alert.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">
                Execution Snapshot
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Total Tasks",
                    value: mockTasks.length,
                    color: "text-[#e8eaf6]",
                  },
                  {
                    label: "Blocked",
                    value: mockTasks.filter((t) => t.status === "Blocked").length,
                    color: "text-red-400",
                  },
                  {
                    label: "In Progress",
                    value: mockTasks.filter((t) => t.status === "In Progress").length,
                    color: "text-blue-400",
                  },
                  {
                    label: "Completed",
                    value: mockTasks.filter((t) => t.status === "Completed").length,
                    color: "text-emerald-400",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-[#12141f] border border-[#252840] rounded-xl p-3 text-center"
                  >
                    <p className={`text-2xl font-bold ${stat.color}`}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-[#5a6399] mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision History */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">
                Decision Memory
              </h2>
              <div className="space-y-3">
                {mockDecisionHistory.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-[#12141f] border border-[#252840]"
                  >
                    <p className="text-xs font-medium text-[#e8eaf6]">{d.title}</p>
                    <p className="text-xs text-[#5a6399] mt-1">{d.date}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <CheckCircle2 className="w-3 h-3 text-[#5470ff]" />
                      <p className="text-xs text-[#5a6399]">{d.outcome}</p>
                    </div>
                    <StatusBadge
                      status={d.executionStatus}
                      className="mt-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  items,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
  tone: "violet" | "blue" | "amber";
}) {
  if (!items || items.length === 0) return null;
  const styles = {
    violet: "text-violet-300 border-violet-500/20 bg-violet-500/5",
    blue: "text-blue-300 border-blue-500/20 bg-blue-500/5",
    amber: "text-amber-300 border-amber-500/20 bg-amber-500/5",
  }[tone];
  return (
    <div className={`rounded-xl border p-3 ${styles}`}>
      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest mb-2">
        {icon}
        {label}
      </p>
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="text-sm text-[#e8eaf6] leading-relaxed">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
