/**
 * Skeleton — animated placeholder for in-flight content.
 *
 * Per audit 2026-06-19 (Wave K): the audit found multiple
 * surfaces showing only a centered spinner during initial load.
 * On slow connections that reads as 'stuck' — the user can't
 * tell whether the page is loading or the content is genuinely
 * empty. Skeleton blocks tell the user 'here's the shape that's
 * coming,' which is a stronger continuity signal than a spinner.
 *
 * Reference: this matches the Linear / Notion / GitHub pattern
 * for initial loads on data-heavy surfaces.
 */
export function Skeleton({
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-white/[0.04] rounded ${className}`}
      {...props}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-3 ${i === lines - 1 ? "w-3/5" : "w-full"}`}
        />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="glass-card p-5 space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="bg-surface/40 border border-default rounded-xl p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Skeleton className="h-3 w-3 rounded-full" />
        <Skeleton className="h-2 w-20" />
      </div>
      <Skeleton className="h-7 w-12" />
      <Skeleton className="h-2 w-16" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-default">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-1.5">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-2 w-2/3" />
      </div>
      <Skeleton className="h-3 w-16" />
    </div>
  );
}
