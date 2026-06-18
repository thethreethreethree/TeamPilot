"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Top-tab strip for Settings sub-pages. Matches the Zendesk top-tab
 * pattern (Subscription / Apps / API & SDKs / etc.) sitting below
 * the section header.
 */

const TABS = [
  { href: "/dashboard/care/settings/agents", label: "Agents" },
  { href: "/dashboard/care/settings/tags", label: "Tags" },
  { href: "/dashboard/care/settings/shortcuts", label: "Shortcuts" },
  { href: "/dashboard/care/settings/widget", label: "Widget" },
  { href: "/dashboard/care/settings/account", label: "Account" },
];

export function SettingsTabs() {
  const pathname = usePathname() ?? "";
  return (
    <div className="px-8 py-2 border-b border-default bg-white/[0.01] flex items-center gap-1.5 flex-wrap">
      {TABS.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`text-xs font-medium px-3 py-1.5 rounded-md border transition-colors ${
              active
                ? "bg-ember-400/10 border-ember-400/40 text-brand"
                : "border-default text-secondary hover:border-strong hover:text-primary"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
