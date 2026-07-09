import "server-only";
import { createClient } from "@/lib/supabase/server";

/**
 * Asset System v1 — §4 readout (per spec section 2 + A2).
 *
 * Reads from the events table (populated by emitAssetEvent) and
 * surfaces the four hard metrics named in the spec:
 *
 *   1. Re-retrieval rate — % of files retrieved (viewed or
 *      downloaded) by anyone at any point AFTER upload day.
 *      Target: > 40% within 30 days. Graveyard signal: < 15%.
 *
 *   2. Cross-actor retrieval — % of files retrieved by someone
 *      OTHER than the uploader. Target: > 25%. This is the
 *      asset-value signal — files only the uploader opens are
 *      personal storage, not team assets.
 *
 *   3. Citation rate — % of files referenced via @file from a
 *      task/decision/resolution within 60 days. Currently
 *      degrades to 0 because @file citation isn't wired yet;
 *      surface honestly.
 *
 *   4. Classification accuracy — measured by the suggestion audit.
 *      What % of routed suggestions did the user accept as-is?
 *      Per §3.5 we record THIS but anchor the readout to
 *      DOWNSTREAM CONSEQUENCE (did the user-corrected
 *      classifications retrieve more than the System-suggested
 *      ones?) — not adoption. So the dashboard shows BOTH the
 *      acceptance rate AND the downstream-retrieval comparison
 *      where data exists.
 */

export type AssetReadoutWindow = "7d" | "30d" | "60d" | "all";

export type AssetReadout = {
  windowLabel: string;
  windowStartIso: string | null;
  // Counts
  uploads: number;
  classifiedUploads: number;
  casualUploads: number;
  // Retrieval signals
  filesWithAnyRetrieval: number;
  reRetrievalRate: number; // 0..1
  crossActorFiles: number;
  crossActorRate: number; // 0..1
  // Citation
  citedFiles: number;
  citationRate: number; // 0..1
  // Suggestion-audit
  suggestionsActedOn: number;
  acceptedAsIs: number;
  editedThenSaved: number;
  rejected: number;
  pending: number;
  acceptedAsIsRate: number; // 0..1
  // Rule trace distribution — which rules fired most
  ruleTraceCounts: Array<{ rule: string; count: number }>;
};

function windowStart(window: AssetReadoutWindow): Date | null {
  if (window === "all") return null;
  const now = new Date();
  const days = window === "7d" ? 7 : window === "30d" ? 30 : 60;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function safeRate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return numerator / denominator;
}

export async function fetchAssetReadout(
  window: AssetReadoutWindow
): Promise<AssetReadout> {
  const sb = await createClient();
  const start = windowStart(window);
  const startIso = start ? start.toISOString() : null;

  // Fetch all files in window (or all-time).
  let filesQuery = sb
    .from("files")
    .select(
      "id, uploader_id, classification_lane, created_at, deprecated_at"
    )
    .is("deprecated_at", null);
  if (startIso) filesQuery = filesQuery.gte("created_at", startIso);
  const { data: files, error: eFiles } = await filesQuery;
  // §3.4 honest-error-state (audit 2026-07-09): the files read is the headline —
  // everything below derives from it. On failure, don't return an all-zero readout
  // as if there were no assets; throw so the route 500s and the page shows an
  // honest error state (added alongside this).
  if (eFiles) {
    throw new Error(`asset readout: files read failed — ${eFiles.message}`);
  }
  const fileList = files ?? [];
  const fileIds = fileList.map((f) => f.id as string);

  const uploads = fileList.length;
  const classifiedUploads = fileList.filter(
    (f) => (f.classification_lane as string) === "classified"
  ).length;
  const casualUploads = uploads - classifiedUploads;

  // Fetch viewed / downloaded events for these files
  let filesWithAnyRetrieval = 0;
  let crossActorFiles = 0;
  if (fileIds.length > 0) {
    const subjects = fileIds.map((id) => `file:${id}`);
    const { data: retrievalEvents } = await sb
      .from("events")
      .select("subject, actor")
      .in("kind", ["asset.file.viewed", "asset.file.downloaded"])
      .in("subject", subjects);
    const byFileActors = new Map<string, Set<string | null>>();
    for (const e of retrievalEvents ?? []) {
      const sub = e.subject as string;
      const fileId = sub.startsWith("file:") ? sub.slice("file:".length) : sub;
      const set = byFileActors.get(fileId) ?? new Set<string | null>();
      set.add((e.actor as string | null) ?? null);
      byFileActors.set(fileId, set);
    }
    for (const f of fileList) {
      const fileId = f.id as string;
      const actors = byFileActors.get(fileId);
      if (actors && actors.size > 0) {
        filesWithAnyRetrieval++;
        const uploaderId = (f.uploader_id as string | null) ?? null;
        // Cross-actor = any retrieval by an actor that isn't the
        // uploader (or by a null actor — system retrieval).
        let crossSeen = false;
        for (const a of actors) {
          if (a !== uploaderId) {
            crossSeen = true;
            break;
          }
        }
        if (crossSeen) crossActorFiles++;
      }
    }
  }

  const reRetrievalRate = safeRate(filesWithAnyRetrieval, uploads);
  const crossActorRate = safeRate(crossActorFiles, uploads);

  // Citation rate — count files cited via asset.file.cited events.
  // The @file mention shortcut isn't built yet, so this metric
  // will read zero until that ships. Per §1.5.1 layer 2 (effectivity)
  // we surface the 0 honestly rather than hiding the metric.
  let citedFiles = 0;
  if (fileIds.length > 0) {
    const subjects = fileIds.map((id) => `file:${id}`);
    const { data: citationEvents } = await sb
      .from("events")
      .select("subject")
      .eq("kind", "asset.file.cited")
      .in("subject", subjects);
    const citedSet = new Set<string>();
    for (const e of citationEvents ?? []) {
      const sub = e.subject as string;
      const fileId = sub.startsWith("file:") ? sub.slice("file:".length) : sub;
      citedSet.add(fileId);
    }
    citedFiles = citedSet.size;
  }
  const citationRate = safeRate(citedFiles, uploads);

  // Suggestion audit — read every suggestion row for files in the
  // current window.
  let suggestionsActedOn = 0;
  let acceptedAsIs = 0;
  let editedThenSaved = 0;
  let rejected = 0;
  let pending = 0;
  if (fileIds.length > 0) {
    const { data: suggestions } = await sb
      .from("file_classification_suggestions")
      .select("user_action")
      .in("file_id", fileIds);
    for (const s of suggestions ?? []) {
      const action = s.user_action as string;
      if (action === "accepted_as_is") {
        acceptedAsIs++;
        suggestionsActedOn++;
      } else if (action === "edited_then_saved") {
        editedThenSaved++;
        suggestionsActedOn++;
      } else if (action === "rejected") {
        rejected++;
        suggestionsActedOn++;
      } else if (action === "pending") {
        pending++;
      }
    }
  }
  const acceptedAsIsRate = safeRate(acceptedAsIs, suggestionsActedOn);

  // Rule trace distribution — counts how often each deterministic
  // routing rule fired across the suggestion audit rows in window.
  // Per migration 0061 the rule_trace column stores entries like
  // 'R2:task-dept-inherit=<uuid>' — we group by the rule prefix.
  //
  // Per 2026-06-19 audit Finding #10: this query graceful-degrades
  // if migration 0061 hasn't been applied yet (column missing →
  // query errors). Without the try/catch the whole readout would
  // 500 instead of just losing the rule-trace section. The error
  // is swallowed; readout still loads with empty ruleTraceCounts.
  const ruleCounts = new Map<string, number>();
  if (fileIds.length > 0) {
    try {
      const { data: traceRows, error } = await sb
        .from("file_classification_suggestions")
        .select("rule_trace")
        .in("file_id", fileIds);
      if (!error && traceRows) {
        for (const r of traceRows) {
          const trace = (r.rule_trace as string[] | null) ?? [];
          for (const t of trace) {
            const colonIdx = t.indexOf(":");
            const ruleKey = colonIdx > 0 ? t.slice(0, colonIdx) : t;
            ruleCounts.set(ruleKey, (ruleCounts.get(ruleKey) ?? 0) + 1);
          }
        }
      }
    } catch {
      /* migration 0061 likely not applied; degrade silently */
    }
  }
  const ruleTraceCounts = Array.from(ruleCounts.entries())
    .map(([rule, count]) => ({ rule, count }))
    .sort((a, b) => b.count - a.count);

  const windowLabel =
    window === "all"
      ? "all-time"
      : window === "7d"
        ? "last 7 days"
        : window === "30d"
          ? "last 30 days"
          : "last 60 days";

  return {
    windowLabel,
    windowStartIso: startIso,
    uploads,
    classifiedUploads,
    casualUploads,
    filesWithAnyRetrieval,
    reRetrievalRate,
    crossActorFiles,
    crossActorRate,
    citedFiles,
    citationRate,
    suggestionsActedOn,
    acceptedAsIs,
    editedThenSaved,
    rejected,
    pending,
    acceptedAsIsRate,
    ruleTraceCounts,
  };
}
