import React from "react";
// The extension manifest is the SINGLE SOURCE OF TRUTH for the version — so the displayed version can never
// drift from the shipped one (same discipline as the C.A.R.E download page).
import salesManifest from "../../../../extension-sales/manifest.json";

/**
 * /extension/download-sales — public download + install page for the Sales Coach browser extension.
 *
 * Mirrors /extension/download (the C.A.R.E page). The extension is not yet on the Chrome Web Store (founder-
 * gated), so the live path is download-the-zip + load-unpacked. Serves /sales-coach-extension.zip (built
 * deterministically from extension-sales/ by scripts/build-sales-extension-download.mjs, run on prebuild) and
 * gives the click-by-click steps. When a CWS listing goes live, swap the primary button to link there.
 */

export const metadata = {
  title: "Download the Sales Coach Extension",
  description:
    "Install the Sales Coach browser extension for Chrome, Edge, or Brave — read the room, coach your reply, catch up on the deal, and draft the next message on any conversation you're viewing.",
};

const VERSION = salesManifest.version;

const STEPS: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "Download and unzip",
    body: (
      <>
        Download the package above, then unzip it into a folder you&apos;ll keep (for example{" "}
        <code className="px-1 py-0.5 rounded bg-surface text-primary text-[0.9em]">Documents/sales-coach-extension</code>).
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
        1 (the one containing{" "}
        <code className="px-1 py-0.5 rounded bg-surface text-primary text-[0.9em]">manifest.json</code>). The Sales
        Coach icon appears in your toolbar.
      </>
    ),
  },
  {
    title: "Pin it and sign in",
    body: (
      <>
        Click the puzzle-piece icon in the toolbar and pin{" "}
        <strong className="text-primary">Sales Coach</strong> so it&apos;s always visible. Open any conversation
        (Gmail, WhatsApp Web, LinkedIn, Slack…), click the Sales Coach icon, then{" "}
        <strong className="text-primary">Sign in</strong> — it connects to your workspace in one click.
      </>
    ),
  },
];

export default function SalesExtensionDownloadPage() {
  return (
    <div className="min-h-screen bg-base text-primary px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <p className="text-[11px] uppercase tracking-[0.2em] text-brand font-semibold mb-3">Sales Coach Extension</p>
        <h1 className="text-3xl md:text-4xl font-bold text-primary leading-tight mb-3">
          Coach every sales conversation
        </h1>
        <p className="text-sm md:text-base text-secondary leading-relaxed mb-8">
          Install the Sales Coach browser extension to read the room, coach your draft reply against the sales
          books, catch up on where the deal stands, and draft the next message — right on the conversation
          you&apos;re looking at. Works in Chrome, Edge, and Brave.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
          <a
            href="/sales-coach-extension.zip"
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
          <span className="text-xs text-muted">Version {VERSION} · .zip</span>
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
              You need an active plan or trial to use the tools — the extension checks your workspace entitlement
              when you sign in.
            </li>
            <li>
              It reads only the conversation you have open, when you ask it to. Nothing is captured in the
              background, and the tools process that text without storing it — see the{" "}
              <a href="/extension/privacy-sales" className="text-brand hover:opacity-80">
                privacy policy
              </a>
              .
            </li>
            <li>
              On supported sites (Gmail, Outlook, Instagram, Messenger, WhatsApp&nbsp;Web, LinkedIn, Slack) it
              reads the thread automatically; anywhere else, highlight the messages and press Capture.
            </li>
          </ul>
        </div>

        <div className="mt-8">
          <h2 className="text-sm font-bold text-primary mb-2">Having trouble?</h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-secondary leading-relaxed">
            <li>
              <strong className="text-primary">Panel didn&apos;t appear?</strong> It doesn&apos;t open on its
              own — click the Sales Coach icon in your toolbar. It also can&apos;t open on browser system pages
              (like <code>chrome://</code> settings), the Web Store, or PDFs — try it on a normal website.
            </li>
            <li>
              <strong className="text-primary">Says your plan doesn&apos;t include it?</strong> The tools check
              your workspace entitlement when you sign in. If you should have access, ask your workspace admin to
              enable the Sales Coach extension for your account.
            </li>
            <li>
              <strong className="text-primary">Signed in but it still says &quot;session expired&quot; or
              asks you to sign in?</strong> Click <strong className="text-primary">Sign in</strong> in the panel
              again and finish — you should land back on the connect page, which hands your session to the
              extension.
            </li>
            <li>
              <strong className="text-primary">&quot;Couldn&apos;t reach the Sales Coach&quot;</strong> but your
              internet is fine? Make sure you&apos;re using the app at its official web address — not a preview or
              temporary link. If your team runs it at a custom address, ask your admin to point the extension at it.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
