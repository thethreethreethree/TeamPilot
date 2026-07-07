import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import type { ConversationDissect } from "@/lib/dissect/engine";

/**
 * Data layer for saved "Dissect a Conversation" topics.
 *
 * Owner-private (§A10 — the user's own saved dissections). All writes use the
 * RLS user client and derive company_id / user_id from the authenticated session
 * (never from request input — the tenant/owner keys are server-forced, matching
 * the 0090-0097 authz discipline). Saved topics are append-only (§3.1): there is
 * no update/delete here by design.
 */

export type SavedDissectTopic = {
  id: string;
  title: string;
  sourceText: string;
  summary: string | null;
  dissect: ConversationDissect | null;
  createdAt: string;
};

export type SavedDissectListItem = {
  id: string;
  title: string;
  createdAt: string;
};

/** Persist a topic. Returns the new id, or null if not authenticated / write
 *  failed (caller degrades honestly — never claims a save that didn't land). */
export async function saveDissectTopic(args: {
  title: string;
  sourceText: string;
  summary: string | null;
  dissect: ConversationDissect | null;
}): Promise<string | null> {
  const auth = await getCurrentAuthContext();
  if (!auth) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dissect_topics")
    .insert({
      company_id: auth.companyId,
      user_id: auth.userId,
      title: args.title.slice(0, 200) || "Untitled dissection",
      source_text: args.sourceText,
      summary: args.summary,
      dissect: args.dissect,
    })
    .select("id")
    .single();
  if (error || !data) {
    // §3.4: the caller shows the user a visible "couldn't save" — but the SERVER
    // must record WHY, or a real failure (RLS, constraint, or migration 0097 not
    // applied) is undiagnosable. Team Chat outage lesson (2026-07-03).
    // eslint-disable-next-line no-console
    console.error(
      `[dissect.saveDissectTopic] ${isMissingTable(error) ? "dissect_topics missing — migration 0097 not applied" : "insert failed"}: ${error?.message ?? "no row"}`
    );
    return null;
  }
  return data.id as string;
}

/** A missing relation means migration 0097 hasn't been applied yet — an EXPECTED,
 *  recoverable state (the feature degrades to "no saved topics"), distinct from a
 *  real query failure. Distinguishing the two is the "live-error vs live-empty"
 *  discipline from the 2026-07-03 Team Chat outage. */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === "42P01" || error?.code === "PGRST205";
}

/** List the caller's saved topics (newest first). RLS scopes to the owner. */
export async function listDissectTopics(): Promise<SavedDissectListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dissect_topics")
    .select("id, title, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    // Return [] either way (the surface stays up, analyze still works), but a REAL
    // error must be diagnosable — never silently indistinguishable from "no saved
    // topics yet". Live-error vs live-empty (Team Chat outage, 2026-07-03 / §3.4).
    // eslint-disable-next-line no-console
    console.error(
      `[dissect.listDissectTopics] ${isMissingTable(error) ? "dissect_topics missing — migration 0097 not applied" : "query failed"}: ${error.message}`
    );
    return [];
  }
  if (!data) return [];
  return data.map((r) => ({
    id: r.id as string,
    title: (r.title as string) ?? "Untitled dissection",
    createdAt: r.created_at as string,
  }));
}

/** Load one saved topic. RLS returns null for anything not owned by the caller. */
export async function getDissectTopic(
  id: string
): Promise<SavedDissectTopic | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dissect_topics")
    .select("id, title, source_text, summary, dissect, created_at")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    // A genuine error is logged; a plain not-found (data null, no error — the RLS
    // result for a topic that isn't the caller's) returns null SILENTLY, because
    // that's an expected 404, not a failure. Live-error vs live-empty (§3.4).
    // eslint-disable-next-line no-console
    console.error(
      `[dissect.getDissectTopic] ${isMissingTable(error) ? "dissect_topics missing — migration 0097 not applied" : "query failed"} id=${id}: ${error.message}`
    );
    return null;
  }
  if (!data) return null;
  return {
    id: data.id as string,
    title: data.title as string,
    sourceText: data.source_text as string,
    summary: (data.summary as string | null) ?? null,
    dissect: (data.dissect as ConversationDissect | null) ?? null,
    createdAt: data.created_at as string,
  };
}
