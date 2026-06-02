import { cn } from "@/lib/utils";

// StatusType deliberately untyped — callers may pass any string; statusStyles
// below has a fallback for unknown values.

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, string> = {
  Blocked: "bg-red-500/15 text-red-400 border border-red-500/30",
  "In Progress": "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  "To Do": "bg-[#252840] text-[#8895c4] border border-[#3a3f5c]",
  "Needs Review": "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  Completed: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  Critical: "bg-red-500/15 text-red-400 border border-red-500/30",
  High: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  Medium: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  Low: "bg-[#252840] text-[#8895c4] border border-[#3a3f5c]",
  Overloaded: "bg-red-500/15 text-red-400 border border-red-500/30",
  Balanced: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  Underutilized: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  Overdue: "bg-red-500/15 text-red-400 border border-red-500/30",
  Pending: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  Paid: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
  critical: "bg-red-500/15 text-red-400 border border-red-500/30",
  warning: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  info: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        statusStyles[status] ?? "bg-[#252840] text-[#8895c4] border border-[#3a3f5c]",
        className
      )}
    >
      {status}
    </span>
  );
}
