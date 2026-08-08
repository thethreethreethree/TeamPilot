import type { Metadata } from "next";

/**
 * /extension/privacy-sales — the public privacy policy for the Sales Coach browser extension.
 *
 * Required by the Chrome Web Store because the extension processes conversation text (per
 * chrome-web-store-publishing.md, section 5). Mirrors the C.A.R.E extension privacy page's approved structure, but
 * states the Sales Coach extension's ACTUAL behavior, which is FULLY ephemeral: unlike C.A.R.E (whose Capture
 * saves to the workspace), the Sales Coach extension has no save/store path — every tool processes the text
 * and discards it. Verified 2026-08-08: all 5 tool routes are documented "processed and NOT stored", the
 * engines persist nothing (the only DB read is the rep's own profile name for attribution), and the extension
 * stores only the auth token locally. Public + indexable (a store-linked policy must be reachable).
 *
 * FOUNDER/LEGAL REVIEW: this is a legally-significant document — review the wording before it is the official
 * store-listing policy. It describes verified behavior, but the founder owns the final text.
 */
export const metadata: Metadata = {
  title: "Sales Coach Extension — Privacy",
  description:
    "How the Sales Coach browser extension handles your data: it processes only the conversation you point it at, to run a tool, and does not store it.",
};

const UPDATED = "August 8, 2026";

export default function SalesExtensionPrivacyPage() {
  return (
    <div className="min-h-screen bg-base text-primary px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-3">
          Sales Coach Extension
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-primary leading-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted mb-10">Last updated {UPDATED}</p>

        <div className="space-y-8 text-sm md:text-base text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-primary mb-2">The short version</h2>
            <p>
              The Sales Coach extension reads a conversation only when you click a tool, and only the
              conversation you point it at. The <strong className="text-primary">tools</strong> (Read the room,
              Coach my reply, Catch me up, Draft my reply, Say it for me) send that text to the service to produce
              the result you asked for and <strong className="text-primary">do not store it</strong> — it&apos;s
              processed and discarded when the request completes. There is no &ldquo;save&rdquo; step: nothing you
              run through the extension is kept.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">What we access</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-primary">The open conversation, only when you ask.</strong> When you run
                a tool, the extension reads the conversation on the active tab — either the open thread on a
                supported site, or the text you highlighted. It does not read pages in the background, does not
                track your browsing, and does not scan anything you haven&apos;t asked it to.
              </li>
              <li>
                <strong className="text-primary">Your account session.</strong> A sign-in token is stored locally
                in the browser&apos;s extension storage so the tools can run against your workspace. It never
                leaves your browser except as the authorization header on requests to the service.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">What we do with it</h2>
            <p>
              The conversation text is sent to the backend to generate the coaching output, grounded in the sales
              methodology. It is <strong className="text-primary">not written to any database, not used to train
              models, and not retained after the request completes</strong>. The Sales Coach extension has no
              feature that saves your conversations — every tool is processed-and-discarded.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">What we don&apos;t do</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>We don&apos;t store the conversations you run through the tools.</li>
              <li>We don&apos;t sell or share your data with third parties.</li>
              <li>We don&apos;t track your browsing history or the sites you visit.</li>
              <li>We don&apos;t read or collect anything you haven&apos;t submitted to a tool.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">Contact</h2>
            <p>
              Questions about this policy or your data? Reach us at{" "}
              <a href="mailto:privacy@elostate.com" className="text-brand hover:opacity-80">
                privacy@elostate.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
