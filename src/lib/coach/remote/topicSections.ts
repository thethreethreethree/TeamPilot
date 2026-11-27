import type { Line } from "./followThrough";

/**
 * Topic sections on a call (Gong F11.11 "call topics on the timeline"; founder picker 2026-11-27: "On request per call").
 * The AI splits ONE call's transcript into consecutive sections, each with a short label for what was being discussed
 * (introductions, needs, pricing, next steps…). Run only when someone asks, once per transcript version, kept as an
 * event on the call (coach.session_topic_sections) — so legal erasure deletes it with the call's other events (0350).
 * The parser accepts only what the transcript supports: sections must cover real lines, in order, without overlap;
 * anything else is dropped rather than guessed.
 */
/** `share`: the section's part of the call, by lines (some uploads have no times). */
export type TopicSection = { label: string; fromSeq: number; toSeq: number; startMs: number | null; endMs: number | null; share: number };

/** Lines given to the AI at most (a long call is read from its start, and the screen says how much). */
export const SECTION_LINES = 1500;
const MAX_SECTIONS = 10;

export const TOPIC_SECTIONS_SYSTEM = `You split the transcript of ONE sales call into its topic sections, as JSON only.

Return exactly: {"sections": [{"label": "...", "from": <line number>, "to": <line number>}]}

- Sections are consecutive and in order: the first starts at the first line, each next one starts right after the
  previous one ends, the last ends at the last line. 3 to 10 sections; fewer for a short call.
- "label" names what was being discussed, in 1 to 4 plain words ("Introductions", "Current setup", "Pricing",
  "Objections", "Next steps"). Never a person's name, a company's name, a number or a quote from the call.
- Use the [numbers] shown before each line. Never invent a line number.`;

// Letters only (review 2026-11-27): no digits, so no figures, dates or prices; names rest on the prompt.
const LABEL = /^[\p{L}][\p{L} '&/,-]{0,39}$/u;

/** The sections the AI returned, checked against the call's lines. Null when fewer than two usable ones came back. Pure. */
export function parseSections(text: string, lines: Line[]): TopicSection[] | null {
  let o: unknown;
  try {
    o = JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    return null;
  }
  const raw = (o as { sections?: unknown })?.sections;
  if (!Array.isArray(raw) || !lines.length) return null;
  const at = new Map(lines.map((l, i) => [l.seq, i]));
  const kept: Array<{ label: string; from: number; to: number }> = [];
  let next = 0; // index of the line the next section must start at: no gaps, no overlaps
  for (const s of raw.slice(0, MAX_SECTIONS)) {
    const x = s as { label?: unknown; from?: unknown; to?: unknown };
    const label = typeof x.label === "string" ? x.label.trim().replace(/\s+/g, " ") : "";
    const from = at.get(Number(x.from));
    const to = at.get(Number(x.to));
    // The first section that breaks the rules ends the read: what came before is kept, nothing after is guessed.
    if (!LABEL.test(label) || from === undefined || to === undefined || to < from || from !== next) break;
    kept.push({ label, from, to });
    next = to + 1;
  }
  if (kept.length < 2) return null;
  // Shares are of every line sent (review 2026-11-27): a split that stops short doesn't read as the whole call.
  const sent = lines.length;
  return kept.map((k) => ({
    label: k.label,
    fromSeq: lines[k.from]!.seq,
    toSeq: lines[k.to]!.seq,
    startMs: lines[k.from]!.atMs,
    endMs: lines[k.to]!.atMs,
    share: (k.to - k.from + 1) / sent,
  }));
}

/** How many of the lines sent the sections cover (from the first line to the last section's end). Pure. */
export function coveredLines(sections: TopicSection[], lines: Line[]): number {
  const last = sections.at(-1);
  if (!last) return 0;
  return lines.findIndex((l) => l.seq === last.toSeq) + 1;
}

