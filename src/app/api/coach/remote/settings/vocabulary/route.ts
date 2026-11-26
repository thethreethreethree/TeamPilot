import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { recordAudit } from "@/lib/audit/recordAudit";
import { MAX_TERMS, normaliseCorrections, normaliseKeyterms, VocabularyError, type Correction } from "@/lib/coach/remote/vocabulary";

/**
 * /api/coach/remote/settings/vocabulary — the company's transcription vocabulary (Gong F8.9, 0306).
 * GET — anyone in the company: the current list and `canManage` (ctx.isAdmin, the role set of 0284's admin screens).
 * PUT — company admins: { terms: string[], corrections?: [{ term, heard[] }] } appends a row (a change never overwrites,
 *       §3.1) and an audit row. corrections (0354) are what each term is heard as; each must name a term in the list.
 *       An empty list turns it off. Using it adds a 20% transcription surcharge, which the screen states.
 */
const MISSING = new Set(["PGRST205", "42P01"]);
const NOT_APPLIED = "Vocabulary is waiting on database migration 0306.";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-vocabulary-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data, error } = await createAdminClient()
    .from("company_stt_vocabulary")
    .select("*")
    .eq("company_id", ctx.companyId)
    .order("id", { ascending: false })
    .limit(1);
  const base = { canManage: ctx.isAdmin, max: MAX_TERMS };
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ ...base, terms: [], notReady: NOT_APPLIED });
    console.error(`[vocabulary] read failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load the vocabulary." }, { status: 500 });
  }
  // select("*"): before 0354 the row has no corrections column, and a named column would fail the whole read.
  const row = (data ?? [])[0] as { terms: string[]; corrections?: Correction[]; created_at: string } | undefined;
  return NextResponse.json({ ...base, terms: row?.terms ?? [], corrections: Array.isArray(row?.corrections) ? row!.corrections : [], setAt: row?.created_at ?? null });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "remote-vocabulary-write", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a company admin can change the vocabulary." }, { status: 403 });
  let b: { terms?: unknown; corrections?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  if (!Array.isArray(b.terms) || b.terms.some((t) => typeof t !== "string")) {
    return NextResponse.json({ error: "Send the terms as a list of words or short phrases." }, { status: 400 });
  }
  let terms: string[];
  let corrections: Correction[];
  try {
    terms = normaliseKeyterms(b.terms as string[]);
    const raw = Array.isArray(b.corrections) ? (b.corrections as Array<{ term?: unknown; heard?: unknown }>) : [];
    if (raw.some((c) => typeof c.term !== "string" || !Array.isArray(c.heard) || (c.heard as unknown[]).some((h) => typeof h !== "string")))
      return NextResponse.json({ error: "Send each correction as a term and the list of what it's heard as." }, { status: 400 });
    const known = new Map(terms.map((t) => [t.toLowerCase(), t]));
    const missing = raw.find((c) => !known.has(String(c.term).trim().replace(/\s+/g, " ").toLowerCase()));
    if (missing) return NextResponse.json({ error: `"${String(missing.term)}" isn't in the vocabulary — add it as a term first.` }, { status: 400 });
    corrections = normaliseCorrections(raw.map((c) => ({ term: known.get(String(c.term).trim().replace(/\s+/g, " ").toLowerCase())!, heard: c.heard as string[] })));
  } catch (e) {
    if (e instanceof VocabularyError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const admin = createAdminClient();
  // corrections only when there are any: a pre-0354 table has no such column, and terms alone must still save.
  const { error } = await admin
    .from("company_stt_vocabulary")
    .insert({ company_id: ctx.companyId, terms, set_by: ctx.userId, ...(corrections.length ? { corrections } : {}) });
  if (error) {
    if (MISSING.has(String(error.code))) return NextResponse.json({ error: NOT_APPLIED }, { status: 503 });
    console.error(`[vocabulary] write failed company=${ctx.companyId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save the vocabulary." }, { status: 500 });
  }
  await recordAudit(admin, {
    companyId: ctx.companyId,
    actorId: ctx.userId,
    action: "vocabulary.set",
    objectType: "company",
    objectId: ctx.companyId,
    meta: { count: terms.length, corrections: corrections.reduce((n, c) => n + c.heard.length, 0) },
  });
  return NextResponse.json({ terms, corrections });
}
