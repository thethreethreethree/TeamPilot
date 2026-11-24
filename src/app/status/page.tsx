import type { Metadata } from "next";
import Link from "next/link";
import { StatusView } from "./StatusView";

/**
 * /status — public service status (2026-11-25; Gong ledger F36.34; founder picker "Simple public page"). Whether the
 * parts a customer relies on are working right now, read from /api/health on open. Nothing internal is shown.
 */
export const metadata: Metadata = {
  title: "Status · ELOSTATE",
  description: "Whether ELOSTATE is working right now.",
};

export default function StatusPage() {
  return (
    <div className="min-h-screen bg-base text-primary">
      <div className="mx-auto max-w-2xl px-6 py-12">
        <Link href="/" className="text-xs text-muted underline hover:text-primary">
          ← Back to ELOSTATE
        </Link>
        <h1 className="mb-1 mt-6 text-2xl font-bold">ELOSTATE status</h1>
        <p className="text-sm text-secondary">Whether the parts you rely on are working right now.</p>
        <StatusView />
        <p className="mt-8 text-xs text-muted">
          Something not working that shows as working here? <Link href="/security" className="underline hover:text-primary">Tell us</Link>.
        </p>
      </div>
    </div>
  );
}
