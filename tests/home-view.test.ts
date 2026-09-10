/**
 * Regression tests for the home screen's numbers.
 *
 * TWO FAILURES ARE BEING GUARDED, and both are quiet.
 *
 * The first is a **zero that is really a failure**. The web home renders an em
 * dash when a figure could not be fetched, precisely so a broken load cannot
 * read as a genuine "0 calls today" — a rep who has worked all morning and sees
 * a zero stops believing every other number on the screen. This app copies that
 * rule, so it needs a test that a null stays a dash.
 *
 * The second is **"today" computed in the wrong timezone**. Comparing ISO date
 * prefixes puts a 9 p.m. call into tomorrow for every rep west of Greenwich.
 * This project has already shipped that bug once, on the trend screen.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildHomeView, firstNameFrom, startedToday } from '@/lib/home-view';
import type { CoachingSession } from '@/types/backend';

function session(over: Partial<CoachingSession>): CoachingSession {
  return {
    id: 's1',
    company_id: 'c',
    agent_id: 'a',
    context: 'in_person',
    client_label: 'Rowan & Co',
    status: 'ended',
    session_kind: 'sales',
    audio_asset_url: null,
    audio_duration_seconds: null,
    territory: null,
    approach: null,
    offer: null,
    outcome: null,
    deal_value: null,
    started_at: new Date().toISOString(),
    ended_at: null,
    created_at: new Date().toISOString(),
    ...over,
  };
}

const valueOf = (v: ReturnType<typeof buildHomeView>, key: string) =>
  v.stats.find((s) => s.key === key)?.value;

// ------------------------------------------------------------- the greeting

test('a full name gives a first name', () => {
  assert.equal(firstNameFrom('Johns Ramos', 'j@x.com'), 'Johns');
});

test('the EMAIL is never used as a name — not even one that looks like one', () => {
  /**
   * This test used to assert the opposite: `johns@elostate.com` gave "Johns".
   *
   * It reads well for that address and badly for the next one. `johnsyramos@gmail.com` — the owner's own — gave
   * "Welcome Johnsyramos", which is the exact case the Home screen's header comment names as the bug it fixed.
   * It was fixed for a profile that HAS a name; a profile without one still reached this path. And there is no
   * rule that tells the two apart: both are letters, and the only difference is that one happens to be a name.
   *
   * The web settles it rather than my taste: `dashboard/sales-coach/page.tsx` reads `fullName ?? null` and renders
   * `{name ?? "back"}`. It never looks at the email, and this app is meant to read as the same product.
   */
  for (const email of [
    'johns@elostate.com',
    'johnsyramos@gmail.com',
    'j.ramos+work@x.com',
    'sales.team@x.com',
    'a@x.com',
    'rep_42@x.com',
  ]) {
    assert.equal(firstNameFrom(null, email), null, email);
  }
});

test('a rep with no profile name is greeted warmly, not by a mangled string', () => {
  // The screen renders `fullName ?? firstName ?? 'back'`, so null here is what produces "Welcome back".
  assert.equal(firstNameFrom(null, 'johnsyramos@gmail.com'), null);
});

test('no name and no email is not an error', () => {
  assert.equal(firstNameFrom(null, null), null);
  assert.equal(firstNameFrom(undefined, undefined), null);
});

// ---------------------------------------------------------------- honesty

test('a failed load renders a DASH, never a zero', () => {
  const v = buildHomeView({ sessions: null, hasMore: false, pendingRecordings: null });
  assert.equal(valueOf(v, 'today'), '—');
  assert.equal(valueOf(v, 'unscored'), '—');
  assert.equal(valueOf(v, 'waiting'), '—');
});

test('a real zero is still a zero', () => {
  const v = buildHomeView({ sessions: [], hasMore: false, pendingRecordings: 0 });
  assert.equal(valueOf(v, 'today'), '0');
  assert.equal(valueOf(v, 'waiting'), '0');
});

test('an unknown figure is never the emphasised tile', () => {
  // An outlined em dash draws the eye to nothing.
  const v = buildHomeView({ sessions: null, hasMore: false, pendingRecordings: null });
  assert.equal(v.stats.find((s) => s.key === 'unscored')?.emphasis, false);
});

test('a failed load does not claim the counts are merely partial', () => {
  // "Older calls are not counted yet" implies the rest ARE counted. Nothing is.
  const v = buildHomeView({ sessions: null, hasMore: true, pendingRecordings: null });
  assert.equal(v.partial, false);
});

test('unloaded older calls ARE reported as partial', () => {
  const v = buildHomeView({ sessions: [session({})], hasMore: true, pendingRecordings: 0 });
  assert.equal(v.partial, true);
});

// ----------------------------------------------------------------- today

test('a call on the local day still counts when UTC disagrees', () => {
  /**
   * THIS TEST HAD TO BE REWRITTEN. The first version pinned 21:30 on a fixed
   * date and asserted it counted as today. It passed — and it passed with the
   * timezone bug deliberately reintroduced, because the machine running it sits
   * EAST of Greenwich, where a 21:30 local call is still the same UTC day. A
   * test that cannot fail is not a guard, it is decoration.
   *
   * So the hour is chosen from the runner's ACTUAL offset, to land on a moment
   * that is the same LOCAL day and a different UTC day. Then an ISO-prefix
   * comparison is guaranteed to get it wrong, wherever this runs.
   */
  const offsetMinutes = new Date().getTimezoneOffset(); // >0 west of UTC, <0 east
  if (offsetMinutes === 0) {
    // At UTC the two readings cannot disagree, so there is nothing to assert.
    // Said out loud rather than passing silently and looking like coverage.
    console.log('  (skipped: runner is at UTC, where local and UTC days coincide)');
    return;
  }
  // West: late evening local is already tomorrow in UTC.
  // East: early morning local is still yesterday in UTC.
  const hour = offsetMinutes > 0 ? 23 : 0;
  const minute = offsetMinutes > 0 ? 30 : 30;
  const now = new Date(2026, 8, 3, 12, 0);
  const call = new Date(2026, 8, 3, hour, minute);

  // The premise the assertion depends on — proven, not assumed.
  assert.notEqual(
    call.toISOString().slice(0, 10),
    now.toISOString().slice(0, 10),
    'test setup failed to straddle the UTC date line',
  );

  const rows = [session({ started_at: call.toISOString() })];
  assert.equal(startedToday(rows, now).length, 1);
});

test('yesterday is not today', () => {
  const now = new Date(2026, 8, 3, 9, 0);
  const rows = [session({ started_at: new Date(2026, 8, 2, 23, 59).toISOString() })];
  assert.equal(startedToday(rows, now).length, 0);
});

test('an unparseable timestamp is dropped rather than counted', () => {
  const rows = [session({ started_at: 'not a date' })];
  assert.equal(startedToday(rows, new Date()).length, 0);
});

test('unscored counts only calls with no outcome', () => {
  const v = buildHomeView({
    sessions: [session({ id: 'a' }), session({ id: 'b', outcome: 'sold' })],
    hasMore: false,
    pendingRecordings: 0,
  });
  assert.equal(valueOf(v, 'unscored'), '1');
});

test('every tile speaks a full sentence', () => {
  const v = buildHomeView({ sessions: [session({})], hasMore: false, pendingRecordings: 1 });
  for (const s of v.stats) {
    // A screen reader hitting a bare "3" with no context is the failure here.
    assert.ok(s.spoken.length > s.value.length, s.key);
    assert.ok(/[a-z]/.test(s.spoken), s.key);
  }
});

test('a large pending-recordings figure is grouped like every other number', () => {
  // Small in practice, but the formatter is shared and the rule is that one
  // number never appears in two formats across the app. A test here is what
  // stops this tile drifting back to String(n) on its own.
  const v = buildHomeView({ sessions: [], hasMore: false, pendingRecordings: 1500 });
  const waiting = v.stats.find((s) => s.key === 'waiting');
  assert.equal(waiting?.value, '1,500');
});

test('a small figure is left plain', () => {
  const v = buildHomeView({ sessions: [], hasMore: false, pendingRecordings: 3 });
  assert.equal(v.stats.find((s) => s.key === 'waiting')?.value, '3');
});
