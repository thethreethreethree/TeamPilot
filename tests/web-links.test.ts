/**
 * Links out to the website, and the rule that keeps them honest.
 *
 * The phone cannot do everything the website can. What it must not do is NAME a place a rep cannot reach — that
 * is the "explains and offers nothing" failure, and it was in three screens. These pin the URL rule, because a
 * link that opens the wrong page is worse than no link: a 404 reads to a rep as the thing having been deleted,
 * which is a different and more alarming message than "this build has no server configured".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  WEB_PATHS,
  webCalibrationUrl,
  webPitchScoreUrl,
  webTopicUrl,
  webUrl,
} from '@/lib/web-links';

test('builds the topic URL the website actually serves', () => {
  assert.equal(
    webTopicUrl('https://elostate.com', 'abc-123'),
    'https://elostate.com/dashboard/chats/abc-123',
  );
});

test('builds the calibration URL the website actually serves', () => {
  assert.equal(
    webCalibrationUrl('https://elostate.com'),
    'https://elostate.com/dashboard/sales-coach/calibration',
  );
});

test('a trailing slash on the base never becomes a double slash', () => {
  // ENV.API_BASE strips these already, but this module is what is being tested
  // and must not rely on its caller having been careful.
  assert.equal(webTopicUrl('https://elostate.com///', 'x'), 'https://elostate.com/dashboard/chats/x');
  assert.equal(webUrl('https://elostate.com/', '/a'), 'https://elostate.com/a');
});

test('the topic id is encoded — it arrives from a route parameter, which a person can type', () => {
  assert.equal(
    webTopicUrl('https://elostate.com', 'a b/c?d'),
    'https://elostate.com/dashboard/chats/a%20b%2Fc%3Fd',
  );
});

test('no base gives NO link, rather than one that opens a 404', () => {
  for (const base of ['', '   ', null, undefined]) {
    assert.equal(webTopicUrl(base, 'abc'), null, `expected null for base ${JSON.stringify(base)}`);
    assert.equal(webCalibrationUrl(base), null, `expected null for base ${JSON.stringify(base)}`);
  }
});

test('no topic id gives no link — the chat list is not the topic somebody lost', () => {
  for (const id of ['', '   ']) {
    assert.equal(webTopicUrl('https://elostate.com', id), null);
  }
});

test('a path that is not absolute is refused rather than concatenated', () => {
  // "dashboard/chats" without the slash would silently produce
  // "https://elostate.comdashboard/chats", which resolves to a different host.
  assert.equal(webUrl('https://elostate.com', 'dashboard/chats'), null);
});

test('the paths are declared in one place, so no screen types one', () => {
  assert.equal(WEB_PATHS.topic('x'), '/dashboard/chats/x');
  assert.equal(WEB_PATHS.calibration(), '/dashboard/sales-coach/calibration');
  assert.equal(WEB_PATHS.pitchScore('s1'), '/dashboard/sales-coach/s1');
});

test('a pitch links to the SESSION page, not the door-log report card', () => {
  /*
    TWO SCREENS IN THIS PRODUCT ARE CALLED A PITCH'S REPORT CARD, and only one of them is the Pitch
    Score. `PitchScorePanel` renders on `/dashboard/sales-coach/[id]`, keyed by SESSION;
    `/doors/report-card/[pitchId]` is the Door Log's, keyed by PITCH. Sending a best-pitch card to
    the wrong one would open a real, working page about the same call showing entirely different
    numbers — worse than a dead link, because nothing on screen would look broken.
  */
  assert.equal(
    webPitchScoreUrl('https://elostate.com', 'sess-9'),
    'https://elostate.com/dashboard/sales-coach/sess-9',
  );
  assert.doesNotMatch(WEB_PATHS.pitchScore('sess-9'), /report-card/);
});

test('a pitch whose session was deleted yields no URL at all', () => {
  /*
    `pitch_scores.session_id` is `on delete set null`, so a pitch outlives its recording. Null here
    is what lets the board keep the SCORE on screen while dropping the tap — the alternative is a
    control that opens `/dashboard/sales-coach/` and lands the rep somewhere they did not ask for.
  */
  assert.equal(webPitchScoreUrl('https://elostate.com', null), null);
  assert.equal(webPitchScoreUrl('https://elostate.com', '  '), null);
});
