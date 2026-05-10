"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Zap,
  Users,
  MessageSquare,
  Brain,
  Settings,
  ChevronRight,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "Command Center",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Operations",
    href: "/dashboard/operations",
    icon: Zap,
  },
  {
    label: "Team Intelligence",
    href: "/dashboard/team",
    icon: Users,
  },
  {
    label: "Conversations",
    href: "/dashboard/conversations",
    icon: MessageSquare,
  },
  {
    label: "AI Decision Engine",
    href: "/dashboard/decisions",
    icon: Brain,
  },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-[#12141f] border-r border-[#252840] flex flex-col z-40">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-[#252840]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-base font-bold text-white tracking-tight">ExecOS</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
              <span className="text-[10px] text-[#5a6399] uppercase tracking-widest">Live</span>
            </div>
          </div>
        </div>
      </div>

      {/* Company selector */}
      <div className="px-4 py-3 border-b border-[#252840]">
        <button className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[#1a1d2e] transition-colors group">
          <div className="text-left">
            <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-0.5">Company</p>
            <p className="text-sm font-medium text-[#e8eaf6]">Acme Corp</p>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[#5a6399] group-hover:text-[#8895c4] transition-colors" />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-[10px] text-[#5a6399] uppercase tracking-widest">
          Intelligence
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                isActive
                  ? "bg-[#5470ff]/15 text-[#7a96ff] border border-[#5470ff]/30"
                  : "text-[#8895c4] hover:text-[#e8eaf6] hover:bg-[#1a1d2e]"
              )}
            >
              <Icon
                className={cn(
                  "w-4 h-4 flex-shrink-0",
                  isActive ? "text-[#5470ff]" : "text-[#5a6399]"
                )}
              />
              {item.label}
              {isActive && (
                <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#5470ff]" />
              )}
            </Link>
          );
        })}

        <div className="pt-4">
          <p className="px-3 mb-2 text-[10px] text-[#5a6399] uppercase tracking-widest">
            System
          </p>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-[#8895c4] hover:text-[#e8eaf6] hover:bg-[#1a1d2e] transition-all duration-150"
          >
            <Settings className="w-4 h-4 text-[#5a6399]" />
            Settings
          </Link>
        </div>
      </nav>

      {/* User footer */}
      <div className="px-4 py-4 border-t border-[#252840]">
        <div className="flex items-center gap-3 px-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
            CE
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#e8eaf6] truncate">CEO</p>
            <p className="text-xs text-[#5a6399] truncate">Executive Access</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
