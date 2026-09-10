/**
 * A gesture in the tree requires a gesture root above it.
 *
 * THIS TEST EXISTS BECAUSE THE APP CRASHED ON A REAL PHONE while every check on this laptop was green.
 * `swipe-pager.tsx` uses a `GestureDetector`, which throws at render — a thrown Error and a red screen, not a
 * warning — unless some ancestor is a `GestureHandlerRootView`. There was none. Today's Metrics was therefore
 * dead on device, and the typecheck passed, the lint passed, and 977 unit tests passed, because not one of them
 * mounts a component.
 *
 * Found by the owner on check 23, at 09:23 on the first morning anything had been run on hardware.
 *
 * The gate is source-level and deliberately narrow (A33): it asks one question that has one right answer — if any
 * file uses GestureDetector, does the root layout mount the provider? It cannot fire on correct code, and it
 * cannot be satisfied by anything except the fix.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = join(process.cwd(), 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx') || p.endsWith('.ts')) out.push(p);
  }
  return out;
}

/**
 * Comments are stripped before any of these checks look at a file.
 *
 * The first version of the Animated.Value check below failed on its own fix: the comment explaining what the bug
 * had been contains the words `new Animated.Value(0)`, so a gate reading raw text flagged the very file it was
 * written to protect. A gate that fires on prose is one people learn to skip — and the prose here is the most
 * valuable part of that file.
 */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = walk(SRC);
const usesGestures = files.filter((f) => /\bGestureDetector\b/.test(code(f)));

test('the root layout mounts GestureHandlerRootView whenever anything uses a gesture', () => {
  if (usesGestures.length === 0) return; // nothing to protect

  const root = readFileSync(join(SRC, 'app', '_layout.tsx'), 'utf8');
  assert.match(
    root,
    /GestureHandlerRootView/,
    `${usesGestures.length} file(s) use GestureDetector but the root layout does not mount ` +
      `GestureHandlerRootView. Every one of those screens throws on a device.`,
  );
  assert.match(
    root,
    /import \{ GestureHandlerRootView \} from 'react-native-gesture-handler'/,
    'GestureHandlerRootView is named but never imported',
  );
});

test('it wraps the provider tree rather than sitting inside it', () => {
  if (usesGestures.length === 0) return;
  const root = readFileSync(join(SRC, 'app', '_layout.tsx'), 'utf8');
  // The detector finds its root by CONTEXT from wherever it is mounted, so a root placed below the router would
  // protect today's screens and miss the next one.
  const gestureAt = root.indexOf('<GestureHandlerRootView');
  const safeAreaAt = root.indexOf('<SafeAreaProvider');
  assert.ok(gestureAt > -1 && safeAreaAt > -1, 'one of the two providers is missing');
  assert.ok(
    gestureAt < safeAreaAt,
    'GestureHandlerRootView must be ABOVE SafeAreaProvider, so any screen added later is covered',
  );
});

test('it fills the screen — a zero-height root swallows the whole app', () => {
  if (usesGestures.length === 0) return;
  const root = readFileSync(join(SRC, 'app', '_layout.tsx'), 'utf8');
  // GestureHandlerRootView does NOT default to flex:1. Without it the app renders as a blank screen, which looks
  // like a very different bug from the one it is.
  assert.match(root, /<GestureHandlerRootView style=\{\{ flex: 1 \}\}/);
});

/**
 * The second device defect, five minutes after the first.
 *
 * With the gesture root in place, Today's Metrics got further and then threw `[Worklets] Cannot copy value of
 * type AnimatedValue`. `GestureDetector` attaches its handlers by serializing the closure to the UI thread; the
 * pager's track was a legacy `Animated.Value`, which cannot cross that boundary.
 *
 * The two animation systems look interchangeable in an editor and are not. Nothing on a laptop can tell them
 * apart — the types are fine, the lint is fine, and the failure exists only once a real UI thread tries to copy
 * the value. So the boundary is asserted here instead.
 */
test('a file using GestureDetector never holds a legacy Animated.Value', () => {
  const offenders = usesGestures.filter((f) => /new Animated\.Value\b/.test(code(f)));
  assert.deepEqual(
    offenders.map((f) => f.replace(SRC, 'src')),
    [],
    'a legacy Animated.Value in a GestureDetector closure throws on a device. Use a Reanimated shared value.',
  );
});

test('a file using GestureDetector imports Animated from reanimated, not react-native', () => {
  // The subtler half of the same mistake: `import { Animated } from 'react-native'` beside a GestureDetector
  // compiles, renders on a simulator's first frame, and dies when a gesture attaches.
  for (const f of usesGestures) {
    const src = code(f);
    const rnImport = src.match(/import \{[^}]*\bAnimated\b[^}]*\} from 'react-native'/);
    assert.equal(
      rnImport,
      null,
      `${f.replace(SRC, 'src')} imports the legacy Animated from react-native alongside a GestureDetector`,
    );
  }
});

/**
 * The worklets plugin must not be switched off.
 *
 * `babel-preset-expo` adds `react-native-worklets/plugin` automatically when the package is installed, so
 * `babel.config.js` correctly lists no plugin at all. But the preset takes `worklets: false` and
 * `reanimated: false` options, and either one stops every worklet in the app being compiled.
 *
 * The failure mode is the one this whole file exists for: a device crash behind a clean typecheck, a clean lint
 * and a full green test run. One word in a config, and nothing on a laptop notices.
 */
test('the babel config never disables worklets or reanimated', () => {
  const babel = readFileSync(join(process.cwd(), 'babel.config.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  assert.ok(!/worklets\s*:\s*false/.test(babel), 'worklets: false stops every Reanimated worklet compiling');
  assert.ok(!/reanimated\s*:\s*false/.test(babel), 'reanimated: false stops every Reanimated worklet compiling');
});
