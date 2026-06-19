import type { Metadata } from "next";
import Link from "next/link";

/**
 * /terms — Terms of Service.
 *
 * v0.1 (2026-06-15) — pilot-ready text. NEEDS LAWYER REVIEW before
 * any paid customer or enterprise contract. Plain-English by
 * design: §A18 invites behavior, even in legal text. We don't
 * threaten because we don't need to — the constitution does the
 * structural work; the Terms just name the contract honestly.
 *
 * Constitutional grounding referenced (in non-jargon form so a
 * normal human reading these Terms gets the discipline, even if
 * they don't know the asset names):
 *   §3.4 → "no instant results" → the 60-day cycle clause
 *   §A10 → "no shadow read"      → the transparency clause
 *   §3.1 → "append-only"         → the data permanence clause
 *   §A9  → "submission = moat"   → why we won't pretend
 */
export const metadata: Metadata = {
  title: "Terms — ELOSTATE",
  description: "How ELOSTATE works and what you agree to by using it.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-base text-primary">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          href="/"
          className="text-xs text-muted hover:text-primary underline"
        >
          ← Back to ELOSTATE
        </Link>

        <h1 className="text-2xl font-bold mt-6 mb-2">Terms of Service</h1>
        <p className="text-xs text-muted">
          Version 0.1 · last updated{" "}
          <time dateTime="2026-06-19">June 19, 2026</time>
        </p>

        <Section title="What ELOSTATE is, in one paragraph">
          ELOSTATE is a discipline-as-product — software that runs your
          team&apos;s diagnostic and decision-making loops against a
          fixed set of rules we call the constitution. The constitution
          is non-negotiable: the System refuses to render verdicts on
          your people, it refuses to claim understanding it hasn&apos;t
          earned, and it refuses to deliver instant results. By using
          ELOSTATE you&apos;re agreeing to operate under that discipline
          alongside the System.
        </Section>

        <Section title="The 60-day honesty window">
          We have a rule called Month 1 = Control. For the first 30 days
          on ELOSTATE, the in-product AI guidance is OFF by default —
          intentionally. This is not a bug or a limitation. It&apos;s
          how we capture an honest baseline of how your team operates
          before any AI guidance touches the work. On Day 30, the
          guidance unlocks; from Day 30 to Day 60 is a single-variable
          intervention window where any improvement is attributable
          to the method, not to luck.
          <br />
          <br />
          You can override this — there&apos;s a button — but the
          override leaves a permanent on-record mark, and any
          subsequent report on outcomes will flag your account as
          &quot;skipped control.&quot; This is the discipline working,
          not a punishment.
        </Section>

        <Section title="What the System sees about you, you can see">
          Whatever ELOSTATE records about a user — their engagement,
          their message patterns, their decision history, their
          communication grades — that same user can see. There is no
          shadow read. Admins can see digest views of their team, but
          the underlying per-user data behind those digests is also
          visible to the user themselves at the same level of detail.
          We don&apos;t do asymmetric surveillance.
        </Section>

        <Section title="Data is append-only">
          The §3.1 chain (events, signals, problems, resolutions) is
          structurally append-only. This means corrections and reversals
          are themselves new events; we never quietly mutate or delete
          history. If you ask for personal data removal, we&apos;ll
          redact identifiable references and anonymize aggregates — but
          the structural record of what happened stays intact so the
          System&apos;s reasoning over time remains honest.
        </Section>

        <Section title="What we promise">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              The System will not assert verdicts on your work or your
              people. It surfaces counts and patterns; you render the
              judgment.
            </li>
            <li>
              The System will not render improvements that haven&apos;t
              been measured against the alternative on real data.
            </li>
            <li>
              The System will tell you when N is too small to draw a
              conclusion, even if the headline number looks good.
            </li>
            <li>
              We will surface bad news (the Coach isn&apos;t helping,
              the cycle data is flat) with the same prominence as good
              news. The §4 readout is honest or it&apos;s nothing.
            </li>
          </ul>
        </Section>

        <Section title="What we ask of you">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Don&apos;t use ELOSTATE to surveil or punish your team.
              The labels we ship are deliberately framed as invitations
              (&quot;Requesting Collaboration&quot;, not
              &quot;Behind&quot;). If you&apos;re using the data to
              find fault rather than help, the System will not be
              useful to you.
            </li>
            <li>
              Honor the Month 1 control window unless you have a
              real reason to override. The skip is on record either
              way.
            </li>
            <li>
              Surface feedback to us through the in-product Feedback
              button (which records to the same §3.1 chain everyone
              else&apos;s feedback does). We treat feedback as data,
              not noise.
            </li>
          </ul>
        </Section>

        <Section title="Account, security, and access">
          You&apos;re responsible for keeping your account credentials
          private. You shouldn&apos;t share your login. If you suspect
          compromise, change your password and email us. Company admins
          (CEO / COO / admin role) have admin access across every topic
          and task in their company — make sure your admin assignments
          reflect real organizational authority.
        </Section>

        <Section title="What this version of the Terms is not yet">
          This is v0.1. It honestly describes how ELOSTATE works at
          pilot scale. It has NOT been reviewed by counsel for paid
          enterprise contracts, GDPR specific obligations, SOC2
          attestations, or jurisdiction-specific consumer protection
          regimes. If you&apos;re considering ELOSTATE for a
          regulated environment or for purchase, contact us and
          we&apos;ll provide the appropriate enterprise terms.
        </Section>

        <Section title="Changes">
          When we change these Terms, we&apos;ll surface it in the
          product (not via email-only). Material changes get an
          explicit acknowledgment surface; minor edits are
          version-stamped here.
        </Section>

        <Section title="Contact">
          <p>
            Reach us at{" "}
            <a
              href="mailto:johnsyramos@gmail.com"
              className="text-brand underline"
            >
              johnsyramos@gmail.com
            </a>
            . We answer real questions, especially uncomfortable ones.
          </p>
        </Section>

        <p className="text-[10px] text-muted mt-10">
          v0.1 · 2026-06-15 · pilot-ready, not yet attorney-reviewed for
          commercial sale
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-primary mb-2">{title}</h2>
      <div className="text-sm text-secondary leading-relaxed">{children}</div>
    </section>
  );
}
