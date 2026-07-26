import type { Metadata } from "next";

/**
 * /extension/download — public download + install page for the C.A.R.E browser extension.
 *
 * The extension is not yet on the Chrome Web Store (that step is founder-gated: $5 registration + review), so
 * the live distribution path is download-the-zip + load-unpacked. This page serves /care-extension.zip (built
 * deterministically from the PROD package by scripts/build-extension-download.mjs, run on prebuild) and gives
 * the click-by-click install steps. When the CWS listing goes live, swap the primary button to link there —
 * the "one-click install" note below already prepares users for it. (§1.5.1: leaves the user in a flowing
 * state — download, install, then the panel's own one-click Sign in connects them.)
 */
export const metadata: Metadata = {
  title: "Download the C.A.R.E Extension",
  description:
    "Download the C.A.R.E browser extension and install it in Chrome, Edge, or Brave — summarize, dissect, coach, and draft replies on any conversation you're viewing.",
};

const VERSION = "0.1.0";

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "Download and unzip",
    body: (
      <>
        Download the package above, then unzip it into a folder you&apos;ll keep (for example{" "}
        <code className="px-1 py-0.5 rounded bg-surface text-primary text-[0.9em]">Documents/care-extension</code>).
        Chrome loads the extension from that folder, so don&apos;t delete it after installing.
      </>
    ),
  },
  {
    title: "Open your browser's extensions page",
    body: (
      <>
        Go to{" "}
        <code className="px-1 py-0.5 rounded bg-surface text-primary text-[0.9em]">chrome://extensions</code> in
        Chrome or Brave, or{" "}
        <code className="px-1 py-0.5 rounded bg-surface text-primary text-[0.9em]">edge://extensions</code> in
        Edge. (Paste it into the address bar and press Enter.)
      </>
    ),
  },
  {
    title: "Turn on Developer mode",
    body: (
      <>
        Flip the <strong className="text-primary">Developer mode</strong> switch in the top-right corner. This is
        what lets you load an extension you downloaded directly (rather than from the store).
      </>
    ),
  },
  {
    title: "Load the unpacked folder",
    body: (
      <>
        Click <strong className="text-primary">Load unpacked</strong> and select the folder you unzipped in step
        1 (the one containing <code className="px-1 py-0.5 rounded bg-surface text-primary text-[0.9em]">manifest.json</code>).
        The C.A.R.E icon appears in your toolbar.
      </>
    ),
  },
  {
    title: "Pin it and sign in",
    body: (
      <>
        Click the puzzle-piece icon in the toolbar and pin <strong className="text-primary">C.A.R.E</strong> so
        it&apos;s always visible. Open any conversation (email, Slack, a help-desk ticket…), click the C.A.R.E
        icon, then <strong className="text-primary">Sign in</strong> — it connects to your workspace in one click.
      </>
    ),
  },
];

export default function ExtensionDownloadPage() {
  return (
    <div className="min-h-screen bg-base text-primary px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-3">C.A.R.E Extension</p>
        <h1 className="text-3xl md:text-4xl font-bold text-primary leading-tight mb-3">
          Bring C.A.R.E to every conversation
        </h1>
        <p className="text-sm md:text-base text-secondary leading-relaxed mb-8">
          Install the C.A.R.E browser extension to summarize, dissect the real problem, grade a draft against the
          books, co-write a reply, and spin a conversation into a task — right on the page you&apos;re looking at.
          Works in Chrome, Edge, and Brave.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <a
            href="/care-extension.zip"
            download
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-6 py-3 text-sm transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Download the extension
          </a>
          <span className="text-xs text-muted">Version {VERSION} · ~22&nbsp;KB · .zip</span>
        </div>

        <p className="text-xs text-muted mb-12">
          A one-click Chrome Web Store install is coming. Until then, the five steps below take about a minute.
        </p>

        <h2 className="text-lg font-bold text-primary mb-5">Install it (about a minute)</h2>
        <ol className="space-y-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex-none w-7 h-7 rounded-full bg-surface border border-default grid place-items-center text-sm font-bold text-brand tabular-nums">
                {i + 1}
              </span>
              <div className="pt-0.5">
                <h3 className="font-semibold text-primary mb-1">{step.title}</h3>
                <p className="text-sm text-secondary leading-relaxed">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-xl border border-default bg-surface p-5">
          <h2 className="text-sm font-bold text-primary mb-2">Good to know</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-secondary leading-relaxed">
            <li>
              You need an active C.A.R.E plan or trial to use the tools — the extension checks your workspace
              entitlement when you sign in.
            </li>
            <li>
              It only reads the conversation you point it at, when you click a button. The tools process that
              text and don&apos;t store it; the <strong className="text-primary">Capture</strong> button
              deliberately saves the conversation to your workspace so your team can see it. See the{" "}
              <a href="/extension/privacy" className="text-brand hover:opacity-80">
                privacy policy
              </a>
              .
            </li>
            <li>
              To update later, download the newest package and repeat step 4 (or click{" "}
              <strong className="text-primary">Reload</strong> on the C.A.R.E card in your extensions page).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
