import "server-only";
import { dissectCoachV5 } from "@/lib/claude";
import { getCurrentSalesCorpus, type SalesSession } from "@/lib/data/salesCoach";
import {
  DEFAULT_METHODOLOGY,
  sessionContextLines,
} from "@/lib/coach/v5/prepShared";

/**
 * Live Sales Coach — "pre-knock prep" (Live Coach Step 3, the buildable
 * intent item). A SHORT briefing for the 30 seconds before the rep knocks /
 * dials, built from THIS session's Phase 2 capture (offer / approach /
 * territory / context) + the editable methodology corpus.
 *
 * §3.3 — it PREPARES the rep; it does not script them into a robotic pitch.
 * It composes forward on Phase 2 (uses the captured offer) and reuses the
 * Sales-Coach LLM path (§A21, dissectCoachV5 — control-exempt), so it does
 * NOT touch the still-untested live turn engine.
 *
 * Never throws; on failure / suppression / no signal it returns the honest
 * empty state (§3.4) — no fabricated briefing.
 */

export type PrepObjection = { objection: string; reframe: string };
export type SalesPrep = {
  hasContent: boolean;
  opening: string;
  likelyObjections: PrepObjection[];
  keyValue: string;
  // F3 (§3.4) — true when generation FAILED (error/parse), so the UI can
  // distinguish "couldn't build the prep" from "nothing to prep from".
  failed: boolean;
};

const EMPTY_PREP: SalesPrep = {
  hasContent: false,
  opening: "",
  likelyObjections: [],
  keyValue: "",
  failed: false,
};


function buildPrepSystemPrompt(
  corpus?: string | null,
  product?: string | null
): string {
  const methodology = corpus?.trim() ? corpus.trim() : DEFAULT_METHODOLOGY;
  const productBlock = product?.trim()
    ? `\n\nPRODUCT / OFFER DETAILS (what the rep is actually selling — ground the prep in THIS; NEVER invent product specifics beyond it):\n${product.trim()}`
    : `\n\n(No product details on file — prep from the methodology + the session's offer field only; do NOT invent product specifics.)`;
  return `You are a sales coach giving a rep a SHORT pre-knock briefing — the
30 seconds before they knock or dial. You PREPARE them; you do NOT script
them (§3.3 — guide, never overtake). Reason FROM the methodology below and
adapt to THIS call's specifics.

${methodology}${productBlock}

Give exactly:
- opening: ONE natural way to open for this offer/context — a direction, not
  a rigid line to recite.
- likelyObjections: the 2-3 objections most likely for THIS offer, each with
  a one-line reframe grounded in the methodology.
- keyValue: the single most important value point to land.

Keep every line short — the rep is about to knock. NEVER fabricate specifics
you don't have; if the offer is unknown, prep from the methodology generally.

OUTPUT — respond with ONLY this JSON:
{
  "opening": "one short line",
  "likelyObjections": [{ "objection": "…", "reframe": "…" }],
  "keyValue": "one short line"
}`;
}

function buildPrepUserMessage(s: SalesSession): string {
  return `This call:
${sessionContextLines(s).join("\n")}

Give the pre-knock briefing. JSON only.`;
}

function parsePrep(text: string): SalesPrep | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const opening = typeof o.opening === "string" ? o.opening.trim() : "";
  const keyValue = typeof o.keyValue === "string" ? o.keyValue.trim() : "";
  const objections: PrepObjection[] = Array.isArray(o.likelyObjections)
    ? o.likelyObjections
        .map((x) => {
          if (typeof x !== "object" || x === null) return null;
          const r = x as Record<string, unknown>;
          const objection =
            typeof r.objection === "string" ? r.objection.trim() : "";
          const reframe = typeof r.reframe === "string" ? r.reframe.trim() : "";
          return objection && reframe ? { objection, reframe } : null;
        })
        .filter((x): x is PrepObjection => x !== null)
    : [];
  const hasContent = Boolean(opening || keyValue || objections.length > 0);
  return {
    hasContent,
    opening,
    likelyObjections: objections,
    keyValue,
    failed: false,
  };
}

export async function generatePrep(args: {
  companyId: string;
  session: SalesSession;
}): Promise<SalesPrep> {
  try {
    const [corpus, product] = await Promise.all([
      getCurrentSalesCorpus(args.companyId).catch(() => null),
      getCurrentSalesCorpus(args.companyId, "product").catch(() => null),
    ]);
    const systemPrompt = buildPrepSystemPrompt(corpus?.content, product?.content);
    const userMessage = buildPrepUserMessage(args.session);
    const r = await dissectCoachV5({
      companyId: args.companyId,
      systemPrompt,
      userMessage,
    });
    if (r.suppressed) return EMPTY_PREP;
    // F3 (§3.4) — an unparseable response is a FAILURE, not "nothing to prep".
    return parsePrep(r.text) ?? { ...EMPTY_PREP, failed: true };
  } catch {
    // F3 (§3.4) — a real error, distinct from the honest empty state.
    return { ...EMPTY_PREP, failed: true };
  }
}
