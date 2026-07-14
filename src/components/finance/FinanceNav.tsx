"use client";

import { usePathname } from "next/navigation";

/**
 * Cross-navigation for the finance surfaces (AMD-006 L3 — workflow continuity). Without it, the
 * sub-pages are only reachable from the dashboard, so moving between AP/AR/Expenses/etc. means
 * bouncing back each time. Rendered under the TopBar on every finance page.
 */
const LINKS = [
  { href: "/dashboard/finance", label: "Overview" },
  { href: "/dashboard/finance/ap", label: "Payable" },
  { href: "/dashboard/finance/pos", label: "POs" },
  { href: "/dashboard/finance/recurring", label: "Recurring" },
  { href: "/dashboard/finance/schedules", label: "Schedules" },
  { href: "/dashboard/finance/ar", label: "Receivable" },
  { href: "/dashboard/finance/credit-notes", label: "Credit Notes" },
  { href: "/dashboard/finance/collections", label: "Collections" },
  { href: "/dashboard/finance/expenses", label: "Expenses" },
  { href: "/dashboard/finance/banking", label: "Banking" },
  { href: "/dashboard/finance/cards", label: "Cards" },
  { href: "/dashboard/finance/payroll", label: "Payroll" },
  { href: "/dashboard/finance/assets", label: "Assets" },
  { href: "/dashboard/finance/profitability", label: "Profit" },
  { href: "/dashboard/finance/budgets", label: "Budget" },
  { href: "/dashboard/finance/forecast", label: "Forecast" },
  { href: "/dashboard/finance/tax", label: "Tax" },
  { href: "/dashboard/finance/periods", label: "Periods" },
  { href: "/dashboard/finance/statements", label: "Statements" },
  { href: "/dashboard/finance/reports", label: "Reports" },
  { href: "/dashboard/finance/anomalies", label: "Anomalies" },
  { href: "/dashboard/finance/controls", label: "Controls" },
  { href: "/dashboard/finance/opening-balances", label: "Opening balances" },
  { href: "/dashboard/finance/contractors", label: "Contractors" },
];

export default function FinanceNav() {
  const path = usePathname();
  return (
    <nav className="border-b border-default bg-base/60">
      <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-1 overflow-x-auto">
        {LINKS.map((l) => {
          const active = l.href === "/dashboard/finance" ? path === l.href : path.startsWith(l.href);
          return (
            <a
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap px-3 py-2 text-xs border-b-2 transition-colors ${
                active
                  ? "border-brand text-primary font-medium"
                  : "border-transparent text-muted hover:text-secondary"
              }`}
            >
              {l.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}
