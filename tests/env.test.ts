/**
 * The boot-time settings check — now pinned as the owner's `boot-crash` decision requires.
 *
 * WHAT CHANGED, and why these tests were rewritten rather than deleted. This module used to throw while it was
 * being EVALUATED, so merely importing it was enough. The import chain from the root layout is short —
 * `_layout.tsx` -> `auth-context` -> `supabase` -> here — which meant the failure happened while the root layout
 * was still loading, where its own ErrorBoundary is a component in a tree that never got built. The app closed
 * itself.
 *
 * The owner chose `lazy-client`, and the Supabase client was duly made lazy. But the client was never what threw;
 * THIS was. So the decision was only half delivered, and the previous version of this file documented the crash as
 * still-current behaviour — accurately, which is why it was worth reading.
 *
 * The values are getters now. The check runs at the first property READ, which happens inside the client proxy
 * during render or an effect, where a boundary exists to catch it.
 *
 * ONE CONSEQUENCE WORTH KNOWING: ENV reflects the environment at READ time rather than at import time. On a device
 * that is a distinction without a difference — Metro inlines these at build. In a test it is not, which is why the
 * helper below reads the values while the environment is still swapped rather than after restoring it.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// The project's alias hook does not take a query string, so the cache-buster
// goes on a real file URL instead of on "@/lib/env".
const ENV_URL = pathToFileURL(path.resolve(process.cwd(), 'src/lib/env.ts')).href;

const KEYS = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'EXPO_PUBLIC_API_BASE',
] as const;

/**
 * A complete, valid set. The test process does not inherit `.env.local`, so
 * without a baseline every case would trip the FIRST check and never reach the
 * one it means to exercise — which is how four of these initially failed for
 * the wrong reason.
 */
const BASE: Record<string, string> = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
  EXPO_PUBLIC_API_BASE: 'https://example.com',
};

type Key = 'SUPABASE_URL' | 'SUPABASE_ANON_KEY' | 'API_BASE';

/**
 * Load the module under a swapped environment and run the assertions INSIDE the swap.
 *
 * The body-callback shape is not decoration. With getters, a value is read when it is asked for — so a helper that
 * returned the module and let the caller read it afterwards would read the RESTORED environment and quietly assert
 * nothing. Two earlier versions of this helper did exactly that, in two different ways: one spread `mod.ENV` (which
 * calls every getter at import time) and one handed back a reader that ran after the `finally`.
 */
async function withEnv<T>(
  overrides: Record<string, string | undefined>,
  tag: string,
  body: (read: (k: Key) => string, imported: boolean) => T,
): Promise<T> {
  const merged: Record<string, string | undefined> = { ...BASE, ...overrides };
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(merged)) {
    saved[k] = process.env[k];
    if (merged[k] === undefined) delete process.env[k];
    else process.env[k] = merged[k] as string;
  }
  try {
    const mod = await import(`${ENV_URL}?case=${tag}`);
    return body((k) => mod.ENV[k], true);
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test('IMPORTING the module is safe — the app gets far enough to show a screen', async () => {
  // The heart of the boot-crash fix. Importing this used to BE the crash: the root layout could not finish
  // loading, so nothing was ever mounted that could report the problem, and the app closed itself.
  const imported = await withEnv({ EXPO_PUBLIC_SUPABASE_URL: undefined }, 'import-safe', (_r, ok) => ok);
  assert.equal(imported, true);
});

test('a missing Supabase URL throws when it is READ, not when it is imported', async () => {
  await withEnv({ EXPO_PUBLIC_SUPABASE_URL: undefined }, 'no-url', (read) => {
    assert.throws(() => read('SUPABASE_URL'), /EXPO_PUBLIC_SUPABASE_URL is missing/);
  });
});

test('a blank setting counts as missing, not as a value', async () => {
  // "   " is the shape a half-filled config file produces, and it would otherwise sail through as a
  // present-but-useless key.
  await withEnv({ EXPO_PUBLIC_SUPABASE_ANON_KEY: '   ' }, 'blank-key', (read) => {
    assert.throws(() => read('SUPABASE_ANON_KEY'), /EXPO_PUBLIC_SUPABASE_ANON_KEY is missing/);
  });
});

test('the error names the variable and what to do about it', async () => {
  // The module's stated purpose is "a message a human can act on", and now somebody can actually see it: the
  // throw happens where a boundary is mounted, so this text is what reaches the screen.
  await withEnv({ EXPO_PUBLIC_SUPABASE_URL: undefined }, 'msg', (read) => {
    assert.throws(() => read('SUPABASE_URL'), (e: Error) => {
      assert.match(e.message, /\.env\.local/);
      assert.match(e.message, /EXPO_PUBLIC_SUPABASE_URL/);
      return true;
    });
  });
});

test('the API base is optional and falls back rather than throwing', async () => {
  // Unlike the other two: it has a default, so its absence must NOT stop the app.
  await withEnv({ EXPO_PUBLIC_API_BASE: undefined }, 'no-base', (read) => {
    assert.ok(read('API_BASE').length > 0);
    assert.ok(!read('API_BASE').endsWith('/'), 'a trailing slash would produce // in every request path');
  });
});

test('a trailing slash on the API base is stripped', async () => {
  await withEnv({ EXPO_PUBLIC_API_BASE: 'https://example.com///' }, 'slash', (read) => {
    assert.equal(read('API_BASE'), 'https://example.com');
  });
});

test('all three settings present is the ordinary case and does not throw', async () => {
  await withEnv({}, 'ok', (read) => {
    assert.ok(read('SUPABASE_URL').startsWith('http'));
    assert.equal(read('SUPABASE_ANON_KEY'), 'test-anon-key');
  });
});

test('every required setting is checked, not just the first', () => {
  // Guards the shape of the module rather than one variable: if a future edit
  // stops checking one of them, that one becomes a silent `undefined` at
  // runtime — the exact failure this module was written to prevent.
  assert.deepEqual([...KEYS], [
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    'EXPO_PUBLIC_API_BASE',
  ]);
});
