/** F33.3 - number redaction. Built, switched off: D15 decides on/off and the digit length.
 *  Returns the masked text AND the character ranges, so audio can be muted at the same moments. */
import { REDACTION } from './decisions';

export function maskDigitRuns(text: string, minDigits: number): { text: string; ranges: [number, number][] } {
  if (!Number.isInteger(minDigits) || minDigits < 4) throw new Error('minDigits must be an integer of at least 4');
  const ranges: [number, number][] = [];
  // A run of digits that may be split by single spaces or dashes ("4111 1111-1111").
  const re = /\d(?:[ -]?\d)*/g;
  const out = text.replace(re, (m, offset: number) => {
    const digits = m.replace(/\D/g, '').length;
    if (digits < minDigits) return m;
    ranges.push([offset, offset + m.length]);
    return '(REDACTED)';
  });
  return { text: out, ranges };
}

export function applyRedaction(text: string): string {
  return REDACTION.enabled ? maskDigitRuns(text, REDACTION.minDigits).text : text;
}
