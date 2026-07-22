import type { Metadata } from "next";
import Link from "next/link";
import {
  MessageSquarePlus,
  Mail,
  BookOpen,
  ShieldCheck,
  Hourglass,
} from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * /help — external support / help page.
 *
 * Pilot-readiness scaffolding. The in-product Feedback button
 * already exists for tactical UI feedback (lands in our internal
 * §3.1 chain). This page is for external help / support requests
 * that go to a real human inbox, plus a quick-start orientation
 * for new pilot users.
 *
 * Constitutional grounding: §A8 — every help-shaped surface is a
 * place where the System participates in the user's growth. The
 * help page invites collaboration, not just "here's a form."
 */
export const metadata: Metadata = {
  title: "Help — ELOSTATE",
  description:
    "How to get help with ELOSTATE, what to expect from pilot, and how to reach us.",
};

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-base text-primary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-xs text-muted hover:text-primary underline"
        >
          ← Back to ELOSTATE
        </Link>

        <LearningHint
          as="block"
          category="Help"
          title="Help & support"
          whatItIs="The orientation surface for pilot users — how the product works, what to expect, and every way to reach a real human."
          why="A pilot user who gets stuck and can't find help churns silently. This page is the deliberate catch for that: it answers the most-misunderstood things before they become support tickets."
          how="Scan the section headers for your question. The 60-day cycle section is the one most people need first; email is for anything a Feedback report can't hold."
          principle="The fastest support is the answer the user finds before they have to ask."
        >
          <h1 className="text-2xl font-bold mt-6 mb-2">Help &amp; support</h1>
          <p className="text-sm text-muted mb-8">
            How to use ELOSTATE, what to expect during pilot, and where to
            reach us when something doesn&apos;t make sense.
          </p>
        </LearningHint>

        <LearningHint
          as="block"
          category="Help · Cadence"
          title="The 60-day cycle"
          whatItIs="The rule that AI guidance is OFF for your first 30 days, ON for the next 30, with the proof readout on Day 60."
          why="It's the single most-misunderstood thing about ELOSTATE — users read the off period as a broken feature. It's the opposite: an honest baseline so any later improvement is provably the method, not luck."
          how="Treat Month 1 as data collection, not downtime. Only override control if you have a real reason — the skip is recorded permanently."
          principle="You can't prove you helped without an honest 'before'."
        >
        <Section
          icon={Hourglass}
          title="The 60-day cycle (the most-misunderstood thing)"
        >
          <p>
            Your first 30 days on ELOSTATE, the in-product AI guidance
            (the &quot;Coach&quot;) is OFF by default. This is
            intentional — we&apos;re capturing an honest baseline of
            how your team operates before any AI guidance touches the
            work.
          </p>
          <p className="mt-2">
            On Day 30, the Coach unlocks for the next 30 days. That
            window is a single-variable intervention — the only thing
            that changed is the guidance, so any improvement is
            attributable to it.
          </p>
          <p className="mt-2">
            On Day 60, the readout (admin-only) shows the comparison.
            That&apos;s the proof checkpoint. Everything after is
            compounding.
          </p>
          <p className="mt-2 text-secondary">
            You CAN override Month 1 control if you have a real reason
            — there&apos;s a button in Settings — but the override is
            recorded permanently and the readout will flag your
            company as &quot;skipped control.&quot; The discipline IS
            the moat (see Terms).
          </p>
        </Section>
        </LearningHint>

        <LearningHint
          as="block"
          category="Help · Feedback"
          title="In-product Feedback"
          whatItIs="The Feedback button on every page — the fast path for bugs, ideas, and anything that reads as wrong."
          why="Feedback that lands in a real, tracked chain (not a void) is what turns pilot users into co-builders. Every report becomes an asset on the record, not a lost email."
          how="Use it for anything tactical; it auto-attaches a screenshot for bugs. Save email for account, billing, or sensitive concerns."
          principle="Feedback is data, not noise — so it goes on the record, not in an inbox."
        >
        <Section icon={MessageSquarePlus} title="In-product Feedback (fast)">
          <p>
            Every page has a Feedback button — bottom-right on most
            pages, top-right or in the chip row on chat detail pages.
            Use this for:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>Bug reports (screenshots auto-attached)</li>
            <li>Feature ideas</li>
            <li>Things that read as wrong / unclear</li>
            <li>Anything you want on the event chain</li>
          </ul>
          <p className="mt-2">
            We see every Feedback report. They get triaged and the
            chain tracks the response.
          </p>
        </Section>
        </LearningHint>

        <Section icon={Mail} title="Email for support">
          <p>
            For anything that doesn&apos;t fit a Feedback report —
            account access, billing (when that exists), data
            redaction requests, sensitive concerns — email us:
          </p>
          <p className="mt-3">
            <a
              href="mailto:johnsyramos@gmail.com"
              className="text-brand text-base font-semibold underline"
            >
              johnsyramos@gmail.com
            </a>
          </p>
          <p className="text-xs text-muted mt-2">
            We answer real questions, especially uncomfortable ones.
            Response time at pilot scale: usually within 24 hours.
          </p>
        </Section>

        <LearningHint
          as="block"
          category="Help · Privacy"
          title="Data and privacy"
          whatItIs="The plain-language version of the transparency guarantee: what the System sees about you, you can see."
          why="Users won't be honest on a platform they think is surveilling them — and dishonest input degrades every downstream diagnosis. This section makes the no-shadow-read rule legible before trust is tested."
          how="Check your own Coach grades and task engagement to see the same data an admin digest shows about you. For the full detail, follow through to the Privacy Policy."
          principle="Transparency isn't a feature here; it's the precondition for honest data."
        >
        <Section icon={ShieldCheck} title="Data and privacy">
          <p>
            ELOSTATE is built so the data the System sees about you,
            you can see. There is no shadow read.
          </p>
          <p className="mt-2">
            Concretely:
          </p>
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              You can see every grade the Coach gave your messages.
            </li>
            <li>
              You can see your own engagement on every task you
              participate in (same data the admin team-check digest
              shows about you).
            </li>
            <li>
              Admins see aggregate views of their team; the underlying
              per-person data behind those aggregates is visible to
              the person themselves.
            </li>
          </ul>
          <p className="mt-2">
            Read the full{" "}
            <Link
              href="/privacy"
              className="text-brand underline"
            >
              Privacy Policy
            </Link>{" "}
            for the details.
          </p>
        </Section>
        </LearningHint>

        <LearningHint
          as="block"
          category="Help · Concepts"
          title="Orienting concepts"
          whatItIs="Short definitions of the four terms that take a minute to internalize: Understanding Gate, Decision Dialogue, Coach, and Requesting Collaboration."
          why="These words carry the product's discipline. A user who misreads 'Requesting Collaboration' as 'behind' will use the tool to chase people — the exact failure the label was built to prevent."
          how="Read all four once; the reframes are deliberate. 'Requesting Collaboration' is the same data as 'blocked' with a different invitation attached."
          principle="The vocabulary is the discipline — the words decide how the tool gets used."
        >
        <Section icon={BookOpen} title="A few orienting concepts">
          <p>
            ELOSTATE uses a few terms that take a minute to internalize:
          </p>
          <dl className="mt-3 space-y-3">
            <div>
              <dt className="text-sm font-semibold text-primary">
                Understanding Gate
              </dt>
              <dd className="text-secondary mt-0.5">
                Before a task can be acted on, the System asks for a
                short structured read — what we&apos;re accomplishing,
                resources, roles. It&apos;s editable forever; we just
                want it stated before work starts.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-primary">
                Decision Dialogue
              </dt>
              <dd className="text-secondary mt-0.5">
                A 4-phase structured surface for high-stakes calls —
                situation, your read, the System&apos;s response, your
                decide. The System never asserts its read before you
                state yours.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-primary">
                Coach
              </dt>
              <dd className="text-secondary mt-0.5">
                Reads your drafts and offers a teaching-shaped
                suggestion — not a rewrite, not a verdict. You decide.
                The Coach is OFF in Month 1 by design.
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold text-primary">
                Requesting Collaboration
              </dt>
              <dd className="text-secondary mt-0.5">
                Our label for what other systems call &quot;blocked.&quot;
                Same data, different invitation: the row wants someone
                to work alongside, not someone to chase.
              </dd>
            </div>
          </dl>
        </Section>
        </LearningHint>

        <p className="text-[10px] text-muted mt-12 text-center">
          ELOSTATE pilot · last updated 2026-06-15
        </p>
      </div>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 glass-card p-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-brand" aria-hidden />
        <h2 className="text-lg font-semibold text-primary">{title}</h2>
      </div>
      <div className="text-sm text-secondary leading-relaxed">{children}</div>
    </section>
  );
}
