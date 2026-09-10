/**
 * A call's record as a PDF a rep can send to a manager.
 *
 * WHY A PDF WHEN THERE IS ALREADY A TEXT SHARE. The text share is the handover
 * gate's "get your own data out", and it stays. A PDF is a different job: it
 * arrives as a document rather than a wall in a message bubble, it keeps its
 * shape when it is forwarded, and it is what a manager can actually file. Doc 07
 * asks for exactly that on the web's meeting review; this app has no meeting
 * review, so it lands on the review this app does have.
 *
 * THE CONTENT IS THE SAME CONTENT. Every line comes from the same session,
 * segments and cues the text export uses, in the same order, including the
 * warning about an unattributed transcript. Two exports of one call that
 * disagreed would be worse than having only one.
 *
 * PORTRAIT A4, HELVETICA, POSITIONED TEXT. No image, no font embedding, no
 * library — see write-pdf.ts for why. It paginates by measuring: a document that
 * ran off the bottom of a page would silently lose the end of a conversation,
 * which is the half a manager most wants.
 *
 * PURE, and free of native imports, so the pagination and the escaping are
 * tested rather than inspected on a phone.
 */
import { assemblePdf, concat, pdfText, strBytes, wrapText } from './write-pdf';

/** A4 portrait, in points. */
const PAGE = { w: 595, h: 842 } as const;
const MARGIN = 48;
const CONTENT_W = PAGE.w - MARGIN * 2;
/** Where the first line of body text sits, below the title block. */
const BODY_TOP = 118;
const BOTTOM = MARGIN + 24;

const TITLE_SIZE = 20;
const SUB_SIZE = 10;
const HEAD_SIZE = 11;
const BODY_SIZE = 10;
const LINE_H = 14;
const HEAD_GAP = 10;

/** One line of the document, already decided. */
export type DocBlock =
  | { kind: 'heading'; text: string }
  /** A `label: value` fact from the top of the record. */
  | { kind: 'fact'; label: string; value: string }
  /** A spoken turn. `who` is drawn in bold. */
  | { kind: 'turn'; who: string; text: string }
  /** A coach cue, indented under the turn it followed. */
  | { kind: 'cue'; text: string }
  /** An explanation the reader needs, in the muted voice. */
  | { kind: 'note'; text: string }
  | { kind: 'gap' };

export type SessionDoc = {
  title: string;
  subtitle: string;
  blocks: DocBlock[];
};

/** How many lines a block occupies once wrapped to the page. */
function linesFor(block: DocBlock): string[] {
  switch (block.kind) {
    case 'gap':
      return [''];
    case 'heading':
      return wrapText(block.text, HEAD_SIZE, CONTENT_W);
    case 'fact':
      return wrapText(`${block.label}: ${block.value}`, BODY_SIZE, CONTENT_W);
    case 'turn':
      return wrapText(`${block.who}: ${block.text}`, BODY_SIZE, CONTENT_W);
    case 'cue':
      return wrapText(block.text, BODY_SIZE, CONTENT_W - 24);
    default:
      return wrapText(block.text, BODY_SIZE, CONTENT_W);
  }
}

/**
 * The document as PDF bytes.
 *
 * THE TITLE BLOCK IS ON EVERY PAGE. A page that arrives on its own — printed,
 * screenshotted, pulled out of a thread — must still say which call it is. A
 * transcript page with no name on it is evidence of nothing.
 */
export function buildSessionPdf(doc: SessionDoc): Uint8Array {
  const pages: string[] = [];
  let content = '';
  let y = BODY_TOP;

  const startPage = () => {
    content = '';
    y = BODY_TOP;
    // Title and subtitle, repeated per page.
    content += `BT /F2 ${TITLE_SIZE} Tf 1 0 0 1 ${MARGIN} ${PAGE.h - 56} Tm (${pdfText(doc.title)}) Tj ET\n`;
    content += `BT /F1 ${SUB_SIZE} Tf 1 0 0 1 ${MARGIN} ${PAGE.h - 74} Tm (${pdfText(doc.subtitle)}) Tj ET\n`;
    // A hairline under the header, drawn rather than typed: it is the one piece
    // of structure that tells a reader where the record begins.
    content += `${MARGIN} ${PAGE.h - 88} m ${PAGE.w - MARGIN} ${PAGE.h - 88} l 0.6 w 0.7 0.7 0.7 RG S\n`;
  };

  const flush = () => {
    if (content) pages.push(content);
  };

  startPage();

  for (const block of doc.blocks) {
    const lines = linesFor(block);
    const gapBefore = block.kind === 'heading' ? HEAD_GAP : 0;
    /*
     * A HEADING MOVES WHOLE; A SPOKEN TURN DOES NOT.
     *
     * Found by rendering a real transcript and looking at the pages: reserving
     * the WHOLE block left a hundred points of white at the foot of page one,
     * because the next turn happened to be three lines long. On a long call
     * that is a wasted band on every page.
     *
     * A heading still has to arrive with something under it - a heading alone
     * at the foot of a page is a heading for nothing. A turn splitting across
     * a page break is ordinary in any transcript, and the speaker's name stays
     * with at least the first line of what they said, because the break can
     * only fall between lines that are already wrapped.
     */
    const needed = block.kind === 'heading' ? gapBefore + lines.length * LINE_H : gapBefore + LINE_H;
    if (PAGE.h - y - needed < BOTTOM) {
      flush();
      startPage();
    }
    y += gapBefore;
    lines.forEach((line, i) => {
      // Mid-block break: only the continuation lines of a non-heading block can
      // land here, so nothing is orphaned from its own label.
      if (i > 0 && PAGE.h - y - LINE_H < BOTTOM) {
        flush();
        startPage();
      }
      const top = PAGE.h - y;
      if (block.kind === 'heading') {
        content += `BT /F2 ${HEAD_SIZE} Tf 1 0 0 1 ${MARGIN} ${top} Tm (${pdfText(line)}) Tj ET\n`;
      } else if (block.kind === 'cue') {
        // Indented and grey: the coach's voice is not the conversation, and a
        // reader must never mistake a suggestion for something that was said.
        content += `BT /F1 ${BODY_SIZE} Tf 0.35 0.35 0.35 rg 1 0 0 1 ${MARGIN + 24} ${top} Tm (${pdfText(line)}) Tj ET 0 0 0 rg\n`;
      } else if (block.kind === 'note') {
        content += `BT /F1 ${BODY_SIZE} Tf 0.35 0.35 0.35 rg 1 0 0 1 ${MARGIN} ${top} Tm (${pdfText(line)}) Tj ET 0 0 0 rg\n`;
      } else if (block.kind === 'turn' && i === 0) {
        // The speaker's name is bold only on the first wrapped line — the rest
        // is their words, and bolding those would shout the whole turn.
        const who = `${block.who}: `;
        const rest = line.slice(who.length);
        content += `BT /F2 ${BODY_SIZE} Tf 1 0 0 1 ${MARGIN} ${top} Tm (${pdfText(who)}) Tj /F1 ${BODY_SIZE} Tf (${pdfText(rest)}) Tj ET\n`;
      } else if (block.kind !== 'gap') {
        content += `BT /F1 ${BODY_SIZE} Tf 1 0 0 1 ${MARGIN} ${top} Tm (${pdfText(line)}) Tj ET\n`;
      }
      y += LINE_H;
    });
  }
  flush();

  const k = Math.max(1, pages.length);
  if (pages.length === 0) pages.push('');

  // 1 catalog, 2 pages, 3 Helvetica, 4 Helvetica-Bold, then k page objects and
  // k content streams.
  const firstPageObj = 5;
  const firstContentObj = firstPageObj + k;
  const kids = Array.from({ length: k }, (_, i) => `${firstPageObj + i} 0 R`).join(' ');
  const bodies: Uint8Array[] = [
    strBytes('<< /Type /Catalog /Pages 2 0 R >>'),
    strBytes(`<< /Type /Pages /Kids [${kids}] /Count ${k} >>`),
    strBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'),
    strBytes('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'),
  ];
  for (let i = 0; i < k; i += 1) {
    bodies.push(
      strBytes(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${firstContentObj + i} 0 R >>`,
      ),
    );
  }
  for (let i = 0; i < k; i += 1) {
    const cb = strBytes(pages[i]!);
    bodies.push(
      concat([strBytes(`<< /Length ${cb.length} >>\nstream\n`), cb, strBytes('\nendstream')]),
    );
  }
  return assemblePdf(bodies, 1);
}

/**
 * A filename a person can find again.
 *
 * NOT the session id. A rep who exports three calls in a morning ends up with
 * three files in Files, and three UUIDs is the same as no names at all.
 */
export function sessionPdfName(title: string, isoDate: string): string {
  const day = /^\d{4}-\d{2}-\d{2}/.test(isoDate) ? isoDate.slice(0, 10) : 'undated';
  const safe = (title || 'Session')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9 ]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return `${safe || 'Session'}-${day}.pdf`;
}
