/**
 * A rep must never be shown the WRONG PRODUCT, not even briefly.
 *
 * WHAT HAPPENED, ON A DEVICE. Two screenshots seconds apart on 2026-09-22: the first shows the
 * standard product — the "Welcome back" home and a Home / Analytics / Sessions / Team Chat tab bar.
 * The second shows the macro one — the door target and Pitches / Metrics / Role Play. Same launch,
 * same rep. The app painted a product this rep does not use, fully, readably and tappably, and then
 * replaced it.
 *
 * WHY. `macro-context` reads the cached flag with `await`, so `enabled` is null until it resolves.
 * Both `(tabs)/_layout.tsx` and `(tabs)/index.tsx` branch on `enabled === true`, which is false
 * while it is null — so "unknown" rendered as "standard" everywhere at once. The comment that
 * allowed this called it "ONE frame"; the screenshot is of a finished screen.
 *
 * THE FIX IS STRUCTURAL, WHICH IS WHY IT CAN BE TESTED HERE. `MacroGate` sits above the Stack and
 * renders a loading view while the flag is unknown, so the tabs cannot mount at all until the
 * answer exists. That is a property of the tree, not a race that happens to usually win.
 *
 * AND IT IS BOUNDED. A gate with no floor under it is a new way to hang: the read is a cache hit
 * followed by a network call, and on no signal that call can sit for a long time. `UNKNOWN_MAX_MS`
 * resolves the unknown to the same answer a failed request already produces.
 *
 * A33 source-level: these files import react-native and expo-router and cannot be mounted here.
 * What is protected is the SHAPE of the tree, which is a property of the source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const appLayout = code(read('src/app/(app)/_layout.tsx'));
const context = code(read('src/lib/doors/macro-context.tsx'));

test('nothing renders until the app knows which product this rep opens', () => {
  /*
    The gate wraps the Stack rather than living inside a screen, because the wrong product appeared
    in TWO places at once — the tab bar and the home screen — and a fix applied per-screen is a fix
    that the next screen has to remember.
  */
  assert.match(appLayout, /<MacroGate>/, 'the gate must wrap the app, not a screen');
  assert.match(appLayout, /function MacroGate/);
  assert.match(appLayout, /enabled === null/, 'unknown is the condition, not false');
});

test('the unknown state is bounded, so the gate cannot become a hang', () => {
  /*
    Holding on "not yet known" is only safe with a floor. The cache read is followed by a network
    call, and a request on no signal can sit for a long time before it rejects — without a bound,
    the fix for a half-second flash would be an indefinite spinner, which is worse than the bug.
  */
  assert.match(context, /UNKNOWN_MAX_MS/);
  assert.match(context, /setTimeout\(/);
  assert.match(context, /clearTimeout\(/, 'and it must be cleared, or it fires after unmount');
});

test('the bound resolves to the same answer a failed request already gives', () => {
  /*
    This changes WHEN an answer arrives and never WHICH answer it is. The existing code already
    falls to `false` when the request fails with a cold cache; the timeout reuses that, so no rep
    is put into a different product by a clock.
  */
  assert.match(context, /enabled: false/);
  assert.doesNotMatch(context, /enabled: true \}\s*: h/, 'the bound may never invent macro mode');
});

test('the bound is scoped to the rep it was started for', () => {
  /*
    `enabled` is DERIVED from a {userId, enabled} pair precisely so a signed-out rep's value cannot
    leak to whoever signs in next — the file's own docblock records that a reset-in-an-effect left
    exactly that window open on a shared phone. A timeout writing a bare boolean would have
    reopened it, so it goes through the held pair and checks the id.
  */
  assert.match(context, /h\.userId === userId && h\.enabled === null/);
});

test('the loading view is the app’s own, not a blank screen', () => {
  // The comment this replaces feared "an empty tab bar reads as a broken app", and it was right
  // about an INDEFINITE one. A branded, labelled, bounded loading state is a different thing.
  assert.match(appLayout, /ActivityIndicator/);
  assert.match(appLayout, /accessibilityLabel="Opening your app"/);
  assert.match(appLayout, /bg-background/);
});
