import type { Metadata } from "next";
import Link from "next/link";
import {
  MessageSquarePlus,
  Mail,
  BookOpen,
  ShieldCheck,
  Hourglass,
} from "lucide-react";

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

        <h1 className="text-2xl font-bold mt-6 mb-2">Help & support</h1>
        <p className="text-sm text-muted mb-8">
          How to use ELOSTATE, what to expect during pilot, and where to
          reach us when something doesn&apos;t make sense.
        </p>

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
            <li>Anything you want on the §3.1 chain</li>
          </ul>
          <p className="mt-2">
            We see every Feedback report. They get triaged and the
            chain tracks the response.
          </p>
        </Section>

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
