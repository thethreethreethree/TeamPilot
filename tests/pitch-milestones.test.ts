/**
 * Two milestone strips, one segmented control, and the rule that keeps them apart.
 *
 * M6's done-when is a single sentence: **no rep can earn two First-pitch badges.** Under the
 * founder's R-D ruling both strips are now one swipe apart on the same tab — Pitch Score's six
 * counting qualifying PITCHES, the Arena's five counting SESSIONS on the points ledger. A rep
 * records sessions that never qualify, so the two sets diverge permanently and neither is wrong;
 * what would be wrong is presenting them under the same words, earned on different days, and
 * leaving the rep to reconcile them privately.
 *
 * The web reached this on 2026-09-21 and relabelled its own five. The phone was still carrying the
 * old words for a day. That gap is what this file exists to close and to keep closed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildArena, milestones } from '@/lib/gamification/arena';
import {
  PITCH_MILESTONE_CAPTIONS,
  PITCH_MILESTONE_TITLES,
  pitchMilestoneRows,
} from '@/lib/pitch-score/milestones';
import { MILESTONE_KEYS } from '@/lib/pitch-score/types';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const strip = code(read('src/components/pitch-milestones-strip.tsx'));
const NOW = Date.parse('2026-09-22T12:00:00Z');
const arenaBadges = milestones(buildArena([], { deals: 0, now: NOW }), 0);

test('no badge name appears in both strips', () => {
  /*
    THE ONE ASSERTION M6 IS FOR. `spark` was labelled "First pitch" on this phone while Pitch
    Score's `firstPitch` says the same words about a different denominator; the Arena's `century`
    was "Century · 100 scored calls" against "Century · 100 scored pitches". A rep seeing either
    pair would reasonably conclude one of them was broken.

    Compared case-insensitively, because "First pitch" and "First Pitch" would read identically to
    the person this protects and identically-enough to fool a stricter test.
  */
  const arena = arenaBadges.map((m) => m.label.toLowerCase());
  const pitch = Object.values(PITCH_MILESTONE_TITLES).map((t) => t.toLowerCase());
  const shared = arena.filter((label) => pitch.includes(label));
  assert.deepEqual(shared, [], `both strips show: ${shared.join(', ')}`);
});

test('the Arena counts sessions in its own words, and Pitch Score counts pitches', () => {
  /*
    Not merely distinct strings — distinct NOUNS. Two sets could avoid collision by accident while
    both saying "call", which is the word that means neither. Each strip has to name its unit where
    a rep reads it, because that is the only thing on screen that explains why the two disagree.
  */
  for (const m of arenaBadges) {
    const words = `${m.label} ${m.requirement}`.toLowerCase();
    assert.doesNotMatch(words, /\bpitch(es)?\b/, `the Arena badge ${m.key} still says "pitch"`);
    assert.doesNotMatch(words, /\bcalls?\b/, `the Arena badge ${m.key} says "call", which is neither`);
  }
  assert.match(strip, /Milestones · pitches/, 'the strip must name its unit in the header');
});

test('the six titles and captions are the sheet’s, term for term', () => {
  /*
    A DRIFT GUARD OVER EVERY KEY, not a sample. These are mirrored strings from the web's
    `PITCH_MILESTONE_TITLES` / `PITCH_MILESTONE_CAPTIONS`, read 2026-09-22. Mirrored copy is still
    one decision in two places; §2.2 permits it with a named source and a test that exercises every
    term, which is what this is.
  */
  assert.deepEqual(PITCH_MILESTONE_TITLES, {
    firstPitch: 'First pitch',
    tripleDigits: 'Triple digits',
    inTheDoor: 'In the door',
    fullBundle: 'Full bundle',
    cleanSweep: 'Clean sweep',
    century: 'Century',
  });
  assert.deepEqual(PITCH_MILESTONE_CAPTIONS, {
    firstPitch: 'Your first counted pitch',
    tripleDigits: 'A single pitch over 100',
    inTheDoor: 'Inside the house or backyard',
    fullBundle: 'DTV + Wireless + ADT in one pitch',
    cleanSweep: 'Every phase fully hit',
    century: '100 scored pitches',
  });
});

test('the two captions that the badge names would have got wrong', () => {
  /*
    The web's own docblock names these as the reason the module was not written from the names:

      Clean sweep is "every phase fully hit", NOT "no violations" — the obvious reading, and wrong.
      Full bundle names three products, NOT "several bonuses".

    A phone that inferred either would print a plausible sentence describing pitches the badge does
    not fire on, and nothing on screen would look incorrect.
  */
  assert.doesNotMatch(PITCH_MILESTONE_CAPTIONS.cleanSweep, /violation/i);
  assert.match(PITCH_MILESTONE_CAPTIONS.cleanSweep, /every phase fully hit/i);
  for (const product of ['DTV', 'Wireless', 'ADT']) {
    assert.ok(
      PITCH_MILESTONE_CAPTIONS.fullBundle.includes(product),
      `Full bundle must name ${product}`,
    );
  }
});

test('every badge is listed, in the sheet’s order, earned or not', () => {
  // A locked badge a rep cannot see the condition for is just a locked box.
  const rows = pitchMilestoneRows({
    firstPitch: '2026-08-12T09:00:00Z',
    tripleDigits: null,
    inTheDoor: null,
    fullBundle: null,
    cleanSweep: null,
    century: null,
  });
  assert.deepEqual(
    rows.map((r) => r.key),
    [...MILESTONE_KEYS],
  );
  for (const r of rows) assert.ok(r.caption.length > 0, `${r.key} does not say what it takes`);
  assert.deepEqual(rows[0].status, { state: 'earned', at: '2026-08-12T09:00:00Z' });
  assert.deepEqual(rows[1].status, { state: 'not-yet' });
});

test('a key the server did not send is unknown, never “not yet”', () => {
  /*
    The confident zero, in its milestone form. `null` is the server saying it looked; an absent key
    is the server not saying. Rendering the second as the first tells a rep who has recorded a
    hundred pitches that they have recorded none. Shared with the Arena's reader rather than
    re-implemented, which is why this holds for a set of keys that reader has never seen.
  */
  const rows = pitchMilestoneRows({ firstPitch: '2026-08-12T09:00:00Z' } as never);
  const by = Object.fromEntries(rows.map((r) => [r.key, r.status.state]));
  assert.equal(by.firstPitch, 'earned');
  assert.equal(by.century, 'unknown');
  assert.equal(by.cleanSweep, 'unknown');
});

test('the strip derives no date of its own', () => {
  /*
    Every badge is a first or an Nth and the phone holds only a window of the history. A rep with
    four hundred pitches would have the phone name the wrong day as their first — and a wrong date
    is worse than no date, because it looks exactly like a right one. The server reads oldest-first
    for that reason and sends the dates.
  */
  const lib = code(read('src/lib/pitch-score/milestones.ts'));
  assert.doesNotMatch(lib, /\.sort\(|Date\.parse|new Date\(|\.filter\(/);
  assert.doesNotMatch(strip, /\.sort\(|Date\.parse|new Date\(/);
});

test('a failed read is not six grey badges', () => {
  /*
    Six unearned badges is the sentence "you have done none of this", which is a real statement
    about a rep and one a failed read has no standing to make. The route refuses to make it too —
    it 500s rather than returning an empty strip — and the client has to keep that refusal.
  */
  assert.match(strip, /data == null \?/);
  assert.match(strip, /Could not load your milestones/);
});

test('the strip says the period toggle does not reach it', () => {
  /*
    The milestones route takes no period, by design: "your first pitch was Monday" is true of this
    week and false about the rep. A strip sitting silently under a Day gauge would teach a rep that
    the toggle changes something it does not, and nothing on screen would be wrong.
  */
  assert.match(strip, /the period above does not change them/);
  assert.doesNotMatch(strip, /fetchMilestones\(p\)|period\)/, 'no period may be passed');
});
