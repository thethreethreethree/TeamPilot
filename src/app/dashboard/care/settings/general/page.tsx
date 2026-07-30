"use client";

import Link from "next/link";
import { MessageCircle, Settings as SettingsIcon, Sparkles } from "lucide-react";
import { SettingsTabs } from "@/components/care/SettingsTabs";
import { LearningModePanel } from "@/components/settings/LearningModePanel";
import { ExperienceModePanel } from "@/components/settings/ExperienceModePanel";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * /dashboard/care/settings/general — the "General" tab.
 *
 * The module-level preferences that shape how C.A.R.E behaves FOR THE PERSON using it (Learning Mode,
 * Experience Mode) — the same cross-cutting dials the main Elostate settings expose, now present inside
 * the C.A.R.E setting system (founder pattern: apply the learning/experience system to each module's
 * settings, same structure as Elostate). These panels are per-user + self-contained (their own endpoints),
 * so they don't touch the tenant-config Save on the Widget tab.
 *
 * Operational tenant config (active/appearance/channels, plan/hours) lives on the Widget + Account tabs;
 * this tab links to them so the whole settings surface is navigable from one place.
 */

const JUMP = [
  {
    href: "/dashboard/care/settings/ai",
    label: "AI & Personality",
    body: "Name, product knowledge, tone, guidance, and the facts the AI answers from.",
    icon: Sparkles,
  },
  {
    href: "/dashboard/care/settings/widget",
    label: "Widget & appearance",
    body: "Turn the widget on/off, appearance, embed snippet, allowed origins, branding, business type.",
    icon: MessageCircle,
  },
  {
    href: "/dashboard/care/settings/account",
    label: "Account & plan",
    body: "Subscription, operating hours, and security posture.",
    icon: SettingsIcon,
  },
];

export default function CareGeneralSettingsPage() {
  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">General</p>
      </header>
      <SettingsTabs />

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full space-y-6">
        <p className="text-xs text-secondary leading-relaxed">
          Module-level preferences and a map of everything you can configure in C.A.R.E.
        </p>

        {/* Per-user cross-cutting dials — same as the main Elostate settings, now inside C.A.R.E. */}
        <div className="space-y-4">
          <LearningModePanel />
          <ExperienceModePanel />
        </div>

        {/* Jump to the operational config surfaces. */}
        <div>
          <p className="text-[11px] uppercase tracking-widest text-muted font-bold mb-2">
            Configure C.A.R.E
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {JUMP.map((j) => {
              const Icon = j.icon;
              return (
                <LearningHint
                  key={j.href}
                  as="block"
                  category="C.A.R.E · Settings"
                  title={j.label}
                  whatItIs={j.body}
                  why="Every C.A.R.E configuration surface is reachable from here, so nothing is buried."
                  how={`Open ${j.label} to configure it.`}
                  principle="A settings home should map the whole surface, not hide half of it."
                >
                  <Link
                    href={j.href}
                    className="block bg-white/[0.02] border border-default rounded-xl p-4 hover:border-strong transition-colors h-full"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Icon className="w-4 h-4 text-brand" aria-hidden />
                      <p className="text-sm font-semibold text-primary">{j.label}</p>
                    </div>
                    <p className="text-xs text-secondary leading-relaxed">{j.body}</p>
                  </Link>
                </LearningHint>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
