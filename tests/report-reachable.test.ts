/**
 * Reporting a problem must be reachable when the app is at its worst.
 *
 * A crash-reporting screen is only worth having if a person can get to it in the state that made them want it.
 * When this was built it lived only under `(app)` — behind the auth gate — which meant the ONE failure it could
 * never hear about was the one most likely to strand somebody: not being able to sign in. A rep locked out has no
 * menu, no Home, and no way to tell anyone.
 *
 * These tests read the route files rather than rendering them, because a screen needs the native runtime and
 * cannot load under `node --test`. That is a real limit and it shapes what is asserted: this pins that the doors
 * EXIST and lead to the same page. Whether the link is legible on a phone is check 25 on a device, not here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');
const read = (p: string) => readFileSync(join(SRC, p), 'utf8');

test('there is a route OUTSIDE the auth gate — the locked-out rep is the whole point', () => {
  const route = join(SRC, 'app', '(auth)', 'report-problem.tsx');
  assert.ok(existsSync(route), 'no (auth) route: a rep who cannot sign in cannot report that');
});

test('both doors render the SAME page, so one cannot rot while the other is maintained', () => {
  for (const p of ['app/(app)/report-problem.tsx', 'app/(auth)/report-problem.tsx']) {
    assert.match(read(p), /ReportProblemPage/, `${p} does not render the shared page`);
  }
  assert.ok(existsSync(join(SRC, 'components', 'report-problem-page.tsx')));
});

test('the sign-in screen LINKS to it — a route nobody can find is not a route', () => {
  // The regression this catches is subtle and likely: someone tidies the
  // sign-in screen, drops the quietest control on it, and the escape hatch is
  // gone while the route it points at still exists and still passes its test.
  const signIn = read('app/(auth)/sign-in.tsx');
  assert.match(signIn, /\(auth\)\/report-problem/, 'sign-in has no link to the report screen');
});

test('the link is a labelled control, not a bare glyph', () => {
  const signIn = read('app/(auth)/sign-in.tsx');
  assert.match(signIn, /accessibilityLabel="Report a problem signing in"/);
});

test('the in-app door is still in the Home menu, in both modes', () => {
  // Belt and braces with home-menu.test.ts: that pins the list, this pins that
  // the list is what the (app) route is reached BY.
  const menu = read('lib/home-menu.ts');
  assert.match(menu, /'\/\(app\)\/report-problem'/);
});

test('the (app) route is registered in the stack, or its header would read "report-problem"', () => {
  // Not cosmetic: expo-router falls back to the file name, and a header reading
  // a kebab-case route name is how a screen announces it was never looked at.
  const layout = read('app/(app)/_layout.tsx');
  assert.match(layout, /name="report-problem"[\s\S]{0,80}title: 'Report a problem'/);
});

test('the auth group has a Stack, or there is no way BACK from the report screen', () => {
  // The defect this pins was real and was shipped for about ten minutes: with
  // two routes and no navigator, the push works and there is no header, no back
  // arrow and no back gesture. A person already stuck at the front door would
  // have been stuck one screen deeper.
  const layout = join(SRC, 'app', '(auth)', '_layout.tsx');
  assert.ok(existsSync(layout), 'no (auth)/_layout.tsx: the report screen is a dead end');
  const src = readFileSync(layout, 'utf8');
  assert.match(src, /name="report-problem"[\s\S]{0,80}title: 'Report a problem'/, 'no header, so no back arrow');
  assert.match(src, /name="sign-in"[\s\S]{0,60}headerShown: false/, 'sign-in paints its own screen');
});

test('both navigators honour Reduce Motion from the SAME hook', () => {
  // Two subscriptions that agree today drift the first time one is touched.
  for (const p of ['app/(app)/_layout.tsx', 'app/(auth)/_layout.tsx']) {
    assert.match(read(p), /useReduceMotion/, `${p} does not read Reduce Motion`);
    assert.match(read(p), /animation: reduceMotion \? 'none' : 'default'/, `${p} animates regardless`);
  }
  assert.ok(existsSync(join(SRC, 'lib', 'use-reduce-motion.ts')), 'the hook was copied, not shared');
});
