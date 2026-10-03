/**
 * The app reads a transcript's CURRENT version (website migration 0269, 2026-10-03).
 *
 * The transcript table is append-only on the server: a repair or a relabel writes a new version and keeps the
 * old one. Read straight off the table, a repaired call would show its broken words and its fixed words
 * interleaved, count its lines twice, and keep asking "who spoke?" after the rep answered. The view
 * `coaching_transcript_segments_current` returns each call's newest version only.
 *
 * The website enforces the same rule (scripts/invariant-audit.mjs, INVARIANT 32). This reads every source file,
 * blanks the comments, and fails on the bare table name in what is left.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}
const withoutComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

test('no source file reads the raw transcript table', () => {
  const offenders = files('src').filter((f) => /coaching_transcript_segments(?!_current)/.test(withoutComments(readFileSync(f, 'utf8'))));
  assert.deepEqual(offenders, []);
});

test('the three transcript reads use the current-version view', () => {
  const src = withoutComments(readFileSync('src/lib/sync/sessions.ts', 'utf8'));
  assert.equal((src.match(/coaching_transcript_segments_current/g) ?? []).length >= 4, true); // embed + its key + two reads
  assert.match(src, /"\*, coaching_transcript_segments_current\(count\)"/);
});
