/**
 * THE PRIVACY POLICY MUST BE REACHABLE FROM INSIDE THE APP.
 *
 * WHAT WAS MISSING. There was no privacy policy anywhere in this app - not a link, not a line, not
 * a mention. It was found by sweeping the website's routes for pages the phone never points at.
 *
 * WHY IT IS NOT A NICETY. The core action of this product is RECORDING ANOTHER PERSON'S VOICE, and
 * the person recorded is not the person holding the phone. Apple requires the policy to be
 * reachable in the app itself, not only in the store listing - and the store listing is not
 * something a rep at a door can read. The policy at that address is also the only place the
 * processors are named: it was corrected on 4 September, while preparing this very submission,
 * because it did not list ElevenLabs - which receives every recorded conversation - and still
 * claimed nothing reached Anthropic that the user had authored, which stopped being true once
 * transcripts containing the CUSTOMER's words began being sent for analysis.
 *
 * TWO PLACES, AND BOTH ARE LOAD-BEARING. Account is where a signed-in rep looks for what the app
 * holds about them. Sign-in is where somebody who has NOT agreed to anything yet can still read it
 * - and they cannot reach Account at all, so a single link on Account would leave exactly the
 * person with the most at stake unable to find it.
 *
 * A SOURCE-LEVEL CHECK, deliberately (A33): what is protected is that a link EXISTS on two
 * particular screens. Neither the screens nor `expo-web-browser` can be rendered in this runner.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WEB_PATHS, webPrivacyUrl } from '@/lib/web-links';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

test('the policy path is the published one, declared once', () => {
  // Verified 11 September 2026: https://elostate.com/privacy answers 200 with no redirect, and
  // `/privacy` is absent from the website's middleware matcher, which guards only /dashboard,
  // /onboarding and the two login routes. A policy behind a login is not published.
  assert.equal(WEB_PATHS.privacy(), '/privacy');
  assert.equal(webPrivacyUrl('https://elostate.com'), 'https://elostate.com/privacy');
  assert.equal(webPrivacyUrl('https://elostate.com/'), 'https://elostate.com/privacy');
});

test('a build with no host gets null rather than a broken address', () => {
  // Same rule as every other link here: absent is honest, a link to a 404 is not. In a real build
  // this cannot happen - ENV.API_BASE falls back to the production host rather than to empty.
  assert.equal(webPrivacyUrl(''), null);
  assert.equal(webPrivacyUrl(null), null);
  assert.equal(webPrivacyUrl(undefined), null);
});

test('a signed-in rep can reach it from Account', () => {
  const account = read('src/app/(app)/(tabs)/account.tsx');
  assert.match(account, /webPrivacyUrl\(ENV\.API_BASE\)/);
  assert.match(account, /Read the privacy policy/, 'the control must say where it goes');
});

test('somebody who has not signed in can reach it too', () => {
  /*
    THE ONE MOST LIKELY TO BE "TIDIED UP", because it looks like a duplicate of the Account link and
    is not: a person who cannot sign in cannot open Account, and a person deciding whether to hand
    this app a microphone has agreed to nothing yet. Removing it would leave the policy readable
    only by people who have already started recording.
  */
  const signIn = read('src/app/(auth)/sign-in.tsx');
  assert.match(signIn, /webPrivacyUrl\(ENV\.API_BASE\)/);
  assert.match(signIn, /Privacy policy/);
});

test('Account states the two retention facts, and states them accurately', () => {
  /*
    READ OUT OF THE SERVER, NOT FROM MEMORY, and pinned here because both numbers are the kind
    that drift silently. The purge job keeps each rep's twenty most recent recordings and drops
    older AUDIO while keeping transcript and scores. `delete-recording` is managers and
    administrators only, with the owning rep excluded on purpose.

    If either server rule changes, this test still passes while the app starts lying - so the
    comment above names the two files to check. What it CAN catch is the sentence being softened
    or dropped in an edit, which is how a promise like this usually disappears.
  */
  const account = read('src/app/(app)/(tabs)/account.tsx');
  assert.match(account, /twenty most recent recordings/);
  assert.match(
    account,
    /only a manager or an administrator can[\s\S]{0,20}delete it/,
    'a rep must be told they cannot remove a sent recording themselves',
  );
  assert.match(
    account,
    /the write-up and your scores[\s\S]{0,40}stay/,
    'dropping the audio is not dropping the coaching - say so, or it reads as losing everything',
  );
});
