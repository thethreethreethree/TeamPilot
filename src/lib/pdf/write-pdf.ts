/**
 * Writing a PDF by hand, because a PDF is an object graph and not a mystery.
 *
 * PORTED from the web's `lib/schedule/writePdf.ts`, read rather than remembered.
 * The web made this dependency-free deliberately, and on a phone that reasoning
 * gets stronger: a PDF library is a native module or a megabyte of JavaScript,
 * and a native plugin has already cost this project an EAS build. What is
 * actually needed here is a few hundred lines of positioned text.
 *
 * WHY NOT `expo-print` (HTML to PDF). It is the obvious answer and it is a new
 * native module for the same reason. It also puts the layout behind a WebView,
 * which means the document a rep sends their manager depends on how one phone's
 * browser engine felt about the CSS that day. Bytes are bytes.
 *
 * LATIN-1 IS THE WHOLE TRAP. `strBytes` writes one byte per character, and the
 * base fonts are WinAnsi, so anything outside Latin-1 would become corrupt bytes
 * in the file. A transcript is real speech: names with accents, a customer who
 * typed an em dash, an emoji in a client label. `pdfText` transliterates first
 * (Jose, Munoz — still readable) and turns whatever is left into a visible '?'
 * rather than mojibake, then escapes the PDF metacharacters LAST, because
 * escaping first would let a later replacement break the escape.
 */

/** One byte per character. The caller must have passed text through `pdfText`. */
export function strBytes(s: string): Uint8Array {
  const b = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) b[i] = s.charCodeAt(i) & 0xff;
  return b;
}

export function concat(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}

/**
 * Numbered objects into a valid PDF, with the cross-reference table and trailer.
 *
 * THE OFFSETS ARE THE FILE. A reader finds every object by the byte offset in
 * this table, so an off-by-one here does not produce a slightly wrong document,
 * it produces one that will not open at all.
 */
export function assemblePdf(bodies: Uint8Array[], rootNum: number): Uint8Array {
  const header = strBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const chunks: Uint8Array[] = [header];
  let offset = header.length;
  const offsets: number[] = [];
  bodies.forEach((body, i) => {
    const pre = strBytes(`${i + 1} 0 obj\n`);
    const post = strBytes('\nendobj\n');
    offsets.push(offset);
    chunks.push(pre, body, post);
    offset += pre.length + body.length + post.length;
  });
  let xref = `xref\n0 ${bodies.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) xref += `${String(off).padStart(10, '0')} 00000 n \n`;
  xref += `trailer\n<< /Size ${bodies.length + 1} /Root ${rootNum} 0 R >>\nstartxref\n${offset}\n%%EOF\n`;
  chunks.push(strBytes(xref));
  return concat(chunks);
}

/**
 * Text made safe for a WinAnsi base font, then escaped for the content stream.
 *
 * ORDER MATTERS AND IS NOT ARRANGEABLE. Transliterate, then replace the
 * un-encodable, THEN escape. Escaping first would insert backslashes that the
 * later passes could split.
 */
export const pdfText = (s: string): string =>
  (s ?? '')
    /*
     * TYPOGRAPHIC PUNCTUATION FIRST, and this is not a nicety - it was found by
     * rendering a real transcript and looking at it. Speech and LLM-authored
     * coach cues are full of em dashes, curly quotes and ellipses. Every one of
     * them is above U+00FF, so without this pass the Latin-1 fallback below
     * turned them into a bare '?' and a manager opened a PDF reading
     *   they said "already had someone out" ? find out who
     * which reads as a broken file rather than as a sentence.
     *
     * Mapped to ASCII rather than to the Windows-1252 high range: the house
     * style bans em dashes in generated copy anyway, and an ASCII hyphen cannot
     * depend on a viewer agreeing about a code page.
     */
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[‐‑‒–−]/g, '-')
    .replace(/—/g, '-')
    .replace(/…/g, '...')
    .replace(/[   ]/g, ' ')
    .replace(/•/g, '-')
    .normalize('NFKD')
    // Combining diacritics, by code point rather than by a literal range that a
    // source file could mangle: Jose keeps its letters and loses its accent.
    .replace(/[̀-ͯ]/g, '')
    // Anything still outside Latin-1 becomes a visible placeholder. A '?' tells
    // a reader something was there; corrupt bytes tell them the file is broken.
    .replace(/[^\x00-\xff]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

/**
 * Roughly how wide a string is in Helvetica, in points, at a given size.
 *
 * APPROXIMATE ON PURPOSE, and the direction of the error is chosen: the average
 * advance of Helvetica's lowercase is about 0.5 em, so 0.52 slightly OVER-
 * estimates. Wrapping a line one word early looks like a wrap. Wrapping one word
 * late runs the text off the page, where it is not clipped or hyphenated - it is
 * simply gone from the document a rep just sent their manager.
 */
export function textWidth(s: string, size: number): number {
  return s.length * size * 0.52;
}

/**
 * Break a string into lines that fit `maxWidth`.
 *
 * A WORD LONGER THAN THE LINE IS BROKEN rather than allowed to overflow. It
 * happens: a URL pasted into a client label, a customer reading out a serial
 * number. Leaving it whole would push it off the page edge silently.
 */
export function wrapText(s: string, size: number, maxWidth: number): string[] {
  const words = (s ?? '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let line = '';
  const perChar = size * 0.52;
  const maxChars = Math.max(1, Math.floor(maxWidth / perChar));
  for (const word of words) {
    if (word.length > maxChars) {
      if (line) {
        lines.push(line);
        line = '';
      }
      for (let i = 0; i < word.length; i += maxChars) lines.push(word.slice(i, i + maxChars));
      continue;
    }
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}
