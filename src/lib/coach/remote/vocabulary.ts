import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * A company's transcription vocabulary (Gong F8.9, 0306): names speech-to-text should recognise — products, plans,
 * competitors. Sent to ElevenLabs as `keyterms` (verified live 2026-11-22: repeated form fields for batch, repeated
 * query params for realtime). Opt-in: an empty list means off, and no 20% surcharge.
 *
 * The provider's rules, enforced here so a save never produces a list the provider would refuse at transcription
 * time (which would fail every call): ≤50 characters, ≤5 words, none of < > { } [ ] \. We also cap the list at 100 —
 * above 100 the provider bills a 20-second minimum per request.
 */
export const MAX_TERMS = 100;
export class VocabularyError extends Error {}

export function normaliseKeyterms(input: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of input) {
    const t = raw.trim().replace(/\s+/g, " ");
    if (!t) continue;
    if (t.length > 50) throw new VocabularyError(`"${t.slice(0, 30)}…" is longer than 50 characters.`);
    if (t.split(" ").length > 5) throw new VocabularyError(`"${t}" has more than 5 words.`);
    if (/[<>{}[\]\\]/.test(t)) throw new VocabularyError(`"${t}" contains a character transcription can't use (< > { } [ ] \\).`);
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  if (out.length > MAX_TERMS) throw new VocabularyError(`Keep it to ${MAX_TERMS} terms or fewer.`);
  return out;
}

/**
 * The company's current list (latest row), or [] when none is set, the table is not there yet, or the read fails —
 * transcription must never fail because the vocabulary could not be read; it just runs without it (logged).
 */
export async function readCompanyKeyterms(db: SupabaseClient, companyId: string): Promise<string[]> {
  // Never throws: a vocabulary problem (a network blip, a client without this table) must not stop a call from being
  // transcribed or a live socket from opening — it runs without the list instead, and the cause is logged.
  try {
    const { data, error } = await db
      .from("company_stt_vocabulary")
      .select("terms")
      .eq("company_id", companyId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      if (error.code !== "PGRST205" && error.code !== "42P01") console.error(`[vocabulary] read failed company=${companyId}: ${error.message}`);
      return [];
    }
    return Array.isArray(data?.terms) ? (data!.terms as string[]) : [];
  } catch (e) {
    console.error(`[vocabulary] read threw company=${companyId}: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
}

/** Realtime socket query string for the list: repeated `keyterms=` (the encoding the socket accepts). */
export function keytermsQuery(terms: string[]): string {
  return terms.map((t) => `&keyterms=${encodeURIComponent(t)}`).join("");
}
