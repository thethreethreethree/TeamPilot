"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemePreference } from "./ThemeProvider";
import { cn } from "@/lib/utils";

/**
 * Three-state theme switcher: System · Light · Dark.
 *
 * Why three states (not a binary toggle): respecting a user's OS-level dark
 * preference is the polite default. Some users want an explicit override
 * that survives across machines; others don't. Both groups must be served.
 *
 * Variants:
 * - `segmented` (default): a small pill group of three icons. Use in headers.
 * - `compact`: a single button that cycles system → light → dark → system.
 *   Use where horizontal space is precious (mobile, dense sidebars).
 */

type Option = {
  value: ThemePreference;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
};

const OPTIONS: readonly Option[] = [
  { value: "system", label: "System", Icon: Monitor },
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
];

export function ThemeToggle({
  variant = "segmented",
  className,
}: {
  variant?: "segmented" | "compact";
  className?: string;
}) {
  const { preference, setPreference, resolved } = useTheme();

  if (variant === "compact") {
    // Cycle preference on click — predictable order, indicator shows what's
    // active. We display the icon for the *resolved* mode so the button
    // always reflects current visual state, not just the abstract choice.
    const cycle = () => {
      const order: ThemePreference[] = ["system", "light", "dark"];
      const idx = order.indexOf(preference);
      setPreference(order[(idx + 1) % order.length] ?? "system");
    };
    const Icon = resolved === "light" ? Sun : Moon;
    return (
      <button
        type="button"
        onClick={cycle}
        title={`Theme: ${preference} (${resolved})`}
        aria-label={`Theme: ${preference}. Click to cycle.`}
        className={cn(
          "inline-flex items-center justify-center w-9 h-9 rounded-lg",
          "border border-default bg-surface text-secondary",
          "hover:text-primary hover:border-strong transition-colors",
          className
        )}
      >
        <Icon className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn(
        "inline-flex items-center gap-0.5 p-0.5 rounded-lg",
        "border border-default bg-surface",
        className
      )}
    >
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = preference === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setPreference(value)}
            className={cn(
              "inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors",
              active
                ? "bg-[var(--brand)] text-white shadow-sm"
                : "text-secondary hover:text-primary hover:bg-surface-raised"
            )}
          >
            <Icon className="w-3.5 h-3.5" />
          </button>
        );
      })}
    </div>
  );
}
