import type { Metadata } from "next";

/**
 * /extension/privacy — the public privacy policy for the C.A.R.E browser extension.
 *
 * Required by the Chrome Web Store because the extension processes conversation text (per
 * chrome-web-store-publishing.md §5). States the D1 ephemeral policy honestly (§3.4): scanned text is
 * processed to run a tool and NOT stored. Public + indexable (a store-linked policy must be reachable).
 */
export const metadata: Metadata = {
  title: "C.A.R.E Extension — Privacy",
  description:
    "How the C.A.R.E browser extension handles your data: it processes only the text you select, to run a tool, and does not store it.",
};

const UPDATED = "July 22, 2026";

export default function ExtensionPrivacyPage() {
  return (
    <div className="min-h-screen bg-base text-primary px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-3">
          C.A.R.E Extension
        </p>
        <h1 className="text-3xl md:text-4xl font-bold text-primary leading-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted mb-10">Last updated {UPDATED}</p>

        <div className="space-y-8 text-sm md:text-base text-secondary leading-relaxed">
          <section>
            <h2 className="text-lg font-bold text-primary mb-2">The short version</h2>
            <p>
              The C.A.R.E extension only ever reads the text <strong className="text-primary">you select</strong>{" "}
              on a page, and only when you click a tool. That text is sent to the C.A.R.E service to produce the
              result you asked for (a summary, a diagnosis, a draft) and is{" "}
              <strong className="text-primary">not stored</strong>. It is processed and discarded.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">What we access</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong className="text-primary">Selected text only.</strong> The extension reads the current
                selection on the active tab when you run a tool. It does not read pages in the background, does
                not track your browsing, and does not scan anything you haven&apos;t highlighted.
              </li>
              <li>
                <strong className="text-primary">Your account session.</strong> A sign-in token is stored
                locally in the browser&apos;s extension storage so the tools can run against your C.A.R.E
                workspace. It never leaves your browser except as the authorization header on requests to C.A.R.E.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">What we do with it</h2>
            <p>
              The selected text is sent to the C.A.R.E backend to generate the tool&apos;s output, grounded in
              your own workspace. It is <strong className="text-primary">not written to any database, not used
              to train models, and not retained after the request completes</strong> — unless you explicitly
              choose to save a result (for example, spawning a task or saving a resolution), in which case only
              the item you saved is stored, in your own C.A.R.E workspace.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-primary mb-2">What we don&apos;t do</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>We don&apos;t sell or share your data with third parties.</li>
              <li>We don&apos;t track your browsing history or the sites you visit.</li>
              <li>We don&apos;t read or collect anything you haven&apos;t selected and submitted to a tool.</li>
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
