/**
 * The deal brief (revenue Phase 3c, 0374; Gong F20.3 Briefs tab, F20.4 AI-suggested deal updates). One read of a
 * deal's latest calls: where it stands, what has happened, the risks the customer raised, and the next steps — each
 * point resting on transcript lines that exist on those calls. A next step can become a to-do in one click (the
 * prospect's existing "todo" action), which is the accept of Gong's suggested update.
 *
 * HONESTY (the brief's discipline): a point with no cited line is dropped; a brief with no points at all is "the calls
 * don't show enough yet", never filler. Stored once per set of calls and their transcript versions, so the page shows
 * the same read every time and a new call or a corrected transcript makes it stale. Pure, so it is tested.
 */
import type { CallLines, Cite } from "./playbook";

export type Point = { text: string; cites: Cite[] };
export type DealBriefBody = { standing: string; happened: Point[]; risks: Point[]; next: Point[] };

export const DEAL_BRIEF_SYSTEM = `You brief a sales manager on one deal, using only the transcripts of its calls. Answer as JSON only.

Return exactly:
{"standing": "...", "happened": [P], "risks": [P], "next": [P]}
where P is {"text": "...", "cites": [{"call": <call number>, "seq": <line number>}]}

- "standing": one plain sentence on where the deal stands now.
- "happened": what was agreed, learned or decided, newest first, at most 5.
- "risks": concerns, objections or blockers the customer raised, at most 4.
- "next": the next steps the rep should take, each a short imperative to-do (under 15 words), at most 4.
- Every point cites the lines it rests on: the call's number (C1, C2, ... as given) and the line's [number].
  A point with no line is not a point. Never guess, assume or invent. If the calls don't show something, leave it out.`;

const MAX = { happened: 5, risks: 4, next: 4 } as const;

function points(raw: unknown, calls: CallLines[], max: number): Point[] {
  const lineAt = calls.map((c) => new Map(c.lines.map((l) => [l.seq, l.atMs])));
  const out: Point[] = [];
  for (const x of Array.isArray(raw) ? raw : []) {
    const o = (x ?? {}) as { text?: unknown; cites?: unknown };
    const text = typeof o.text === "string" ? o.text.trim().slice(0, 300) : "";
    if (!text) continue;
    const cites: Cite[] = [];
    for (const c of Array.isArray(o.cites) ? o.cites : []) {
      const n = Number(String((c as { call?: unknown })?.call ?? "").replace(/^C/i, ""));
      const seq = Number((c as { seq?: unknown })?.seq);
      const call = calls[n - 1];
      if (!call || !Number.isInteger(seq) || !lineAt[n - 1]!.has(seq)) continue;
      if (!cites.some((k) => k.sessionId === call.sessionId && k.seq === seq)) cites.push({ sessionId: call.sessionId, seq, atMs: lineAt[n - 1]!.get(seq) ?? null });
    }
    if (cites.length) out.push({ text, cites: cites.slice(0, 4) });
    if (out.length >= max) break;
  }
  return out;
}

/** The model's JSON → a brief whose every point cites a real line. null when the reply isn't usable (not stored). */
export function parseDealBrief(raw: string, calls: CallLines[]): DealBriefBody | null {
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!j || typeof j !== "object" || !("happened" in j || "risks" in j || "next" in j)) return null;
  const body = {
    standing: typeof j.standing === "string" ? j.standing.trim().slice(0, 300) : "",
    happened: points(j.happened, calls, MAX.happened),
    risks: points(j.risks, calls, MAX.risks),
    next: points(j.next, calls, MAX.next),
  };
  // A standing line with nothing under it would be an unsupported claim: kept only when some point backs the brief.
  if (!body.happened.length && !body.risks.length && !body.next.length) body.standing = "";
  return body;
}

/** The identity of the calls a brief was read from: which calls, at which transcript version. A change makes it stale. */
/** The calls a stored basis names (basisKey's "session:version" list). Pure. */
export function basisSessions(basis: string): string[] {
  return [...new Set(basis.split(",").map((x) => x.split(":")[0]!.trim()).filter(Boolean))];
}

export function basisKey(calls: Array<{ sessionId: string; version: number }>): string {
  return calls.map((c) => `${c.sessionId}:${c.version}`).sort().join(",");
}
