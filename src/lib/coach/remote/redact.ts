/**
 * Number redaction for stored transcripts (decision D15, docs/rss/docs/00-OPEN-DECISIONS.md; Gong F33.3).
 *
 * A run of digits — allowing single spaces, dashes or dots between groups, as a card or account number is read out
 * ("4111 1111 1111 1111", "123-45-6789") — with at least `minDigits` digits is replaced by "[number removed]". Shorter
 * runs (prices, years, "3 bedrooms", times) are left alone. Applied where every transcript line is written
 * (appendTranscriptSegment), so the AI reads, search, exports and the call page never see it.
 *
 * Numbers spoken as WORDS ("four one one one …", "double five", "forty one eleven") are caught too since 2026-11-23
 * (redactSpokenNumbers): the digits a run of number words stands for are counted, mixed with typed digits, against the
 * same threshold. Limits, stated rather than hidden: "hundred"/"thousand" end a run (amounts, not ids); the AUDIO is
 * not altered; lines already stored stay as they are (redaction is for new calls).
 */
import { REDACTION } from "./decisions";

export const REDACTED = "[number removed]";

export function redactNumbers(text: string, minDigits: number): string {
  if (!text || minDigits < 1) return text;
  // Digit groups joined by a single space, dash or dot (no letters in between).
  return text.replace(/\d(?:[ \-.]?\d)*/g, (run) => (run.replace(/\D/g, "").length >= minDigits ? REDACTED : run));
}

const UNITS: Record<string, number> = { zero: 1, oh: 1, one: 1, two: 1, three: 1, four: 1, five: 1, six: 1, seven: 1, eight: 1, nine: 1 };
const TEENS = new Set(["ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"]);
const TENS = new Set(["twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"]);
const TOKEN = String.raw`(?:\d+|zero|oh|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|double|triple)`;
const RUN = new RegExp(String.raw`\b${TOKEN}(?:[\s,.\-]+${TOKEN})*\b`, "gi");

/** How many digits a run of number words (and digit groups) stands for: "four one" = 2, "double five" = 2, "forty one"
 *  = 2 ("forty" then a unit fills the same two places), "eleven" = 2, "4111" = 4. */
export function spokenDigitCount(run: string): number {
  const words = run.toLowerCase().split(/[\s,.\-]+/).filter(Boolean);
  let n = 0;
  let times = 1;
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (w === "double" || w === "triple") {
      times = w === "double" ? 2 : 3;
      continue;
    }
    if (/^\d+$/.test(w)) n += w.length * times;
    else if (w in UNITS) n += times;
    else if (TEENS.has(w)) n += 2 * times;
    else if (TENS.has(w)) {
      n += 2 * times;
      if (words[i + 1] && words[i + 1]! in UNITS && words[i + 1] !== "zero" && words[i + 1] !== "oh") i++; // "forty one" is two digits, not three
    }
    times = 1;
  }
  return n;
}

const UNIT_VALUE: Record<string, number> = { zero: 0, oh: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9 };
const TEEN_VALUE: Record<string, number> = { ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
const TENS_VALUE: Record<string, number> = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };

/**
 * Someone COUNTING ("twenty-one, twenty-two, twenty-three …", "one two three four …") is not reading out a number.
 * Found in production 2026-11-23: two lines counting 21→41 (with a few numbers skipped or not caught by the
 * transcriber: steps 1,1,…,2,2,…,3) would otherwise have lost 180 characters. A run whose numbers all move the same
 * way by 1 to 3 (3 or more numbers) is a count and is left alone. A card read digit by digit or in pairs repeats or
 * jumps (a step of 0, or more than 3), so it is still removed.
 */
export function isCounting(run: string): boolean {
  const words = run.toLowerCase().split(/[\s,.\-]+/).filter(Boolean);
  const values: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i]!;
    if (/^\d+$/.test(w)) values.push(Number(w));
    else if (w in UNIT_VALUE) values.push(UNIT_VALUE[w]!);
    else if (w in TEEN_VALUE) values.push(TEEN_VALUE[w]!);
    else if (w in TENS_VALUE) {
      const next = words[i + 1];
      if (next && next in UNIT_VALUE && next !== "zero" && next !== "oh") {
        values.push(TENS_VALUE[w]! + UNIT_VALUE[next]!);
        i++;
      } else values.push(TENS_VALUE[w]!);
    } else return false; // double / triple: someone reading digits, not counting
  }
  if (values.length < 3) return false;
  const up = values[1]! > values[0]!;
  return values.every((v, i) => {
    if (i === 0) return true;
    const d = (v - values[i - 1]!) * (up ? 1 : -1);
    return d >= 1 && d <= 3;
  });
}

/** Runs of number words standing for at least `minDigits` digits are replaced, like a digit run (D15) — unless the run
 *  is someone counting. */
export function redactSpokenNumbers(text: string, minDigits: number): string {
  if (!text || minDigits < 1) return text;
  return text.replace(RUN, (run) => (/[a-z]/i.test(run) && spokenDigitCount(run) >= minDigits && !isCounting(run) ? REDACTED : run));
}

/**
 * The text a transcript line is STORED as (D15, decisions.ts REDACTION). Every path that writes transcript text must
 * pass through this: appendTranscriptSegment (live lines), replaceSessionTranscript (uploaded recordings, recovery)
 * and the line-correction route (typed text). Before 2026-11-23 only the first did, so an uploaded call's card number
 * was stored in full. A guard test (transcriptRedactionGate) fails if a writer stops using it.
 */
export function transcriptTextForStorage(text: string): string {
  return REDACTION.enabled ? redactNumbers(redactSpokenNumbers(text, REDACTION.minDigits), REDACTION.minDigits) : text;
}
