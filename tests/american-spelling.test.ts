/**
 * The app speaks American English (founder, REV 1: "americans use c over s").
 *
 * 2026-09-11 fixed "practising"; 2026-09-30 found "Practise" still on six screens; 2026-10-01 found "analysed"
 * on ten (one of them only a screen reader says) and "recognise" on one. Each pass fixed what it looked for,
 * and the next pass found the neighbour. So this reads every source file, blanks the comments, and fails on
 * the British forms in what is left.
 *
 * Code is exempt, not words: `'analysing'` and `'analysed'` as quoted values are internal state names
 * (session-analysis.ts), and `summarise(` is a function in gamification/points.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BRITISH =
  /\b(analys(e|ed|es|ing)|recognis(e|ed|es|ing)|practis(e|ed|es|ing)|organis(e|ed|ing)|summaris(e|ed|ing)|apologis(e|ed|ing)|favourite|centre)\b/i;
const CODE_NOT_WORDS = /'analysing'|'analysed'|\bsummarise(?=\s*\()/g;

function files(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...files(p));
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

/** Blank every comment but keep its line breaks, so a reported line number is the real one. */
const keepLines = (c: string) => c.replace(/[^\n]/g, ' ');
const withoutComments = (src: string) =>
  src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, keepLines)
    .replace(/\/\*[\s\S]*?\*\//g, keepLines)
    .replace(/(^|[^:'"`])\/\/.*$/gm, (m, pre: string) => pre + keepLines(m.slice(pre.length)));

test('no British spelling in anything a rep can read', () => {
  const found: string[] = [];
  for (const f of files(join(process.cwd(), 'src'))) {
    const lines = withoutComments(readFileSync(f, 'utf8')).replace(CODE_NOT_WORDS, '').split('\n');
    lines.forEach((line, i) => {
      const m = BRITISH.exec(line);
      if (m) found.push(`${f.slice(process.cwd().length + 1)}:${i + 1} "${m[0]}"`);
    });
  }
  assert.deepEqual(found, [], `British spellings in user-facing code:\n${found.join('\n')}`);
});
