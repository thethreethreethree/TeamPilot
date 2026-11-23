import type { Metadata } from "next";
import Link from "next/link";
import { SecurityReportForm } from "@/components/security/SecurityReportForm";

/**
 * /security — how to report a security or privacy issue (2026-11-23; 0312). Linked from /.well-known/security.txt.
 * States the process as it is built: where a report goes, who reads it, what we ask. It makes no legal promise
 * (safe-harbour wording is the founders' to decide — docs/residuals/OPEN.md).
 */
export const metadata: Metadata = {
  title: "Report a security issue · ELOSTATE",
  description: "How to tell ELOSTATE about a security or privacy issue.",
};

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-base text-primary">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="text-xs text-muted underline hover:text-primary">
          ← Back to ELOSTATE
        </Link>
        <h1 className="mb-2 mt-6 text-2xl font-bold">Report a security issue</h1>
        <p className="text-sm text-secondary">
          If you think you have found a security or privacy problem in ELOSTATE — for example, data from one company visible
          to another, a way to sign in as someone else, or a recording reachable without permission — please tell us here.
          You don&apos;t need an account.
        </p>

        <h2 className="mb-1 mt-8 text-base font-semibold">What happens to your report</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">
          <li>It goes straight to the founders&apos; private inbox; no customer company can see it.</li>
          <li>You get a reference when it is received. If you leave a contact, we reply there.</li>
          <li>We record what we decide about each report (looked at, fixed, not an issue, or a duplicate).</li>
          <li>We don&apos;t keep your IP address with the report.</li>
        </ul>

        <h2 className="mb-1 mt-8 text-base font-semibold">Please</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-secondary">
          <li>Use only your own account and data. Stop and report as soon as you can see anyone else&apos;s.</li>
          <li>Don&apos;t change or delete other people&apos;s data, and don&apos;t try to slow down or overload the service.</li>
          <li>Don&apos;t share the issue publicly until we have had a chance to fix it.</li>
          <li>Include enough detail for us to reproduce it: the steps, the address, and what came back.</li>
        </ul>

        <h2 className="mb-3 mt-8 text-base font-semibold">Your report</h2>
        <SecurityReportForm />
      </div>
    </div>
  );
}
