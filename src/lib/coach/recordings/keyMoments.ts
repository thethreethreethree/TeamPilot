import { ELEMENTS_BY_ID, BONUSES_BY_ID, VIOLATIONS_BY_ID, type Grade } from "../pitchScore/rubric";

/**
 * The moments in a recording worth jumping to — guide Step 4, items 3 and 4.
 *
 * The waveform markers and the "Key moments · click to jump" list are the SAME set rendered
 * twice; the board draws them stacked and a manager reads them together, so they are derived
 * once here. Two derivations would let the strip show eight marks above a list of seven.
 *
 * FOUR KINDS, and the guide assigns the colours: missed elements and violations are red, Pattern
 * Interrupt moments brown, bonuses green, manager comments blue. The kind is returned; the colour
 * is the surface's business.
 *
 * WHY `atSeconds` IS NULLABLE AND MUST STAY THAT WAY. `pitch_score_elements.timestamp_s` and
 * `pitch_score_events.timestamp_s` are both nullable, and the scorer has a `timestampsUnavailable`
 * path — a pitch scored from a transcript with no timing has grades and no positions. Coercing a
 * null to 0 would stack every unplaced moment at the start of the waveform, which renders as a
 * catastrophic opening and is purely an artefact. A moment with no position is still a real
 * finding; it just cannot be pointed at, and `placeable` is how a surface tells the difference.
 */

export type MomentKind = "missed" | "violation" | "bonus" | "pattern" | "comment";

export type KeyMoment = {
  /** Stable within one pitch — the row id, so a click can seek and a marker can be keyed. */
  id: string;
  kind: MomentKind;
  /** Seconds into the recording, or null when the scorer had no timing. */
  atSeconds: number | null;
  /** The rubric label, or the comment's author line. */
  label: string;
  /** What the AI heard, or the comment body. Shown under the label. */
  detail: string | null;
  /**
   * Points this moment moved the score by. Negative for a miss or a violation, positive for a
   * bonus, null where the question does not apply (a comment, a pattern moment).
   */
  points: number | null;
};

export type MomentSource = {
  elements: ReadonlyArray<{
    id: string;
    elementId: string;
    grade: Grade;
    points: number;
    timestampS: number | null;
    evidence: string | null;
  }>;
  events: ReadonlyArray<{
    id: string;
    type: "bonus" | "violation";
    itemId: string;
    points: number;
    timestampS: number | null;
    evidence: string | null;
  }>;
  /** Items this rep has an open pattern on — the brown markers. */
  patternItemIds?: ReadonlyArray<string>;
  comments?: ReadonlyArray<{
    id: string;
    timestampS: number;
    body: string;
    authorLabel: string;
  }>;
};

/**
 * Build the marker set for one recording.
 *
 * ONLY MISSED ELEMENTS, not every graded one. Thirty green marks and three red ones is the same
 * information as three red ones with the rest of the bar empty, and it is much harder to read —
 * the board's own strip shows flagged moments, not a mark per rubric item. A Partial is not
 * flagged either: it is on the Pitch detail with its half-points, and a manager scrubbing for
 * problems is looking for what did not land at all.
 *
 * Sorted by time with unplaced moments LAST, so the list reads in playback order and the ones
 * that cannot be jumped to do not interrupt it.
 */
export function keyMoments(src: MomentSource): KeyMoment[] {
  const patternItems = new Set(src.patternItemIds ?? []);
  const out: KeyMoment[] = [];

  for (const e of src.elements) {
    if (e.grade !== "missed") continue;
    const rubric = ELEMENTS_BY_ID.get(e.elementId);
    out.push({
      id: e.id,
      // A missed element the rep has an open pattern on is a PATTERN moment, not just a miss.
      // The distinction is the whole point of the brown marker: one is a bad moment, the other is
      // the fifth time this month, and a manager listens to them differently.
      kind: patternItems.has(e.elementId) ? "pattern" : "missed",
      atSeconds: e.timestampS,
      label: rubric?.label ?? e.elementId,
      detail: e.evidence,
      // What it cost: the element's full value, since a miss scores zero.
      points: rubric ? -rubric.points : null,
    });
  }

  for (const ev of src.events) {
    const rubric =
      ev.type === "bonus" ? BONUSES_BY_ID.get(ev.itemId) : VIOLATIONS_BY_ID.get(ev.itemId);
    out.push({
      id: ev.id,
      kind: ev.type,
      atSeconds: ev.timestampS,
      label: rubric?.label ?? ev.itemId,
      detail: ev.evidence,
      // Violations are stored as a positive deduction; on a timeline they read as what they took.
      points: ev.type === "violation" ? -Math.abs(ev.points) : Math.abs(ev.points),
    });
  }

  for (const c of src.comments ?? []) {
    out.push({
      id: c.id,
      kind: "comment",
      atSeconds: c.timestampS,
      label: c.authorLabel,
      detail: c.body,
      points: null,
    });
  }

  return out.sort((a, b) => {
    if (a.atSeconds === null && b.atSeconds === null) return a.id.localeCompare(b.id);
    if (a.atSeconds === null) return 1;
    if (b.atSeconds === null) return -1;
    return a.atSeconds - b.atSeconds || a.id.localeCompare(b.id);
  });
}

/**
 * How many moments can actually be pointed at, and how many exist.
 *
 * Both numbers, always. A recording with eight flagged moments of which three have timings is not
 * a recording with three flagged moments, and a strip that shows three while the score reflects
 * eight is the quiet kind of wrong — everything on screen agrees with itself and disagrees with
 * the pitch.
 */
export function momentCoverage(moments: readonly KeyMoment[]) {
  const placeable = moments.filter((m) => m.atSeconds !== null).length;
  return { total: moments.length, placeable, unplaced: moments.length - placeable };
}

/** One diarised, timed line of a recording. From `coaching_transcript_segments`. */
export type TimedLine = {
  speaker: "agent" | "customer" | "unknown";
  text: string;
  /** Seconds from the start of the recording, or null when the pipeline gave no wall clock. */
  atSeconds: number | null;
};

/**
 * Turn a session's transcript segments into lines positioned against the recording.
 *
 * FOUNDER RULING 2026-09-22: "add timed transcript segments to the schema first", rather than
 * ship an approximate window. The schema already had them — `coaching_transcript_segments`
 * carries `speaker`, `text`, `seq` and `spoken_at`, and `pitch_scores.transcript` is a flattened
 * copy. So the ruling is satisfied by reading what exists instead of adding a table, which is the
 * fourth time today the build guide named something the product already had under another name.
 *
 * `spoken_at` is a WALL CLOCK, and a player needs an offset. The conversion needs the recording's
 * start, and a segment whose clock is missing keeps `atSeconds: null` for the same reason a
 * marker does — a line placed at 0 because nobody timed it is worse than a line placed nowhere.
 *
 * Order is by `seq`, never by time: seq is monotonic and assigned by the feed, whereas two
 * segments can share a `spoken_at` or arrive out of order, and a transcript reordered by
 * timestamp reads as a different conversation.
 */
export function timedLines(
  segments: ReadonlyArray<{ speaker: string; text: string; seq: number; spokenAt: string | null }>,
  recordingStartedAt: string | null
): TimedLine[] {
  const start = recordingStartedAt ? Date.parse(recordingStartedAt) : NaN;
  return [...segments]
    .sort((a, b) => a.seq - b.seq)
    .map((sgm) => {
      const spoken = sgm.spokenAt ? Date.parse(sgm.spokenAt) : NaN;
      const usable = Number.isFinite(start) && Number.isFinite(spoken) && spoken >= start;
      return {
        speaker: (sgm.speaker === "agent" || sgm.speaker === "customer" ? sgm.speaker : "unknown") as TimedLine["speaker"],
        text: sgm.text,
        atSeconds: usable ? Math.round((spoken - start) / 1000) : null,
      };
    });
}

/**
 * The lines around a moment — guide Step 4 item 5, placed exactly.
 *
 * Picks the last line that had STARTED by `atSeconds` and returns a window around it. A line with
 * no time cannot be the focus (it could be anywhere) but still renders in the window, because
 * dropping it would silently remove a turn from a conversation a manager is reading.
 */
export function linesAround(
  lines: readonly TimedLine[],
  atSeconds: number,
  radius = 2
): { lines: TimedLine[]; focusIndex: number } | null {
  if (lines.length === 0) return null;
  let centre = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i]!.atSeconds;
    if (t !== null && t <= atSeconds) centre = i;
  }
  if (centre < 0) centre = 0;
  const from = Math.max(0, centre - radius);
  return { lines: lines.slice(from, centre + radius + 1), focusIndex: centre - from };
}

/**
 * The transcript lines around the playhead — guide Step 4 item 5.
 *
 * `pitch_scores.transcript` is ONE TEXT COLUMN with no speaker turns and no timings. Nothing in
 * the schema says what its format is, so this does the only honest thing available: splits on
 * newlines, and returns a window by LINE POSITION scaled to the recording's duration rather than
 * pretending to know when each line was said.
 *
 * That is an approximation and it is labelled as one in the return value. The alternative —
 * inventing per-line timings from an even split — would put a specific, wrong second next to a
 * quote a manager is about to read out to a rep. `approximate: true` is how the surface says
 * "around here" instead of "at 7:22".
 */
export function transcriptWindow(
  transcript: string | null,
  atSeconds: number,
  durationS: number | null,
  radius = 2
): { lines: string[]; focusIndex: number; approximate: boolean } | null {
  if (!transcript) return null;
  const lines = transcript.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;
  if (!durationS || durationS <= 0) {
    return { lines: lines.slice(0, radius * 2 + 1), focusIndex: 0, approximate: true };
  }
  const ratio = Math.max(0, Math.min(1, atSeconds / durationS));
  const centre = Math.min(lines.length - 1, Math.round(ratio * (lines.length - 1)));
  const from = Math.max(0, centre - radius);
  // No upper clamp: `slice` already stops at the end. A Math.min here reads as a load-bearing
  // bound and is not one — proved by mutation, which could not tell the two apart.
  const to = centre + radius + 1;
  return { lines: lines.slice(from, to), focusIndex: centre - from, approximate: true };
}
