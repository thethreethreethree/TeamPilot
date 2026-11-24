/**
 * Smart trackers (2026-11-23, migration 0329; ledger F11.8; founder picker "One AI read per call"). Pure parts:
 * validating examples, the one prompt that checks a call against ALL the company's smart trackers, and reading the
 * answer strictly — a hit counts only for a line that exists, on the tracker's side, citing one of its examples. The
 * model can point at lines; it can't invent one (§3.4).
 */
import { TrackerError } from "./trackers";

export const MAX_SMART_TRACKERS = 10;
export const MAX_EXAMPLES = 10;

export function cleanExamples(raw: string[]): string[] {
  const out = [...new Set(raw.map((e) => e.trim().replace(/\s+/g, " ")).filter(Boolean))];
  if (out.length === 0) throw new TrackerError("A smart tracker needs at least one example sentence");
  if (out.length > MAX_EXAMPLES) throw new TrackerError(`A smart tracker holds up to ${MAX_EXAMPLES} examples`);
  for (const e of out) if (e.length < 5 || e.length > 200) throw new TrackerError("Each example must be 5 to 200 characters");
  return out;
}

export type SmartTracker = { id: string; name: string; examples: string[]; side: "rep" | "customer" | "any" };
export type Line = { seq: number; speaker: "rep" | "customer" | "unknown"; text: string };
export type SmartHit = { trackerId: string; seq: number; speaker: Line["speaker"]; example: string };

export const SMART_SYSTEM = `You read a sales call transcript and find lines where someone expresses the same idea as one of a team's example sentences. The words may be completely different; the meaning must be the same.

Rules:
- Only report a line that clearly says the same thing as an example. When unsure, leave it out.
- Respect each tracker's side: "customer" = only the customer's lines, "rep" = only the rep's lines, "any" = either.
- Use only line numbers that appear in the transcript, and only tracker and example numbers that appear in the list.

Answer only JSON: {"hits":[{"tracker":1,"line":12,"example":2}]} (an empty list when nothing matches).`;

export function smartPrompt(trackers: SmartTracker[], lines: Line[]): string {
  const list = trackers.map((t, i) => `T${i + 1} "${t.name}" (side: ${t.side})\n${t.examples.map((e, j) => `  E${j + 1}: ${e}`).join("\n")}`).join("\n");
  const call = lines.map((l) => `[${l.seq}] ${l.speaker === "rep" ? "Rep" : l.speaker === "customer" ? "Customer" : "Unknown"}: ${l.text}`).join("\n");
  return `Trackers:\n${list}\n\nTranscript:\n${call}`;
}

export function parseSmartHits(raw: string, trackers: SmartTracker[], lines: Line[]): SmartHit[] | null {
  let j: unknown;
  try {
    j = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  const hits = j && typeof j === "object" && Array.isArray((j as { hits?: unknown }).hits) ? (j as { hits: unknown[] }).hits : null;
  if (!hits) return null;
  const bySeq = new Map(lines.map((l) => [l.seq, l]));
  const seen = new Set<string>();
  const out: SmartHit[] = [];
  for (const h of hits) {
    if (!h || typeof h !== "object") continue;
    const t = trackers[Number((h as { tracker?: unknown }).tracker) - 1];
    const line = bySeq.get(Number((h as { line?: unknown }).line));
    if (!t || !line) continue;
    const example = t.examples[Number((h as { example?: unknown }).example) - 1] ?? t.examples[0]!;
    if (t.side !== "any" && line.speaker !== t.side) continue;
    const k = `${t.id}|${line.seq}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ trackerId: t.id, seq: line.seq, speaker: line.speaker, example });
  }
  return out;
}
