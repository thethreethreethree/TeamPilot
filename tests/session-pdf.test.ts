/**
 * The PDF export: real bytes, a real structure, and nothing silently lost.
 *
 * WHAT THESE ARE FOR. A malformed PDF does not look slightly wrong — it does not
 * open. And a correct-looking one can still be a failure: a conversation that ran
 * off the bottom of page one, an accented name written as corrupt bytes, a coach
 * cue drawn as if somebody said it. None of those throw, and a rep only finds out
 * after they have sent it to their manager.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  assemblePdf,
  concat,
  pdfText,
  strBytes,
  textWidth,
  wrapText,
} from '@/lib/pdf/write-pdf';
import { buildSessionPdf, sessionPdfName, type SessionDoc } from '@/lib/pdf/session-pdf';

const text = (b: Uint8Array) => String.fromCharCode(...b);

const doc = (blocks: SessionDoc['blocks']): SessionDoc => ({
  title: 'Mrs Alvarez, 14 Oak Street',
  subtitle: '10 Sep 2026 at 14:12',
  blocks,
});

// ---------------------------------------------------------------- the bytes

test('the file is a PDF, with an xref whose offsets point at the objects', () => {
  // An off-by-one here does not produce a slightly wrong document. It produces
  // one that will not open.
  const bytes = buildSessionPdf(doc([{ kind: 'note', text: 'Hello.' }]));
  const s = text(bytes);
  assert.match(s, /^%PDF-1\.4/);
  assert.match(s, /%%EOF\n$/);

  const startxref = Number(s.match(/startxref\n(\d+)/)![1]);
  assert.equal(s.slice(startxref, startxref + 4), 'xref');

  // Every offset in the table must land on "<n> 0 obj".
  // Skip "xref", the "0 N" count line, AND the free-object row — the numbered
  // entries start at the fourth line.
  const table = s.slice(startxref).split('\n').slice(3);
  let n = 1;
  for (const row of table) {
    const m = row.match(/^(\d{10}) 00000 n $/);
    if (!m) break;
    const off = Number(m[1]);
    assert.equal(s.slice(off, off + `${n} 0 obj`.length), `${n} 0 obj`, `object ${n} is not at ${off}`);
    n += 1;
  }
  assert.ok(n > 4, 'the xref table listed almost nothing');
});

test('the declared object count matches the objects that are actually there', () => {
  const bytes = buildSessionPdf(doc([{ kind: 'note', text: 'Hello.' }]));
  const s = text(bytes);
  const declared = Number(s.match(/\/Size (\d+)/)![1]);
  const actual = (s.match(/\n\d+ 0 obj\n/g) ?? []).length;
  assert.equal(declared, actual + 1, 'Size counts the free object plus every real one');
});

test('a stream declares the length it really has', () => {
  // A wrong /Length is the other way a viewer refuses the file.
  const bytes = buildSessionPdf(doc([{ kind: 'turn', who: 'Me', text: 'Morning.' }]));
  const s = text(bytes);
  for (const m of s.matchAll(/<< \/Length (\d+) >>\nstream\n/g)) {
    const len = Number(m[1]);
    const start = m.index! + m[0].length;
    assert.equal(s.slice(start + len, start + len + 10), '\nendstream', `a stream of ${len} was mis-declared`);
  }
});

// ---------------------------------------------------------------- the text

test('an accented name survives as letters, not as corrupt bytes', () => {
  // strBytes writes one byte per character and the font is WinAnsi, so anything
  // outside Latin-1 would become nonsense in the file a manager opens.
  assert.equal(pdfText('José Muñoz'), 'Jose Munoz');
  // A character with no Latin-1 equivalent at all still becomes a visible
  // placeholder rather than corrupt bytes.
  assert.equal(pdfText('好'), '?');
});

test('real speech punctuation reads as punctuation, not as question marks', () => {
  /*
   * FOUND BY RENDERING ONE AND LOOKING AT IT. Transcripts and LLM-authored
   * coach cues are full of em dashes, curly quotes and ellipses, and every one
   * of them sits above U+00FF - so the Latin-1 fallback alone turned a real cue
   * into: they said "already had someone out" ? find out who
   * which reads as a broken file rather than as a sentence.
   */
  const out = pdfText('they said “already had someone out” — find out who…');
  assert.ok(!out.includes('?'), out);
  assert.match(out, /"already had someone out"/);
  assert.match(out, / - find out who\.\.\./);
  assert.equal(pdfText('it’s here'), "it's here");
});

test('PDF metacharacters are escaped, and escaped LAST', () => {
  // A stray unescaped bracket ends the string early and the rest of the page
  // becomes operators. Escaping before the transliteration would let a later
  // pass split the backslash it just wrote.
  assert.equal(pdfText('a (b) c'), 'a \\(b\\) c');
  assert.equal(pdfText('back\\slash'), 'back\\\\slash');
  assert.equal(pdfText(''), '');
});

test('a name with an accent AND a bracket comes out escaped, not half-done', () => {
  assert.equal(pdfText('José (owner)'), 'Jose \\(owner\\)');
});

// ---------------------------------------------------------------- the layout

test('a long line wraps rather than running off the page', () => {
  const line = 'the customer explained at length '.repeat(12);
  const lines = wrapText(line, 10, 499);
  assert.ok(lines.length > 1, 'nothing wrapped');
  for (const l of lines) assert.ok(textWidth(l, 10) <= 499, `"${l.slice(0, 30)}..." is too wide`);
});

test('a single word longer than the line is broken instead of overflowing', () => {
  // A pasted URL, or a customer reading out a serial number. Left whole it runs
  // off the page edge, where it is not clipped - it is simply gone.
  const lines = wrapText('x'.repeat(400), 10, 200);
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(textWidth(l, 10) <= 200);
});

test('a long conversation paginates instead of falling off page one', () => {
  const many: SessionDoc['blocks'] = [];
  for (let i = 0; i < 200; i += 1) {
    many.push({ kind: 'turn', who: i % 2 ? 'Customer' : 'Me', text: `Turn number ${i}, said out loud.` });
  }
  const s = text(buildSessionPdf(doc(many)));
  const pages = Number(s.match(/\/Count (\d+)/)![1]);
  assert.ok(pages > 3, `200 turns produced only ${pages} page(s)`);
  // The LAST turn has to be in the file. Losing the end of a call is exactly the
  // half a manager most wants.
  assert.ok(s.includes('Turn number 199'), 'the end of the conversation was lost');
});

test('every page names the call, so a page on its own still means something', () => {
  const many: SessionDoc['blocks'] = Array.from({ length: 200 }, (_, i) => ({
    kind: 'turn' as const,
    who: 'Me',
    text: `Line ${i}`,
  }));
  const s = text(buildSessionPdf(doc(many)));
  const pages = Number(s.match(/\/Count (\d+)/)![1]);
  const titles = (s.match(/Mrs Alvarez, 14 Oak Street/g) ?? []).length;
  assert.equal(titles, pages, `${pages} pages carried ${titles} titles`);
});

test('a coach cue is drawn in the coach\'s voice, not as something that was said', () => {
  const s = text(
    buildSessionPdf(
      doc([
        { kind: 'turn', who: 'Me', text: 'Morning.' },
        { kind: 'cue', text: 'Coach - Suggestion: ask what they use now.' },
      ]),
    ),
  );
  // Grey fill, and indented past the margin: a reader must never mistake the
  // coach's suggestion for a line of the conversation.
  assert.match(s, /0\.35 0\.35 0\.35 rg/);
  assert.match(s, /1 0 0 1 72 /);
});

test('an empty document is still a valid, openable file', () => {
  const s = text(buildSessionPdf(doc([])));
  assert.match(s, /^%PDF-1\.4/);
  assert.match(s, /\/Count 1/);
  assert.match(s, /%%EOF\n$/);
});

// ---------------------------------------------------------------- the name

test('the file is named something a person can find again', () => {
  // Three exports in a morning is three files in Files. Three UUIDs is the same
  // as no names at all.
  assert.equal(sessionPdfName('Mrs Alvarez, 14 Oak St', '2026-09-10T14:12:00Z'), 'Mrs-Alvarez-14-Oak-St-2026-09-10.pdf');
  assert.equal(sessionPdfName('', '2026-09-10T14:12:00Z'), 'Session-2026-09-10.pdf');
  assert.equal(sessionPdfName('José/Muñoz', '2026-09-10T00:00:00Z'), 'JoseMunoz-2026-09-10.pdf');
  assert.match(sessionPdfName('Call', 'not a date'), /Session\.pdf$|undated\.pdf$/);
});

// ---------------------------------------------------------------- primitives

test('the byte helpers do what the assembler assumes', () => {
  assert.deepEqual(Array.from(strBytes('AB')), [65, 66]);
  assert.deepEqual(Array.from(concat([strBytes('A'), strBytes('B')])), [65, 66]);
  const one = assemblePdf([strBytes('<< >>')], 1);
  assert.match(text(one), /1 0 obj\n<< >>\nendobj/);
});
