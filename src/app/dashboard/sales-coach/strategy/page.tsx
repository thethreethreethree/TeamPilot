"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import { DeckCard, SectionLabel, DeckPill } from "@/components/sales-coach/ui/deck";
import { LearningHint } from "@/components/learning/LearningHint";
import { outcomeLabel } from "@/lib/coach/v5/outcomeLabels";
import { useExperienceMode } from "@/components/experience/ExperienceModeProvider";
import {
  Quote,
  BookOpen,
  Package,
  Loader2,
  Lightbulb,
} from "lucide-react";

/**
 * Sales Coach → Strategy Library (founder 2026-07-05; decisions 2026-07-06:
 * text-first sibling Roleplay, and "own correct lines" scope for privacy).
 *
 * Read-only. Two things a rep can act on: the exact "correct lines" the coach
 * surfaced on their own past breakdowns (aggregated from their reviews, A18
 * private-to-them), and the team's authored strategy/product playbook. §3.4:
 * every section shows the honest empty state, never a fabricated one.
 */

type CorrectLine = {
  correctLine: string;
  whyItWorks: string;
  context: string | null;
  sessionLabel: string | null;
  outcome: string | null;
  at: string;
};
type Data = {
  methodology: string | null;
  product: string | null;
  booksGrounded: boolean;
  correctLines: CorrectLine[];
};

export default function SalesCoachStrategyPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Standard-only title relabel (founder revision 2026-07-28, PDF: "change this to
  // <One Liners>"). Expert keeps "Strategy Library". Content/subtitle unchanged.
  const { isStandard } = useExperienceMode();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/coach/sales-session/strategy-library");
        if (!res.ok) throw new Error(`Couldn't load (HTTP ${res.status})`);
        setData((await res.json()) as Data);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <TopBar
        title={isStandard ? "One Liners" : "Strategy Library"}
        subtitle="Correct lines & sales strategies"
      />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full space-y-5 bg-base">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : error ? (
          <p className="text-xs text-amber-300 py-8 text-center">{error}</p>
        ) : data ? (
          <>
            {/* ── Your correct lines (rep-private, A18) ──────────────── */}
            <section className="space-y-2.5">
              <SectionLabel icon={Quote}>Your correct lines</SectionLabel>
              <LearningHint
                as="block"
                category="Sales Coach · Strategy"
                title="Your correct lines"
                whatItIs="The exact lines the coach surfaced on your past breakdown moments — the thing that would have landed, saved from each review, in one place."
                why="A correct line is only useful if you can find it again before the next door. Scattered across a dozen reviews, they're forgotten; gathered here, they're a drill list you actually revisit."
                how="Read one before a similar call and say it in your own words. These are yours alone — pulled only from your own reviews, never anyone else's."
                principle="A lesson you can't find again is a lesson you didn't keep."
              >
                {data.correctLines.length === 0 ? (
                  <DeckCard className="p-4">
                    <p className="text-xs text-muted leading-relaxed">
                      No correct lines yet. When a call has a breakdown moment,
                      your review surfaces the exact line that would have
                      worked — and it&apos;s saved here to revisit and practice.
                    </p>
                  </DeckCard>
                ) : (
                  <div className="space-y-2.5">
                    {data.correctLines.map((c, i) => (
                      <DeckCard key={i} className="p-4">
                        <div className="flex items-start gap-2.5">
                          <Quote
                            className="w-4 h-4 text-brand shrink-0 mt-0.5"
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-primary leading-relaxed font-medium">
                              &ldquo;{c.correctLine}&rdquo;
                            </p>
                            <p className="text-xs text-secondary leading-relaxed mt-1.5">
                              {c.whyItWorks}
                            </p>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2.5">
                              {c.context && <DeckPill>{c.context}</DeckPill>}
                              {c.sessionLabel && (
                                <span className="text-[10px] text-muted">
                                  {c.sessionLabel}
                                </span>
                              )}
                              {c.outcome && (
                                <span className="text-[10px] text-muted">
                                  · {outcomeLabel(c.outcome)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </DeckCard>
                    ))}
                  </div>
                )}
              </LearningHint>
            </section>

            {/* ── Team playbook (methodology corpus, 0074) ───────────── */}
            <section className="space-y-2.5">
              <SectionLabel icon={BookOpen}>
                Your team&apos;s playbook
              </SectionLabel>
              <LearningHint
                as="block"
                category="Sales Coach · Strategy"
                title="Your team's playbook"
                whatItIs="Your company's own sales methodology — the strategy and tactics an admin authored — which is also what grounds the coach's reviews."
                why="Generic advice is easy to ignore; your team's own playbook is the shared language everyone is coached against. Reading it is how a rep gets on the same page as the reviews they'll get."
                how="Skim it before a hard call. If it's empty, an admin can add your company's strategy in Sales Coach settings."
                principle="The coach and the rep should be reading from the same book."
              >
                <DeckCard className="p-4">
                  {data.methodology ? (
                    <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
                      {data.methodology}
                    </p>
                  ) : (
                    <p className="text-xs text-muted leading-relaxed">
                      Your team hasn&apos;t added a custom playbook yet.
                      {data.booksGrounded
                        ? " The coach uses proven sales methodology in the meantime."
                        : ""}{" "}
                      An admin can add your company&apos;s strategy in{" "}
                      <Link
                        href="/dashboard/sales-coach/settings"
                        className="text-brand hover:underline"
                      >
                        Sales Coach settings
                      </Link>
                      . {/* §1.5.1 L3 — link the fix, don't just name it. The
                          settings page gates by manager role, so a rep who taps
                          it lands on an honest access boundary, not a dead end. */}
                    </p>
                  )}
                </DeckCard>
              </LearningHint>
            </section>

            {/* ── Product knowledge (product corpus, 0078) — if present ─ */}
            {data.product && (
              <section className="space-y-2.5">
                <SectionLabel icon={Package}>Product knowledge</SectionLabel>
                <DeckCard className="p-4">
                  <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
                    {data.product}
                  </p>
                </DeckCard>
              </section>
            )}

            {data.booksGrounded && (
              <p className="text-[11px] text-muted text-center flex items-center justify-center gap-1.5">
                <Lightbulb className="w-3 h-3 text-brand" aria-hidden />
                Grounded in proven sales books.
              </p>
            )}
          </>
        ) : null}
      </div>
    </>
  );
}
