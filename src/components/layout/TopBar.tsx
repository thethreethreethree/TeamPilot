"use client";

import { Bell, Search, RefreshCw } from "lucide-react";
import { formatDate, formatTime } from "@/lib/utils";
import { useState, useEffect } from "react";

interface TopBarProps {
  title: string;
  subtitle?: string;
}

export default function TopBar({ title, subtitle }: TopBarProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 border-b border-[#252840] bg-[#0c0d16]/80 backdrop-blur-sm flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-lg font-semibold text-[#e8eaf6]">{title}</h1>
        {subtitle && (
          <p className="text-xs text-[#5a6399]">{subtitle}</p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* Date/time */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[#5a6399] bg-[#12141f] border border-[#252840] rounded-lg px-3 py-1.5">
          <span>{formatDate(now)}</span>
          <span className="text-[#3a3f5c]">·</span>
          <span className="text-[#8895c4] font-mono">{formatTime(now)}</span>
        </div>

        {/* Search */}
        <button className="flex items-center gap-2 text-xs text-[#5a6399] bg-[#12141f] border border-[#252840] rounded-lg px-3 py-1.5 hover:border-[#3a3f5c] hover:text-[#8895c4] transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Search</span>
          <span className="text-[#3a3f5c] font-mono">⌘K</span>
        </button>

        {/* Refresh */}
        <button className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#252840] bg-[#12141f] hover:border-[#3a3f5c] transition-colors text-[#5a6399] hover:text-[#8895c4]">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        {/* Notifications */}
        <button className="relative w-8 h-8 flex items-center justify-center rounded-lg border border-[#252840] bg-[#12141f] hover:border-[#3a3f5c] transition-colors text-[#5a6399] hover:text-[#8895c4]">
          <Bell className="w-3.5 h-3.5" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-red-500" />
        </button>
      </div>
    </header>
  );
}
