import Link from "next/link";
import { Activity, ArrowRight, CircleHelp } from "lucide-react";

/**
 * 404 — page not found.
 *
 * Static (no "use client" — no interactive state needed). Constitution-aligned
 * voice: no apologetic fluff, no "Oops!", no animations. Honest empty state
 * with two real next steps.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-base text-primary flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FACC15] to-[#FDE047] flex items-center justify-center shadow-glow">
            <Activity className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-bold tracking-tight">ELOSTATE</span>
        </div>

        <p className="text-[10px] uppercase tracking-widest text-brand mb-3 font-mono">
          404 · not found
        </p>
        <h1 className="text-2xl font-bold text-primary leading-tight mb-3">
          That page doesn&apos;t exist.
        </h1>
        <p className="text-sm text-secondary leading-relaxed mb-8">
          Either it was moved or the link was incorrect. No tracking, no
          redirect, no guessing — just the honest 404.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-[#09090B] font-semibold px-5 py-2.5 rounded-lg transition-colors text-xs"
          >
            Go to dashboard
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 border border-default hover:border-strong text-secondary hover:text-primary font-medium px-5 py-2.5 rounded-lg transition-colors text-xs"
          >
            <CircleHelp className="w-3.5 h-3.5" aria-hidden="true" />
            Back to landing
          </Link>
        </div>
      </div>
    </div>
  );
}
