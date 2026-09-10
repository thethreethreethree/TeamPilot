/**
 * Guards against a navigation bug that TypeScript cannot catch.
 *
 * WHAT HAPPENED. `router.replace('/(app)/index')` was used to send a signed-in
 * rep to their session list. `(app)` is a route GROUP, so its index route is
 * simply `/(app)` — and because a sibling `[id]` route exists, the string
 * "/(app)/index" matched the DYNAMIC route with id="index" instead. It
 * typechecked, because expo-router's generated href type includes the pattern
 * `/(app)/${string}`, so a dynamic match is a legal href. The result was that
 * every rep who signed in landed on the session-detail screen looking for a
 * session called "index", saw "Could not load this session", and could go no
 * further. It was found on a real device, by looking at the screen.
 *
 * That is the shape this file guards: a group's index addressed as
 * `<group>/index`, which is always wrong and never a type error.
 *
 *   npm test
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.resolve(fileURLToPath(new URL('../src', import.meta.url)));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

/**
 * Comments are stripped before scanning. A file explaining why a bad href is bad
 * necessarily contains that href, and a guard that fires on its own documentation
 * teaches people to delete the documentation.
 *
 * The line-comment rule ignores a `//` preceded by `:` so a URL inside a string
 * is not mistaken for the start of a comment.
 */
function stripComments(text: string): string {
  // `.` does not match a newline without the s flag, so `//.*` stops at the end
  // of its own line; m makes ^ mean "line start" rather than "file start".
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*/gm, '$1');
}

const FILES = sourceFiles(SRC).map((file) => ({
  file: path.relative(SRC, file),
  text: stripComments(readFileSync(file, 'utf8')),
}));

test('no navigation targets a route group index as <group>/index', () => {
  // e.g. '/(app)/index' or "/(tabs)/index" — always the dynamic route instead.
  const bad = /['"`]\/\((\w+)\)\/index['"`]/g;
  const offenders: string[] = [];

  for (const { file, text } of FILES) {
    for (const match of text.matchAll(bad)) {
      offenders.push(`${file}: ${match[0]}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `A group's index is addressed as "/(group)" — "/(group)/index" matches the ` +
      `sibling dynamic route.\n  ${offenders.join('\n  ')}`,
  );
});

test('the two routes everything depends on are reachable by their real hrefs', () => {
  /**
   * UPDATED WHEN HOME BECAME THE ENTRY. This used to assert that `/(app)` — then
   * the session list — was navigated to at least three times. Home now owns that
   * href, matching the web app, and the list moved to `/(app)/sessions`.
   *
   * The intent is unchanged and the assertion is STRONGER: both routes are named
   * now, so a rename that orphans EITHER one fails here. Loosening this to "some
   * route is reachable" would have been the easy way through and would have
   * removed the only guard on the screen every sign-in lands on.
   */
  /**
   * Counted by plain string match on the quoted literal, not by a built regex.
   * A route path is full of regex metacharacters — `/`, `(`, `)` — and the first
   * version of this helper escaped them wrongly and reported zero for a route
   * used nine times. A guard that reads zero when the answer is nine is worse
   * than no guard, because it fails loudly for the wrong reason and gets
   * loosened to make it pass.
   */
  const count = (href: string) => {
    let total = 0;
    for (const { text } of FILES) {
      for (const quote of ["'", '"', '`']) {
        total += text.split(quote + href + quote).length - 1;
      }
    }
    return total;
  };

  /**
   * BOTH GROUPS ARE NAMED IN THE HREF, and that is the whole lesson of this
   * file. `(app)` and `(tabs)` are both route groups, so neither appears in the
   * URL — which means a shorter href like `/(app)/sessions` LOOKS right, type-
   * checks, and then falls through to the dynamic `[id]` route. That is the
   * exact bug that once sent every sign-in to "could not load this session".
   * The sibling test above resolves every literal href to a real file; these
   * two assert the ones nothing else would notice going missing.
   */
  // Home: where sign-in lands, and where +not-found sends a signed-in rep.
  assert.ok(
    count('/(app)/(tabs)') >= 2,
    `Home is not navigated to; found ${count('/(app)/(tabs)')}`,
  );
  // The session list: reached from Home, from the KPI board's unscored prompt,
  // and after a recording is saved.
  assert.ok(
    count('/(app)/(tabs)/sessions') >= 3,
    `the session list is not navigated to; found ${count('/(app)/(tabs)/sessions')}`,
  );
});

test('every navigation href starts at the root', () => {
  // A relative href resolves against whatever screen happens to be showing, so
  // the same call lands somewhere different depending on where it was made.
  const calls = FILES.flatMap(({ file, text }) =>
    [...text.matchAll(/router\.(?:push|replace|navigate)\(\s*(['"`])([^'"`]+)\1/g)].map((m) => ({
      file,
      href: m[2],
    })),
  );
  assert.ok(calls.length > 0, 'no navigation calls found — has the router usage changed?');

  const relative = calls.filter((c) => !c.href.startsWith('/'));
  assert.deepEqual(relative, [], `relative hrefs: ${JSON.stringify(relative)}`);
});

test('every literal href resolves to a route file that exists', () => {
  /*
   * The general form of the sign-in bug. Because a `[id]` route exists, ANY
   * string under /(app)/ is a legal href to TypeScript — so a typo, or a screen
   * that was planned and never written, silently becomes a session id and the
   * rep lands on "could not load this session" instead of anywhere useful.
   *
   * Only literal hrefs are checked. A pathname whose segment is itself a
   * bracketed parameter (/(app)/[id]) is the dynamic route being used on
   * purpose, and is checked by name like any other file.
   */
  const APP = path.join(SRC, 'app');

  const exists = (segments: string[]): boolean => {
    const base = path.join(APP, ...segments);
    for (const candidate of [
      `${base}.tsx`,
      `${base}.ts`,
      `${base}.jsx`,
      `${base}.js`,
      path.join(base, 'index.tsx'),
      path.join(base, 'index.ts'),
    ]) {
      try {
        if (statSync(candidate).isFile()) return true;
      } catch {
        /* keep looking */
      }
    }
    return false;
  };

  const hrefs = new Set<string>();
  for (const { text } of FILES) {
    for (const m of text.matchAll(
      /(?:router\.(?:push|replace|navigate)\(\s*|pathname:\s*)(['"`])(\/[^'"`]*)/g,
    )) {
      hrefs.add(m[2]);
    }
  }
  assert.ok(hrefs.size > 0, 'no hrefs found — has the router usage changed?');

  const missing: string[] = [];
  for (const href of hrefs) {
    const segments = href.split('/').filter(Boolean);
    // A bare group href, e.g. /(app), means that group's index.
    const target = segments.length === 1 && /^\(.+\)$/.test(segments[0])
      ? [segments[0], 'index']
      : segments;
    if (!exists(target)) missing.push(href);
  }

  assert.deepEqual(
    missing,
    [],
    `these hrefs have no route file, so they fall through to the dynamic route: ${missing.join(', ')}`,
  );
});
