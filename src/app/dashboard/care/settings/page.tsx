import Link from "next/link";
import { Tag, Users, Zap, MessageCircle, Settings as SettingsIcon } from "lucide-react";

const CARDS = [
  {
    href: "/dashboard/care/settings/agents",
    label: "Agents",
    body: "Add teammates as support agents. Set skills, status, and routing rules.",
    icon: Users,
  },
  {
    href: "/dashboard/care/settings/tags",
    label: "Tags",
    body: "Build your conversation taxonomy. Color, name, usage counts.",
    icon: Tag,
  },
  {
    href: "/dashboard/care/settings/shortcuts",
    label: "Shortcuts",
    body: "Canned response templates. Type / + shortcut in the composer to insert. Coach-graded for tone.",
    icon: Zap,
  },
  {
    href: "/dashboard/care/settings/widget",
    label: "Widget",
    body: "Customer-facing chat widget: appearance, copy, embed snippet for white-label tenants.",
    icon: MessageCircle,
  },
  {
    href: "/dashboard/care/settings/account",
    label: "Account",
    body: "Subscription, billing, operating hours, security.",
    icon: SettingsIcon,
  },
];

export default function CareSettingsLandingPage() {
  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">
          Configure how Care behaves for your team
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl w-full mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CARDS.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.href}
                href={c.href}
                className="bg-white/[0.02] border border-default rounded-xl p-4 hover:border-strong transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-brand" aria-hidden />
                  <p className="text-sm font-semibold text-primary">{c.label}</p>
                </div>
                <p className="text-xs text-secondary leading-relaxed">
                  {c.body}
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
