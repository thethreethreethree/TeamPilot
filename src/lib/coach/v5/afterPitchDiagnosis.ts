/**
 * Rep-facing diagnosis of WHY an After-Pitch read is degraded — so the screen names the EXACT issue instead of
 * showing a blank "Your read" with no explanation (founder request 2026-08-14; the honesty thesis — never
 * dress a failure as no-data).
 *
 * This runs on a summary that DID reach the main read view (scores present → composite hasSignal true) but whose
 * NARRATIVE came back blank. There are two causes; they are OWNED by different surfaces:
 *   - ONE-SIDED (a capture gap — we heard the rep but not the customer): already named by the BlankReadRecovery
 *     card (which also drives the recovery action), so this diagnosis deliberately RETURNS NULL for it — no
 *     duplicate cause text.
 *   - EMPTY-READ (a two-sided call whose write-up came back empty, no capture gap): NOT covered anywhere — the
 *     rep just sees a blank "Your read" with no reason. THIS is what we name here.
 * The fully-blank states (no audio saved / live transcription never connected) are named by the page's own
 * blank-read card and never reach the main read view.
 *
 * Pure + structural (no React) so the copy is one source of truth and the classification is unit-tested.
 */

import { detectCaptureGap, type SummaryLike } from "./captureGap";

export type AfterPitchIssueCategory = "empty-read";

export type AfterPitchIssue = {
  category: AfterPitchIssueCategory;
  /** Short, plain-language cause the rep sees. */
  title: string;
  /** One line on what it means + what happens next. */
  detail: string;
};

type DiagnosisInput = {
  summary: SummaryLike | null;
};

/**
 * Diagnose a blank-narrative read that isn't a capture gap (the EMPTY-READ case). Returns null for a HEALTHY
 * read (narrative present), for no summary yet, or for a ONE-SIDED gap (owned by BlankReadRecovery).
 */
export function diagnoseAfterPitchRead(input: DiagnosisInput): AfterPitchIssue | null {
  const { summary } = input;
  if (!summary) return null;
  // A real narrative → nothing to diagnose.
  if (summary.narrative?.hasSignal) return null;
  // A capture gap (one-sided) is named + recovered by BlankReadRecovery — don't duplicate its cause text.
  if (detectCaptureGap(summary) !== null) return null;

  // Blank narrative on an otherwise-scored (two-sided, no-gap) read → the review engine came back empty.
  if (Array.isArray(summary.scores) && summary.scores.length > 0) {
    return {
      category: "empty-read",
      title: "Your read didn't come through",
      detail:
        "The call was captured, but the coaching write-up came back empty — we're rebuilding it. Tap Rebuild if it doesn't fill in.",
    };
  }

  return null;
}

/**
 * Translate an After-Pitch GENERATION error (an HTTP failure from the /after-pitch POST) into the EXACT
 * rep-facing cause, instead of a bare "Couldn't build the summary (HTTP 504)". Covers the timeout (504) the
 * founder asked about, the STT/transcription hiccup (502), the private-summary case (403), and a generic hiccup.
 */
export function explainAfterPitchError(
  status: number | null,
  raw?: string | null
): { title: string; detail: string } {
  const text = raw ?? "";
  if (status === 504 || status === 408 || /timed?[ -]?out|timeout/i.test(text)) {
    return {
      title: "That took too long to build",
      detail: "The review timed out — your recording is safe. Tap Try again; a second attempt usually goes through.",
    };
  }
  if (status === 502 || status === 503) {
    return {
      title: "Transcription is temporarily unavailable",
      detail: "Your audio is saved, so nothing is lost. Give it a moment and tap Try again.",
    };
  }
  if (status === 403) {
    return {
      title: "This review is private to the rep who ran the call",
      detail: "Only the rep who ran the session can open its private read.",
    };
  }
  if (status === 429) {
    return {
      title: "Too many attempts in a row",
      detail: "Wait a few seconds, then tap Try again.",
    };
  }
  return {
    title: "We couldn't build your review just now",
    detail: "This is usually a brief hiccup — your recording is safe. Tap Try again.",
  };
}
