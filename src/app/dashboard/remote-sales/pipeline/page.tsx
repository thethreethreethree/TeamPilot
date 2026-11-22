"use client";

import { Suspense } from "react";
import { RemotePipeline } from "@/components/remote-sales/RemotePipeline";

/**
 * Remote Sales → Pipeline (Macro Mode, docs/rss/MACRO-MODE-SPEC.md, 0303). Suspense because the screen reads ?p= (the
 * open prospect) from the URL, which Next requires a boundary for.
 */
export default function RemoteSalesPipelinePage() {
  return (
    <Suspense fallback={<p className="p-6 text-xs text-muted">Loading pipeline…</p>}>
      <RemotePipeline />
    </Suspense>
  );
}
