"use client";

import Link from "next/link";
import { Activity, ArrowRight, Brain, MessageSquare, Shield, Users, Zap } from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI Executive Briefing",
    description: "Daily operational summaries, risk alerts, and prioritized actions — delivered every morning.",
  },
  {
    icon: Zap,
    title: "Operations Intelligence",
    description: "Real-time bottleneck detection, blocked task analysis, and execution health monitoring.",
  },
  {
    icon: Users,
    title: "Team Intelligence",
    description: "Workload balance, performance tracking, accountability flags, and burnout prevention.",
  },
  {
    icon: MessageSquare,
    title: "Conversation Intelligence",
    description: "Turn meetings and threads into decisions, action plans, and assigned tasks automatically.",
  },
  {
    icon: Shield,
    title: "AI Decision Engine",
    description: "Structured decision options — Safe, Balanced, Aggressive — with expected outcomes for every call.",
  },
  {
    icon: Activity,
    title: "Business Health Score",
    description: "A real-time health score across all departments, surfacing the signal inside the noise.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0c0d16] text-[#e8eaf6] overflow-hidden">
      {/* Nav */}
      <nav className="border-b border-[#252840] bg-[#0c0d16]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-bold text-white">ExecOS</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/demo"
              className="text-sm text-[#8895c4] hover:text-[#e8eaf6] transition-colors"
            >
              Live Demo
            </Link>
            <Link
              href="/login"
              className="text-sm text-[#8895c4] hover:text-[#e8eaf6] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/onboarding"
              className="text-sm font-medium bg-[#5470ff] hover:bg-[#3a4ff7] text-white px-4 py-2 rounded-lg transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-24 pb-20 px-6">
        {/* Background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#5470ff]/8 rounded-full blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 bg-[#5470ff]/10 border border-[#5470ff]/20 text-[#7a96ff] text-xs font-medium px-4 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5470ff] pulse-dot" />
            AI Executive Operating System
          </div>

          <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
            Your business runs on
            <br />
            <span className="gradient-text">executive intelligence.</span>
          </h1>

          <p className="text-xl text-[#8895c4] max-w-2xl mx-auto mb-10 leading-relaxed">
            ExecOS is the AI system that helps CEOs, founders, and operators
            think clearly, execute faster, and scale intelligently — across every
            department.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/onboarding"
              className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-glow hover:shadow-none text-base"
            >
              Launch Command Center
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/demo"
              className="flex items-center gap-2 border border-[#3a3f5c] hover:border-[#5470ff]/50 text-[#8895c4] hover:text-[#e8eaf6] font-medium px-8 py-3.5 rounded-xl transition-all text-base"
            >
              View Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Dashboard preview */}
      <section className="px-6 pb-16">
        <div className="max-w-6xl mx-auto">
          <div className="relative rounded-2xl border border-[#252840] bg-[#12141f] overflow-hidden shadow-2xl">
            {/* Window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[#252840] bg-[#0c0d16]">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-emerald-500/60" />
              <span className="ml-3 text-xs text-[#5a6399]">execos.app/dashboard</span>
            </div>
            {/* Mock dashboard preview */}
            <div className="grid grid-cols-3 gap-4 p-6">
              {[
                { label: "Business Health", score: 74, color: "#fbbf24" },
                { label: "Operations", score: 68, color: "#f87171" },
                { label: "Team", score: 81, color: "#34d399" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="bg-[#1a1d2e] border border-[#252840] rounded-xl p-4"
                >
                  <p className="text-xs text-[#5a6399] mb-3">{item.label}</p>
                  <div className="flex items-end justify-between">
                    <span className="text-3xl font-bold" style={{ color: item.color }}>
                      {item.score}
                    </span>
                    <span className="text-xs text-[#5a6399]">/ 100</span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-[#252840] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${item.score}%`, background: item.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <div className="bg-[#1a1d2e] border border-[#5470ff]/20 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-[#5470ff]" />
                  <span className="text-xs font-medium text-[#7a96ff]">AI Executive Briefing</span>
                </div>
                <p className="text-sm text-[#8895c4] leading-relaxed">
                  <span className="text-[#e8eaf6]">Operations efficiency dropped 9% today</span> due to
                  2 blocked critical tasks in the payment and deploy pipeline. Marcus Chen is overloaded
                  with 4 active tasks — immediate redistribution recommended to Lena Torres.
                  Q2 investor report is on track; review with Sarah Kim today.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20 border-t border-[#252840]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-white mb-4">
              Not a tool. An executive system.
            </h2>
            <p className="text-[#8895c4] max-w-xl mx-auto">
              ExecOS transforms raw business data into executive intelligence — so you
              always know what matters most and what to do next.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="glass-card p-6 group"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#5470ff]/10 border border-[#5470ff]/20 flex items-center justify-center mb-4 group-hover:bg-[#5470ff]/20 transition-colors">
                    <Icon className="w-5 h-5 text-[#5470ff]" />
                  </div>
                  <h3 className="text-base font-semibold text-[#e8eaf6] mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#5a6399] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 border-t border-[#252840]">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to run your business with AI?
          </h2>
          <p className="text-[#8895c4] mb-8">
            Set up your company in 2 minutes. No credit card required.
          </p>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] text-white font-semibold px-8 py-3.5 rounded-xl transition-all shadow-glow hover:shadow-none text-base"
          >
            Start for free
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#252840] px-6 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="text-sm font-semibold text-white">ExecOS</span>
          </div>
          <p className="text-xs text-[#5a6399]">
            © 2025 ExecOS. AI Executive Operating System.
          </p>
        </div>
      </footer>
    </div>
  );
}
