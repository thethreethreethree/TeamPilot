/**
 * The "honest part" on /sales/demo — a deliberate fixed-dark card matching the /care/demo family
 * (theme-audit allowlisted). §3.4: no instant-results claim — the value compounds from the team's own
 * calls. §3.5: the differentiated metric (communication quality) is anchored to downstream consequence.
 */

import { ShieldCheck } from "lucide-react";

export function SalesHonestNote() {
  return (
    <div className="rounded-2xl p-6 md:p-8 border border-ember-400/30 bg-ink-900">
      <p className="text-[10px] uppercase tracking-widest text-ember-300 font-semibold mb-2 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5" aria-hidden /> The honest part
      </p>
      <p className="text-sm md:text-base text-zinc-200 leading-relaxed">
        We don&apos;t promise a better close rate on day one. The Coach starts by watching how your team
        actually sells — its real language, its real objections — and gets sharper with every call. And we
        grade the thing that matters: not whether a rep took the suggestion, but whether the calls that
        followed went better. That compounding, built from{" "}
        <em className="text-ember-300 not-italic font-semibold">your</em> team&apos;s calls, is what a
        competitor can&apos;t copy.
      </p>
    </div>
  );
}
