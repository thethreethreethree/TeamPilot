"use client";

import { useState } from "react";
import {
  Activity, AlertTriangle, Brain, CheckCircle2, ChevronRight,
  Filter, Info, LayoutDashboard, MessageSquare, RefreshCw,
  Send, Settings, Shield, Swords, Users, Zap, Plus, Trash2,
} from "lucide-react";
import Link from "next/link";
import {
  mockCompany, mockTasks, mockTeamMembers, mockAlerts,
  mockDailyPriorities, mockDecisionHistory,
} from "@/lib/mock-data";

// ─── tiny shared components ───────────────────────────────
function ScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const sw = 6, r = (size - sw) / 2, circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? "#34d399" : score >= 60 ? "#fbbf24" : "#f87171";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#252840" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-base font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

const STATUS: Record<string, string> = {
  Blocked: "bg-red-500/15 text-red-400 border-red-500/30",
  "In Progress": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "To Do": "bg-[#252840] text-[#8895c4] border-[#3a3f5c]",
  "Needs Review": "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Critical: "bg-red-500/15 text-red-400 border-red-500/30",
  High: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  Low: "bg-[#252840] text-[#8895c4] border-[#3a3f5c]",
  Overloaded: "bg-red-500/15 text-red-400 border-red-500/30",
  Balanced: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Underutilized: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  "In Progress2": "bg-blue-500/15 text-blue-400 border-blue-500/30",
};
function Badge({ s }: { s: string }) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS[s] ?? "bg-[#252840] text-[#8895c4] border-[#3a3f5c]"}`}>{s}</span>;
}

// ─── nav items ────────────────────────────────────────────
const NAV = [
  { id: "command",       label: "Command Center",    icon: LayoutDashboard },
  { id: "operations",   label: "Operations",         icon: Zap },
  { id: "team",         label: "Team Intelligence",  icon: Users },
  { id: "conversation", label: "Conversations",      icon: MessageSquare },
  { id: "decisions",    label: "Decision Engine",    icon: Brain },
  { id: "settings",     label: "Settings",           icon: Settings },
];

// ══════════════════════════════════════════════════════════
//  SCREEN COMPONENTS
// ══════════════════════════════════════════════════════════

// ── 1. Command Center ─────────────────────────────────────
function CommandScreen() {
  const critical = mockTasks.filter(t => t.status === "Blocked" || t.priority === "Critical");
  const alertIcon = (type: string) =>
    type === "critical" ? <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" /> :
    type === "warning"  ? <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" /> :
                          <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;

  return (
    <div className="space-y-5">
      {/* Health scores */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Business Health", score: mockCompany.healthScore },
          { label: "Operations",      score: mockCompany.operationsScore },
          { label: "Team",            score: mockCompany.teamScore },
        ].map(item => (
          <div key={item.label} className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
            <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-3">{item.label}</p>
            <div className="flex items-center justify-between">
              <ScoreRing score={item.score} size={60} />
              <div className="h-16 w-1.5 rounded-full bg-[#252840] overflow-hidden ml-3">
                <div className="w-full rounded-full transition-all" style={{
                  height: `${item.score}%`, marginTop: `${100 - item.score}%`,
                  background: item.score >= 80 ? "#34d399" : item.score >= 60 ? "#fbbf24" : "#f87171"
                }} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Left col */}
        <div className="col-span-3 space-y-4">
          {/* AI Briefing */}
          <div className="bg-[#1a1d2e] border border-[#5470ff]/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-4 h-4 text-[#5470ff]" />
              <span className="text-sm font-semibold text-[#e8eaf6]">AI Executive Briefing</span>
              <span className="text-[10px] text-[#5470ff] bg-[#5470ff]/10 border border-[#5470ff]/20 px-2 py-0.5 rounded-full">Claude</span>
            </div>
            <p className="text-sm text-[#8895c4] leading-relaxed">
              <span className="text-[#e8eaf6] font-medium">Operations efficiency dropped 9% today</span> due to 2 critical blocked tasks in the payment and deployment pipeline. Revenue exposure is high until the gateway fix is unblocked.{" "}
              <span className="text-[#e8eaf6] font-medium">Team risk detected:</span> Marcus Chen is overloaded — immediate workload redistribution to Lena Torres recommended.
            </p>
          </div>

          {/* Priorities */}
          <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-[#fbbf24]" />
              <span className="text-sm font-semibold text-[#e8eaf6]">Today's Priorities</span>
            </div>
            <ol className="space-y-2.5">
              {mockDailyPriorities.map((p, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-[#5470ff]/15 border border-[#5470ff]/30 text-[#7a96ff] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-sm text-[#8895c4]">{p}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Critical tasks */}
          <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-[#e8eaf6]">Critical & Blocked</span>
              <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">{critical.length}</span>
            </div>
            <div className="space-y-2">
              {critical.slice(0, 3).map(t => (
                <div key={t.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-[#12141f] border border-[#252840]">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#e8eaf6] truncate">{t.title}</p>
                    {t.blockerReason && <p className="text-xs text-[#5a6399] mt-0.5 truncate">Blocker: {t.blockerReason}</p>}
                  </div>
                  <Badge s={t.status} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col */}
        <div className="col-span-2 space-y-4">
          {/* Alerts */}
          <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
            <p className="text-sm font-semibold text-[#e8eaf6] mb-3">AI Alerts</p>
            <div className="space-y-2">
              {mockAlerts.map(a => (
                <div key={a.id} className={`p-2.5 rounded-lg border text-xs ${a.type === "critical" ? "bg-red-500/5 border-red-500/20" : a.type === "warning" ? "bg-yellow-500/5 border-yellow-500/20" : "bg-blue-500/5 border-blue-500/20"}`}>
                  <div className="flex items-start gap-2">
                    {alertIcon(a.type)}
                    <div>
                      <p className="font-medium text-[#e8eaf6]">{a.title}</p>
                      <p className="text-[#5a6399] mt-0.5 leading-relaxed">{a.detail}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Snapshot */}
          <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
            <p className="text-sm font-semibold text-[#e8eaf6] mb-3">Execution Snapshot</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Total",      value: mockTasks.length, color: "text-[#e8eaf6]" },
                { label: "Blocked",    value: mockTasks.filter(t => t.status === "Blocked").length, color: "text-red-400" },
                { label: "Active",     value: mockTasks.filter(t => t.status === "In Progress").length, color: "text-blue-400" },
                { label: "Completed",  value: mockTasks.filter(t => t.status === "Completed").length, color: "text-emerald-400" },
              ].map(s => (
                <div key={s.label} className="bg-[#12141f] border border-[#252840] rounded-lg p-3 text-center">
                  <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-[#5a6399] mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Decision memory */}
          <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
            <p className="text-sm font-semibold text-[#e8eaf6] mb-3">Decision Memory</p>
            <div className="space-y-2">
              {mockDecisionHistory.map(d => (
                <div key={d.id} className="p-2.5 rounded-lg bg-[#12141f] border border-[#252840]">
                  <p className="text-xs font-medium text-[#e8eaf6]">{d.title}</p>
                  <p className="text-[10px] text-[#5a6399] mt-0.5">{d.date}</p>
                  <Badge s={d.executionStatus} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 2. Operations ─────────────────────────────────────────
function OperationsScreen() {
  const [filter, setFilter] = useState("All");
  const filters = ["All", "Blocked", "In Progress", "To Do", "Needs Review"];
  const filtered = filter === "All" ? mockTasks : mockTasks.filter(t => t.status === filter);
  const pri: Record<string, string> = { Critical: "bg-red-500", High: "bg-orange-500", Medium: "bg-yellow-500", Low: "bg-[#3a3f5c]" };

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Health Score", value: mockCompany.operationsScore, color: "#fbbf24" },
          { label: "Blocked",      value: mockTasks.filter(t => t.status === "Blocked").length, color: "#f87171" },
          { label: "In Progress",  value: mockTasks.filter(t => t.status === "In Progress").length, color: "#60a5fa" },
          { label: "Critical",     value: mockTasks.filter(t => t.priority === "Critical").length, color: "#fb923c" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
            <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* AI Diagnosis */}
      <div className="bg-[#1a1d2e] border border-[#5470ff]/20 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-[#5470ff]" />
          <span className="text-sm font-semibold text-[#e8eaf6]">AI Operations Diagnosis</span>
          <span className="text-[10px] text-[#5470ff] bg-[#5470ff]/10 border border-[#5470ff]/20 px-2 py-0.5 rounded-full">Live in app</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/15">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#8895c4]"><span className="text-[#e8eaf6] font-medium">Critical bottleneck detected.</span> 2 blocked tasks creating cascading delays. v2.4 deploy blocked by gateway fix. Revenue exposure increasing hourly.</p>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
            <Zap className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#8895c4]"><span className="text-[#e8eaf6] font-medium">Recommended action:</span> Escalate payment API credential request to finance. Unblocking gateway resolves 2 cascading issues simultaneously.</p>
          </div>
        </div>
      </div>

      {/* Task board */}
      <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-semibold text-[#e8eaf6]">Task Board</span>
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-[#5a6399]" />
            {filters.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${filter === f ? "bg-[#5470ff]/15 text-[#7a96ff] border-[#5470ff]/30" : "text-[#5a6399] border-transparent hover:border-[#252840] hover:text-[#8895c4]"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#252840]">
                {["Task", "Assignee", "Priority", "AI Score", "Status", "Due"].map(h => (
                  <th key={h} className="text-left text-[10px] font-semibold text-[#5a6399] pb-2 pr-4 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1a1d2e]">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-[#12141f] transition-colors">
                  <td className="py-2.5 pr-4">
                    <p className="text-sm font-medium text-[#e8eaf6]">{t.title}</p>
                    {t.blockerReason && <p className="text-[10px] text-red-400 mt-0.5">⚠ {t.blockerReason}</p>}
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-[#5470ff]/20 flex items-center justify-center text-[9px] font-bold text-[#7a96ff]">
                        {t.assignee.split(" ").map(n => n[0]).join("")}
                      </div>
                      <span className="text-xs text-[#8895c4]">{t.assignee.split(" ")[0]}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${pri[t.priority]}`} />
                      <span className="text-xs text-[#8895c4]">{t.priority}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-12 h-1.5 rounded-full bg-[#252840] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${t.aiPriorityScore}%`, background: t.aiPriorityScore >= 90 ? "#f87171" : t.aiPriorityScore >= 70 ? "#fbbf24" : "#5470ff" }} />
                      </div>
                      <span className="text-[10px] font-mono text-[#5a6399]">{t.aiPriorityScore}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4"><Badge s={t.status} /></td>
                  <td className="py-2.5"><span className="text-xs font-mono text-[#5a6399]">{t.dueDate}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── 3. Team Intelligence ──────────────────────────────────
function TeamScreen() {
  const wColor = (l: string) => l === "Overloaded" ? "text-red-400" : l === "High" ? "text-orange-400" : l === "Balanced" ? "text-emerald-400" : "text-yellow-400";
  const wW = (l: string) => l === "Overloaded" ? "95%" : l === "High" ? "75%" : l === "Balanced" ? "55%" : "25%";
  const wBg = (l: string) => l === "Overloaded" ? "#f87171" : l === "High" ? "#fb923c" : l === "Balanced" ? "#34d399" : "#fbbf24";

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Team Health",    value: mockCompany.teamScore,           color: "#34d399" },
          { label: "Members",        value: mockTeamMembers.length,          color: "#e8eaf6" },
          { label: "Overloaded",     value: mockTeamMembers.filter(m => m.workloadLevel === "Overloaded").length, color: "#f87171" },
          { label: "Underutilized",  value: mockTeamMembers.filter(m => m.workloadLevel === "Underutilized").length, color: "#fbbf24" },
        ].map(s => (
          <div key={s.label} className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
            <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-2">{s.label}</p>
            <p className="text-3xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* AI callout */}
      <div className="bg-[#1a1d2e] border border-[#5470ff]/20 rounded-xl p-4 space-y-2">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-[#5470ff]" />
          <span className="text-sm font-semibold text-[#e8eaf6]">AI Team Analysis</span>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/15">
          <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#8895c4]"><span className="text-[#e8eaf6] font-medium">Marcus Chen is critically overloaded.</span> 4 active, 2 overdue, 2 blocked. Burnout risk HIGH. Immediate redistribution required.</p>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/15">
          <Users className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#8895c4]"><span className="text-[#e8eaf6] font-medium">Lena Torres is underutilized</span> with only 1 active task. Recommend assigning 1–2 tasks from Marcus immediately.</p>
        </div>
      </div>

      {/* Team grid */}
      <div className="grid grid-cols-3 gap-4">
        {mockTeamMembers.map(m => (
          <div key={m.id} className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4 hover:border-[#3a3f5c] transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[#5470ff]/20 border border-[#5470ff]/20 flex items-center justify-center text-xs font-bold text-[#7a96ff]">{m.avatar}</div>
                <div>
                  <p className="text-sm font-semibold text-[#e8eaf6]">{m.name}</p>
                  <p className="text-[10px] text-[#5a6399]">{m.role}</p>
                </div>
              </div>
              <Badge s={m.workloadLevel} />
            </div>

            <div className="grid grid-cols-4 gap-1 text-center mb-3">
              {[
                { l: "Active", v: m.activeTasks, c: "text-blue-400" },
                { l: "Done", v: m.completedTasks, c: "text-emerald-400" },
                { l: "Overdue", v: m.overdueTasks, c: "text-red-400" },
                { l: "Blocked", v: m.blockedTasks, c: "text-orange-400" },
              ].map(s => (
                <div key={s.l}>
                  <p className={`text-base font-bold ${s.c}`}>{s.v}</p>
                  <p className="text-[9px] text-[#5a6399]">{s.l}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-[#5a6399]">Workload</span>
              <span className={`text-[10px] font-medium ${wColor(m.workloadLevel)}`}>{m.workloadLevel}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[#252840] overflow-hidden">
              <div className="h-full rounded-full" style={{ width: wW(m.workloadLevel), background: wBg(m.workloadLevel) }} />
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#252840]">
              <div className="text-center">
                <p className="text-xs font-bold text-[#e8eaf6]">{m.performanceScore}</p>
                <p className="text-[9px] text-[#5a6399]">Perf.</p>
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-[#e8eaf6]">{m.consistencyScore}</p>
                <p className="text-[9px] text-[#5a6399]">Consist.</p>
              </div>
              <p className="text-[10px] text-[#5a6399]">{m.recentActivity}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── 4. Conversation Intelligence ──────────────────────────
const DEMO_CONVO = `CEO: We need to decide on the new pricing model before the board meeting Thursday.

Sarah: Our enterprise clients generate 4x more revenue per seat but pay the same as SMEs — we're leaving money on the table.

Marcus: Usage-based billing needs ~3 weeks backend work for metering infrastructure.

James: Tiered pricing with usage component could reduce churn — lower tier users get a natural upgrade path.

CEO: What's the risk if we push live before Q2 closes?

Sarah: 12 enterprise contracts up for renewal in May. We need a grandfathering policy.

Marcus: Go live with new pricing for net-new customers only in Q2, migrate existing clients Q3. Reduces tech and commercial risk.

CEO: Alright — tiered pricing + usage for net-new in Q2. Sarah owns enterprise contract strategy. Marcus starts backend this week. James prepares customer comms. Align on final pricing tiers by Friday.`;

const DEMO_RESULT = {
  summary: "The team aligned on a phased pricing model transition — tiered + usage-based for net-new customers in Q2, with existing client migration deferred to Q3 to protect renewal contracts.",
  decision: "Adopt tiered pricing with usage component for all net-new customers starting Q2. Existing clients remain on current pricing with a grandfathering policy through Q3.",
  keyPoints: ["Enterprise clients generate 4x revenue per seat at flat rate", "3 weeks backend work required for metering infrastructure", "12 enterprise contracts up for renewal in May — risk of mid-cycle pricing change"],
  unresolvedItems: ["Final pricing tier amounts not yet defined"],
  actionPlan: [
    { task: "Define final pricing tiers and amounts", owner: "Sarah Kim", priority: "High", deadline: "Friday" },
    { task: "Begin backend metering infrastructure", owner: "Marcus Chen", priority: "High", deadline: "This week" },
    { task: "Draft customer communication plan for existing clients", owner: "James Okafor", priority: "Medium", deadline: "Next week" },
    { task: "Create enterprise grandfathering policy", owner: "Sarah Kim", priority: "High", deadline: "Before May renewals" },
  ],
  executiveNote: "This is a well-structured decision. Phasing net-new vs. existing reduces commercial risk while allowing Q2 revenue capture. Ensure legal reviews the grandfathering terms before any client communication goes out.",
};

function ConversationScreen() {
  const [analyzed, setAnalyzed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = () => {
    setLoading(true);
    setTimeout(() => { setLoading(false); setAnalyzed(true); }, 1800);
  };

  return (
    <div className="grid grid-cols-2 gap-5">
      {/* Input */}
      <div className="space-y-4">
        <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-[#5470ff]" />
              <span className="text-sm font-semibold text-[#e8eaf6]">Paste Conversation</span>
            </div>
            <Trash2 className="w-3.5 h-3.5 text-[#5a6399]" />
          </div>
          <p className="text-xs text-[#5a6399] mb-3">Paste a Slack thread, meeting transcript, or email chain. ExecOS extracts decisions and creates action plans.</p>
          <textarea readOnly value={DEMO_CONVO} rows={12}
            className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3 py-2.5 text-xs text-[#8895c4] font-mono leading-relaxed resize-none focus:outline-none" />
          <button onClick={handleAnalyze} disabled={loading || analyzed}
            className="mt-3 w-full flex items-center justify-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-all text-sm">
            <Brain className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Analyzing..." : analyzed ? "Analysis Complete ✓" : "Generate Decision & Action Plan"}
            {!loading && !analyzed && <Send className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Output */}
      <div className="space-y-3">
        {!analyzed ? (
          <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-8 flex flex-col items-center justify-center text-center h-full">
            <div className="w-12 h-12 rounded-xl bg-[#5470ff]/10 border border-[#5470ff]/20 flex items-center justify-center mb-3">
              <Brain className="w-6 h-6 text-[#5470ff]" />
            </div>
            <p className="text-sm font-medium text-[#e8eaf6] mb-1">Ready to analyze</p>
            <p className="text-xs text-[#5a6399]">Click the button to see ExecOS turn a conversation into a structured decision + action plan.</p>
          </div>
        ) : (
          <div className="space-y-3 fade-in">
            <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#5a6399] uppercase tracking-widest mb-2">Summary</p>
              <p className="text-sm text-[#8895c4] leading-relaxed">{DEMO_RESULT.summary}</p>
            </div>
            <div className="bg-[#1a1d2e] border border-[#5470ff]/20 bg-[#5470ff]/5 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><Brain className="w-3.5 h-3.5 text-[#5470ff]" /><span className="text-xs font-semibold text-[#e8eaf6]">Decision</span></div>
              <p className="text-sm text-[#e8eaf6] font-medium leading-relaxed">{DEMO_RESULT.decision}</p>
            </div>
            <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-[#e8eaf6]">Action Plan</span>
                <button className="flex items-center gap-1 text-[10px] text-[#7a96ff] border border-[#5470ff]/30 px-2 py-1 rounded-lg"><Plus className="w-3 h-3" />Add to Tasks</button>
              </div>
              <div className="space-y-2">
                {DEMO_RESULT.actionPlan.map((item, i) => (
                  <div key={i} className="flex items-start justify-between gap-2 p-2.5 rounded-lg bg-[#12141f] border border-[#252840]">
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="w-4 h-4 rounded-full bg-[#5470ff]/15 text-[#7a96ff] text-[9px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i+1}</span>
                      <div>
                        <p className="text-xs font-medium text-[#e8eaf6]">{item.task}</p>
                        <p className="text-[10px] text-[#5a6399]">{item.owner} · {item.deadline}</p>
                      </div>
                    </div>
                    <Badge s={item.priority} />
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
              <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest mb-1">Executive Note</p>
              <p className="text-xs text-[#8895c4] leading-relaxed">{DEMO_RESULT.executiveNote}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── 5. Decision Engine ────────────────────────────────────
const DEMO_DECISION = {
  diagnosis: "Operations efficiency dropped 9% due to 2 blocked critical tasks in the payment and deployment pipeline. Cascading delays are creating compounding revenue risk with each hour.",
  biggestRisk: "If the payment gateway blocker isn't resolved within 24 hours, the v2.4 deploy will miss its window, delaying a scheduled revenue-generating feature release and creating a board-level visibility problem by Friday.",
  options: {
    safe: { action: "Escalate API credential request to CFO with an executive priority flag. Pause v2.4 timeline formally and communicate to board.", expectedOutcome: "Blocker resolved in 48–72h. Board expectations reset. Low execution risk.", tradeoff: "Slower resolution. Revenue feature delayed by ~1 week." },
    balanced: { action: "Escalate to CFO same-day AND reassign Marcus's 2 lowest-priority tasks to Lena Torres to reduce overload pressure immediately.", expectedOutcome: "Blocker resolved in 24–48h. Marcus available to accelerate gateway fix. v2.4 delays minimized.", tradeoff: "Requires real-time workload change. Minor disruption to Lena's current task." },
    aggressive: { action: "Use a temporary sandbox API key to unblock Marcus immediately and deploy v2.4 to a staging environment while the production credential is resolved.", expectedOutcome: "v2.4 in staging within 24h. Full production deploy within 48h. Board sees progress.", tradeoff: "Staging-only deploy creates customer expectation risk if announced prematurely." },
  },
  recommendation: "The Balanced Option is recommended. It solves the root cause (gateway credential) while simultaneously reducing the team risk driving the efficiency drop. Aggressive is viable only if the board deadline is hard and non-negotiable.",
};

function DecisionsScreen() {
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const generate = () => { setLoading(true); setTimeout(() => { setLoading(false); setGenerated(true); }, 1800); };

  const opts = [
    { key: "safe",       label: "Safe",       Icon: Shield, color: "text-blue-400",   border: "border-blue-500/30",   bg: "bg-blue-500/5"   },
    { key: "balanced",   label: "Balanced",   Icon: Zap,    color: "text-emerald-400", border: "border-emerald-500/30", bg: "bg-emerald-500/5" },
    { key: "aggressive", label: "Aggressive", Icon: Swords, color: "text-orange-400", border: "border-orange-500/30", bg: "bg-orange-500/5" },
  ];

  return (
    <div className="space-y-5">
      {/* Input */}
      <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-[#5470ff]" />
          <span className="text-sm font-semibold text-[#e8eaf6]">Describe the Situation</span>
          <span className="text-[10px] text-[#5470ff] bg-[#5470ff]/10 border border-[#5470ff]/20 px-2 py-0.5 rounded-full">Claude AI</span>
        </div>
        <div className="bg-[#12141f] border border-[#252840] rounded-lg px-3 py-2.5 text-sm text-[#8895c4] leading-relaxed mb-3">
          We are experiencing a 9% drop in operations efficiency. Two critical tasks are blocked — payment gateway and v2.4 deploy. Marcus Chen is overloaded. Board wants status by Friday.
        </div>
        <button onClick={generate} disabled={loading || generated}
          className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-60 text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm">
          <Brain className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
          {loading ? "Generating options..." : generated ? "Options Generated ✓" : "Generate Decision Options"}
        </button>
      </div>

      {generated && (
        <div className="space-y-4 fade-in">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
              <p className="text-[10px] font-semibold text-[#5a6399] uppercase tracking-widest mb-2">AI Diagnosis</p>
              <p className="text-sm text-[#8895c4] leading-relaxed">{DEMO_DECISION.diagnosis}</p>
            </div>
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest mb-2">Biggest Risk</p>
              <p className="text-sm text-[#8895c4] leading-relaxed">{DEMO_DECISION.biggestRisk}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {opts.map(({ key, label, Icon, color, border, bg }) => {
              const opt = DEMO_DECISION.options[key as keyof typeof DEMO_DECISION.options];
              const isSelected = picked === key;
              return (
                <button key={key} onClick={() => setPicked(isSelected ? null : key)}
                  className={`text-left rounded-xl p-4 border transition-all ${isSelected ? `${border} ${bg} border-2` : `border-[#252840] bg-[#1a1d2e] hover:border-[#3a3f5c]`}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <span className={`text-sm font-semibold ${color}`}>{label}</span>
                    {isSelected && <CheckCircle2 className={`w-3.5 h-3.5 ml-auto ${color}`} />}
                  </div>
                  <p className="text-sm font-medium text-[#e8eaf6] mb-2 leading-snug">{opt.action}</p>
                  <p className="text-[10px] text-[#5a6399] font-semibold uppercase tracking-wider mt-2 mb-1">Expected Outcome</p>
                  <p className="text-xs text-[#8895c4]">{opt.expectedOutcome}</p>
                  <p className="text-[10px] text-[#5a6399] font-semibold uppercase tracking-wider mt-2 mb-1">Tradeoff</p>
                  <p className="text-xs text-[#8895c4]">{opt.tradeoff}</p>
                </button>
              );
            })}
          </div>

          <div className="bg-[#5470ff]/5 border border-[#5470ff]/20 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2"><Brain className="w-4 h-4 text-[#5470ff]" /><span className="text-sm font-semibold text-[#e8eaf6]">AI Recommendation</span></div>
            <p className="text-sm text-[#8895c4] leading-relaxed">{DEMO_DECISION.recommendation}</p>
            {picked && (
              <div className="mt-4 flex items-center gap-3">
                <button className="flex items-center gap-2 bg-[#5470ff] text-white font-semibold px-4 py-2 rounded-lg text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Approve & Create Tasks
                </button>
                <button className="border border-[#3a3f5c] text-[#8895c4] font-medium px-4 py-2 rounded-lg text-sm">Save to Memory</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Decision history */}
      <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4">
        <p className="text-sm font-semibold text-[#e8eaf6] mb-3">Decision Memory</p>
        <div className="space-y-2">
          {mockDecisionHistory.map(d => (
            <div key={d.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#12141f] border border-[#252840]">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#5470ff] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[#e8eaf6]">{d.title}</p>
                  <p className="text-[10px] text-[#5a6399]">{d.date} · {d.outcome}</p>
                </div>
              </div>
              <Badge s={d.executionStatus} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── 6. Settings ───────────────────────────────────────────
function SettingsScreen() {
  return (
    <div className="max-w-xl space-y-5">
      <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-5">
        <p className="text-sm font-semibold text-[#e8eaf6] mb-1">Company Profile</p>
        <p className="text-xs text-[#5a6399] mb-4">Update your company details to improve AI context quality.</p>
        {[
          { label: "Company Name", value: mockCompany.name },
          { label: "Industry",     value: mockCompany.industry },
          { label: "Stage",        value: mockCompany.stage },
        ].map(f => (
          <div key={f.label} className="mb-3">
            <label className="block text-xs font-medium text-[#8895c4] mb-1.5">{f.label}</label>
            <input defaultValue={f.value} className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3 py-2 text-sm text-[#e8eaf6] focus:outline-none focus:border-[#5470ff]/50" />
          </div>
        ))}
      </div>
      <div className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-1">
          <Brain className="w-4 h-4 text-[#5470ff]" />
          <p className="text-sm font-semibold text-[#e8eaf6]">AI Configuration</p>
        </div>
        <p className="text-xs text-[#5a6399] mb-4">ExecOS uses Claude (Anthropic) for all AI features.</p>
        <label className="block text-xs font-medium text-[#8895c4] mb-1.5">Anthropic API Key</label>
        <input type="password" placeholder="sk-ant-..." className="w-full bg-[#12141f] border border-[#252840] rounded-lg px-3 py-2 text-sm text-[#e8eaf6] placeholder-[#3a3f5c] font-mono focus:outline-none focus:border-[#5470ff]/50" />
        <p className="text-xs text-[#5a6399] mt-2">Or set <code className="text-[#7a96ff] bg-[#5470ff]/10 px-1 rounded">ANTHROPIC_API_KEY</code> in <code className="text-[#7a96ff] bg-[#5470ff]/10 px-1 rounded">.env.local</code></p>
      </div>
      <button className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] text-white font-semibold px-5 py-2.5 rounded-lg transition-all text-sm">
        Save Settings
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  MAIN DEMO PAGE
// ══════════════════════════════════════════════════════════
const SCREENS: Record<string, React.ReactNode> = {
  command:       <CommandScreen />,
  operations:    <OperationsScreen />,
  team:          <TeamScreen />,
  conversation:  <ConversationScreen />,
  decisions:     <DecisionsScreen />,
  settings:      <SettingsScreen />,
};

const TITLES: Record<string, { title: string; subtitle: string }> = {
  command:       { title: "Command Center",           subtitle: "Acme Corp · CEO View" },
  operations:    { title: "Operations",               subtitle: "Acme Corp · Execution Intelligence" },
  team:          { title: "Team Intelligence",        subtitle: "Acme Corp · Workforce Analysis" },
  conversation:  { title: "Conversation Intelligence", subtitle: "Acme Corp · Meeting & Thread Analysis" },
  decisions:     { title: "AI Decision Engine",       subtitle: "Acme Corp · Structured Decision Making" },
  settings:      { title: "Settings",                 subtitle: "System Configuration" },
};

export default function DemoPage() {
  const [active, setActive] = useState("command");
  const { title, subtitle } = TITLES[active];

  return (
    <div className="min-h-screen bg-[#0c0d16] text-[#e8eaf6]">
      {/* Top banner */}
      <div className="bg-[#5470ff]/10 border-b border-[#5470ff]/20 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5470ff] pulse-dot" />
          <span className="text-xs font-medium text-[#7a96ff]">ExecOS Interactive Demo — click any tab to explore</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/" className="text-xs text-[#5a6399] hover:text-[#8895c4] transition-colors">← Back to site</Link>
          <Link href="https://github.com/thethreethreethree/TeamPilot" target="_blank"
            className="text-xs font-medium bg-[#5470ff] hover:bg-[#3a4ff7] text-white px-3 py-1.5 rounded-lg transition-colors">
            Get the Code →
          </Link>
        </div>
      </div>

      <div className="flex min-h-[calc(100vh-41px)]">
        {/* Sidebar */}
        <aside className="w-60 bg-[#12141f] border-r border-[#252840] flex flex-col flex-shrink-0">
          {/* Logo */}
          <div className="px-5 py-5 border-b border-[#252840]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center shadow-glow">
                <Activity className="w-4 h-4 text-white" />
              </div>
              <div>
                <span className="text-sm font-bold text-white">ExecOS</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
                  <span className="text-[9px] text-[#5a6399] uppercase tracking-widest">Demo Mode</span>
                </div>
              </div>
            </div>
          </div>

          {/* Company */}
          <div className="px-4 py-3 border-b border-[#252840]">
            <div className="px-3 py-2 rounded-lg bg-[#1a1d2e] border border-[#252840]">
              <p className="text-[9px] text-[#5a6399] uppercase tracking-widest mb-0.5">Company</p>
              <p className="text-sm font-medium text-[#e8eaf6]">Acme Corp</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-0.5">
            <p className="px-3 mb-2 text-[9px] text-[#5a6399] uppercase tracking-widest">Intelligence</p>
            {NAV.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActive(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  active === id
                    ? "bg-[#5470ff]/15 text-[#7a96ff] border border-[#5470ff]/30"
                    : "text-[#8895c4] hover:text-[#e8eaf6] hover:bg-[#1a1d2e]"
                }`}>
                <Icon className={`w-4 h-4 flex-shrink-0 ${active === id ? "text-[#5470ff]" : "text-[#5a6399]"}`} />
                {label}
                {active === id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#5470ff]" />}
              </button>
            ))}
          </nav>

          {/* User */}
          <div className="px-4 py-4 border-t border-[#252840]">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">CE</div>
              <div>
                <p className="text-sm font-medium text-[#e8eaf6]">CEO</p>
                <p className="text-xs text-[#5a6399]">Executive Access</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <header className="h-14 border-b border-[#252840] bg-[#0c0d16]/80 flex items-center justify-between px-6 flex-shrink-0">
            <div>
              <h1 className="text-base font-semibold text-[#e8eaf6]">{title}</h1>
              <p className="text-xs text-[#5a6399]">{subtitle}</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="flex items-center gap-1.5 text-xs text-[#5a6399] bg-[#12141f] border border-[#252840] rounded-lg px-3 py-1.5 hover:border-[#3a3f5c]">
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
              <div className="text-xs text-[#5a6399] bg-[#12141f] border border-[#252840] rounded-lg px-3 py-1.5">
                Demo Data · Live AI in full app
              </div>
            </div>
          </header>

          {/* Screen */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-6xl mx-auto fade-in" key={active}>
              {SCREENS[active]}
            </div>
          </div>

          {/* Bottom CTA bar */}
          <div className="border-t border-[#252840] bg-[#12141f] px-6 py-3 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[#5a6399]">Like what you see?</span>
              <ChevronRight className="w-3 h-3 text-[#5a6399]" />
              <span className="text-xs text-[#8895c4]">Deploy your own ExecOS instance in minutes</span>
            </div>
            <div className="flex items-center gap-3">
              <Link href="https://github.com/thethreethreethree/TeamPilot" target="_blank"
                className="text-xs font-medium border border-[#3a3f5c] hover:border-[#5470ff]/50 text-[#8895c4] hover:text-white px-4 py-2 rounded-lg transition-all">
                View Source
              </Link>
              <Link href="/onboarding"
                className="text-xs font-semibold bg-[#5470ff] hover:bg-[#3a4ff7] text-white px-4 py-2 rounded-lg transition-all shadow-glow hover:shadow-none">
                Get Started Free →
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
