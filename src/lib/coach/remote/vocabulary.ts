import type { SupabaseClient } from "@supabase/supabase-js";
import { REDACTED } from "./redact";

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

/**
 * Known mis-hearings (0354, Gong F8.9): for a term, what speech-to-text writes instead — "Spectrum" heard as "spec
 * trum", "spektrum". A company admin lists them; every transcript line is stored with them replaced by the term, so
 * search and trackers find the name. Whole words or phrases only, any capitalisation. A person's typed correction of a
 * line is stored as they typed it. Lines already stored stay as they are.
 */
export type Correction = { term: string; heard: string[] };
export const MAX_HEARD_PER_TERM = 10;

/**
 * The settings text, one line per term: "Spectrum" (a term) or "Spectrum = spec trum, spektrum" (a term and what it's
 * heard as). Returns the terms (validated by normaliseKeyterms) and the corrections. Throws VocabularyError.
 */
export function parseVocabularyLines(lines: string[]): { terms: string[]; corrections: Correction[] } {
  const rawTerms: string[] = [];
  const heardFor = new Map<string, string[]>();
  for (const line of lines) {
    const [left, ...rest] = line.split("=");
    const term = (left ?? "").trim().replace(/\s+/g, " ");
    if (!term) {
      if (rest.join("=").trim()) throw new VocabularyError(`"${line.trim().slice(0, 40)}" has no name before "=".`);
      continue;
    }
    rawTerms.push(term);
    if (rest.length) heardFor.set(term.toLowerCase(), [...(heardFor.get(term.toLowerCase()) ?? []), ...rest.join("=").split(",")]);
  }
  const terms = normaliseKeyterms(rawTerms);
  return { terms, corrections: normaliseCorrections(terms.map((term) => ({ term, heard: heardFor.get(term.toLowerCase()) ?? [] })), terms) };
}

/** Spoken or written numbers only ("one one", "nine hundred", "4111"): never a mis-hearing — it would rewrite numbers people said. */
const NUMBER_ONLY = /^(?:(?:\d+|zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|double|triple)[\s,.-]*)+$/i;

/**
 * Each term's mis-hearings: trimmed, ≤50 characters and ≤5 words, ≤10 per term; entries for the same term merged.
 * Refused (review 2026-11-26, each one rewrote a correct line): a mis-hearing that is a whole-word part of any term in
 * the list ("Spectrum Internet = spectrum" turned every correct mention into "Spectrum Internet Internet"), one made of
 * numbers only, one listed for two terms, and "=" or "," anywhere (they can't survive the settings text).
 */
export function normaliseCorrections(input: Correction[], allTerms: string[] = input.map((c) => c.term)): Correction[] {
  const byTerm = new Map<string, Correction>();
  const claimed = new Map<string, string>(); // heard (lowercase) → the term it maps to
  const wholeWordIn = (needle: string, hay: string) =>
    new RegExp(`(?<![\\p{L}\\p{N}])${needle.split(" ").map(escapeRe).join("\\s+")}(?![\\p{L}\\p{N}])`, "iu").test(hay);
  for (const c of input) {
    if (/[=,]/.test(c.term)) throw new VocabularyError(`"${c.term}" can't contain "=" or ",".`);
    const entry = byTerm.get(c.term.toLowerCase()) ?? { term: c.term, heard: [] };
    for (const raw of c.heard) {
      const h = raw.trim().replace(/\s+/g, " ");
      if (!h) continue;
      if (/[=,]/.test(h)) throw new VocabularyError(`"${h}" can't contain "=" or ",".`);
      if (/[<>{}[\]\\]/.test(h)) throw new VocabularyError(`"${h}" contains a character that can't be used (< > { } [ ] \\).`);
      if (h.length > 50) throw new VocabularyError(`"${h.slice(0, 30)}…" is longer than 50 characters.`);
      if (h.split(" ").length > 5) throw new VocabularyError(`"${h}" has more than 5 words.`);
      if (NUMBER_ONLY.test(h)) throw new VocabularyError(`"${h}" is only numbers — it would change numbers people said.`);
      // Corrections run after number redaction, so one must not match inside its marker.
      if (wholeWordIn(h, REDACTED)) throw new VocabularyError(`"${h}" can't be used — it's part of "${REDACTED}".`);
      const k = h.toLowerCase();
      if (entry.heard.some((x) => x.toLowerCase() === k)) continue;
      const inTerm = allTerms.find((t) => wholeWordIn(h, t));
      if (inTerm) throw new VocabularyError(`"${h}" is part of "${inTerm}" — it would change "${inTerm}" when it's heard right.`);
      const other = claimed.get(k);
      if (other && other.toLowerCase() !== c.term.toLowerCase()) throw new VocabularyError(`"${h}" is listed for both "${other}" and "${c.term}".`);
      claimed.set(k, c.term);
      entry.heard.push(h);
    }
    if (entry.heard.length > MAX_HEARD_PER_TERM) throw new VocabularyError(`Keep it to ${MAX_HEARD_PER_TERM} mis-hearings for "${c.term}".`);
    byTerm.set(c.term.toLowerCase(), entry);
  }
  return [...byTerm.values()].filter((c) => c.heard.length > 0);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

type Compiled = { re: RegExp; termFor: Map<string, string> } | null;
const compiledFor = new WeakMap<Correction[], Compiled>();
const keyOf = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

/** One pattern for the whole list, compiled once per list (it's cached with the list for a session). */
function compile(corrections: Correction[]): Compiled {
  const hit = compiledFor.get(corrections);
  if (hit !== undefined) return hit;
  const termFor = new Map<string, string>();
  for (const c of corrections) for (const h of c.heard) termFor.set(keyOf(h), c.term);
  const alts = [...termFor.keys()].sort((a, b) => b.length - a.length).map((h) => h.split(" ").map(escapeRe).join("\\s+"));
  const out: Compiled = alts.length ? { re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${alts.join("|")})(?![\\p{L}\\p{N}])`, "giu"), termFor } : null;
  compiledFor.set(corrections, out);
  return out;
}

/**
 * The line with each listed mis-hearing replaced by its term — whole words or phrases, any capitalisation, longest
 * first, in ONE pass (review 2026-11-26: replacing one after another let a later, shorter mis-hearing match inside a
 * term just put in). The term is inserted literally ("$" is not a pattern). Pure.
 */
export function applyCorrections(text: string, corrections: Correction[]): string {
  if (!text || corrections.length === 0) return text;
  const c = compile(corrections);
  if (!c) return text;
  return text.replace(c.re, (m) => c.termFor.get(keyOf(m)) ?? m);
}

/**
 * The company's current corrections (latest row); [] when none are set; null when they couldn't be read (so a caller
 * doesn't cache a failure as "none"). Never throws: a vocabulary problem must not stop a line from being stored.
 */
export async function readCompanyCorrections(db: SupabaseClient, companyId: string): Promise<Correction[] | null> {
  try {
    const { data, error } = await db
      .from("company_stt_vocabulary")
      .select("corrections")
      .eq("company_id", companyId)
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      // A table or column not there yet means "none set"; anything else is a failure to read.
      if (["PGRST205", "42P01", "42703"].includes(String(error.code))) return [];
      console.error(`[vocabulary] corrections read failed company=${companyId}: ${error.message}`);
      return null;
    }
    const list = (data as { corrections?: unknown } | null)?.corrections;
    return Array.isArray(list)
      ? (list as Array<{ term?: unknown; heard?: unknown }>)
          .filter((c) => typeof c.term === "string" && Array.isArray(c.heard))
          .map((c) => ({ term: c.term as string, heard: (c.heard as unknown[]).filter((h): h is string => typeof h === "string") }))
      : [];
  } catch (e) {
    console.error(`[vocabulary] corrections read threw company=${companyId}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
