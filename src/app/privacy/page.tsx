import type { Metadata } from "next";
import Link from "next/link";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * /privacy — Privacy Policy.
 *
 * v0.1 (2026-06-15) — pilot-ready text. NEEDS LAWYER REVIEW
 * (especially for GDPR / CCPA / sector-specific obligations) before
 * paid customers in regulated environments.
 *
 * §A10 ("no shadow read") is the structural backbone here — every
 * read the System makes about a user is also surfaced TO that user
 * in-product. The Privacy Policy doesn't just describe data
 * collection; it describes the transparency contract.
 *
 * §3.1 (append-only) shapes the deletion section: we can redact
 * personally-identifying references on request, but the structural
 * record of what happened stays intact. We say so plainly.
 */
export const metadata: Metadata = {
  title: "Privacy — ELOSTATE",
  description:
    "What ELOSTATE collects, what we do with it, and how you can see everything we see about you.",
};

export default function PrivacyPage() {
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
          category="Legal · Privacy"
          title="Privacy Policy"
          whatItIs="What ELOSTATE records about you, what it derives, and — the load-bearing part — the guarantee that whatever it sees about you, you can see too."
          why="Most privacy policies describe collection and quietly hope you don't read them. This one describes a structural rule: no backstage read. It exists to put the transparency contract on the record, not just imply it."
          how="Skim the section headers first; each is a concrete commitment. Start with 'The core promise' — it's the rule the rest of the document is built to keep."
          principle="No shadow read: what the System sees about you, you see too."
        >
          <h1 className="text-2xl font-bold mt-6 mb-2">Privacy Policy</h1>
          <p className="text-xs text-muted">
            Version 0.1 · last updated{" "}
            <time dateTime="2026-06-19">June 19, 2026</time>
          </p>
        </LearningHint>

        <Section title="The core promise (the structural one)">
          Whatever ELOSTATE records about you, you can see. There is no
          backstage read by the System that you don&apos;t have access
          to. Admins in your company can see aggregate views of their
          team — and YOU can see the underlying per-person data those
          aggregates are built from, including the data attributed to
          you, at the same level of detail. This isn&apos;t a feature
          we added; it&apos;s a structural rule the product is built
          to.
        </Section>

        <Section title="What we collect from you directly">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Account info: email, name, role (CEO / COO / Lead /
              Member), company assignment.
            </li>
            <li>
              Content you author in-product: chat messages, task
              descriptions, decision dialogues, feedback, smoke-test
              notes.
            </li>
            <li>
              Behavior on the platform: which buttons you press, which
              messages you pin, which tasks you complete steps on. The
              record is append-only so we can reason over patterns,
              not just snapshots.
            </li>
          </ul>
        </Section>

        <Section title="What the System derives about you">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Engagement signals (last meaningful action on a task,
              participation in topics, response patterns).
            </li>
            <li>
              Communication grades — when the Coach is on, every
              sent message gets a grade (productive / neutral /
              needs-guidance / withheld). This is the encouragement
              system; you see your own grades, and your leader sees
              aggregate patterns framed as &quot;Requesting
              Collaboration&quot;, never as a verdict on you.
            </li>
            <li>
              Cross-conversation memory — the Coach reads patterns of
              what it&apos;s already coached you on so it doesn&apos;t
              repeat the same lesson. The memory window is 30 days.
            </li>
          </ul>
        </Section>

        <Section title="What we do NOT do">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              We do not infer your emotional state from typing
              patterns, late-night activity, or absence. The System
              reads what you show it. It does not read what it
              guesses about you.
            </li>
            <li>
              We do not sell your data. Ever. We don&apos;t share with
              advertising platforms or data brokers. If we did, we
              wouldn&apos;t be ELOSTATE.
            </li>
            <li>
              We do not surface a verdict labeled as your performance.
              The labels we ship to leaders are deliberately framed
              as invitations to help, never as ratings on the
              person.
            </li>
          </ul>
        </Section>

        <Section title="Who can see what">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>You</strong> can see everything attributed to
              you, including the same data that appears in admin
              digests about you.
            </li>
            <li>
              <strong>Other members of your company</strong> can see
              shared content in topics they participate in and on
              tasks they&apos;re part of. Row-level security at the
              database layer prevents cross-topic / cross-company
              reads.
            </li>
            <li>
              <strong>Your company admins</strong> (CEO / COO / admin
              role) can see all topics and tasks within the company,
              plus the readout. They see the same underlying
              per-person data you see about yourself; nothing extra.
            </li>
            <li>
              <strong>We (ELOSTATE)</strong> can technically see
              everything via service-role access for support
              purposes. We don&apos;t routinely. In a future build
              we&apos;ll add audit-logged admin-access events so
              even our access is on the record.
            </li>
            <li>
              <strong>Nobody else</strong> sees your data. No third
              parties, no analytics platforms.
            </li>
          </ul>
        </Section>

        <Section title="Third-party services we use">
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Supabase</strong> — primary database and auth.
              Hosted in Supabase&apos;s data centers under their
              security posture.
            </li>
            <li>
              <strong>Vercel</strong> — application hosting and
              edge delivery.
            </li>
            <li>
              <strong>Anthropic Claude</strong> — the LLM behind the
              Coach. Your draft text passes through Anthropic&apos;s
              API to generate Coach analysis. Anthropic does not train
              on API content per their commercial terms. We do not
              send any data through Anthropic that you haven&apos;t
              already authored in the product.
            </li>
            <li>
              <strong>Web Push / VAPID</strong> for notifications —
              browser-native, no third party in the message path.
            </li>
          </ul>
        </Section>

        <Section title="Retention and deletion">
          The §3.1 chain (events / signals / problems / resolutions) is
          structurally append-only. We don&apos;t mutate or delete
          history; we append corrections.
          <br />
          <br />
          What this means for personal data deletion requests:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              We can REDACT your personal identifiers (email, name,
              user id) from past records. The structural events
              remain so the System&apos;s reasoning over time stays
              intact, but they no longer trace back to you
              personally.
            </li>
            <li>
              Aggregate counts that include your contributions stay
              as aggregates — they&apos;re not personally
              identifiable.
            </li>
            <li>
              For deletion that requires removing structural events
              (rare; usually a compliance obligation), contact us
              and we&apos;ll discuss what&apos;s legally required
              vs. what the system supports.
            </li>
          </ul>
        </Section>

        <Section title="Cookies and local storage">
          We use local browser storage to:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>
              Keep you signed in (Supabase auth session — a standard
              JWT).
            </li>
            <li>
              Preserve unsent drafts of Decision Dialogues so a
              browser refresh doesn&apos;t lose your work.
            </li>
            <li>
              Remember UI choices (theme, dismissed cards).
            </li>
          </ul>
          We do not use third-party advertising cookies. We do not
          track you across other sites.
        </Section>

        <Section title="Security">
          Production data sits in Supabase with row-level security
          policies enforcing company isolation. Authentication is
          standard email + password with a future second-factor path
          via the same Supabase auth layer. We do not have SOC2
          attestation at pilot scale — that&apos;s on the roadmap
          before paid enterprise launch.
        </Section>

        <Section title="Your rights">
          You can:
          <ul className="list-disc pl-5 space-y-1 mt-2">
            <li>See everything attributed to you, in-product.</li>
            <li>
              Export your own data — currently via product surfaces
              (My Feedback, task lists); a structured export endpoint
              is roadmapped.
            </li>
            <li>
              Request redaction of personal identifiers from
              historical records (see Retention section).
            </li>
            <li>
              Withdraw consent — close your account and request data
              redaction by emailing us.
            </li>
          </ul>
        </Section>

        <Section title="Children">
          ELOSTATE is for working professionals. It&apos;s not
          designed for and shouldn&apos;t be used by people under
          18. We don&apos;t knowingly collect data about minors. If
          we discover we have, we delete it.
        </Section>

        <Section title="Changes to this policy">
          When we change this policy, we&apos;ll surface it in-
          product. Material changes get an explicit acknowledgment
          surface; small edits are version-stamped here. The full
          history of versions is visible.
        </Section>

        <Section title="Contact">
          <p>
            Privacy questions go to{" "}
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
          v0.1 · 2026-06-15 · pilot-ready, not yet attorney-reviewed
          for GDPR / CCPA / regulated commercial use
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
