/**
 * The check that exists so a rep can say WHAT is wrong, not just that it is.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PROBE_PATH, outcomeFor, reportLines, type ConnectionReport } from '@/lib/connection-check';

const signedIn = (coach: ConnectionReport['coach']): ConnectionReport => ({ signedIn: true, coach });

test('a refusal always carries its number, because the number is the report', () => {
  const lines = reportLines(signedIn({ kind: 'refused', status: 401 }));
  assert.ok(lines.some((l) => l.includes('401')), 'the status was not shown');
  assert.ok(lines.some((l) => /REFUSED/.test(l)));
});

test('a 404 counts as a refusal, not as missing data', () => {
  // A route that cannot see this account's rows behind a token it should accept
  // is refusing. Calling it "not found" sends a rep hunting for lost sessions.
  assert.deepEqual(outcomeFor(404), { kind: 'refused', status: 404 });
  assert.deepEqual(outcomeFor(500), { kind: 'refused', status: 500 });
  assert.deepEqual(outcomeFor(200), { kind: 'ok', status: 200 });
  assert.deepEqual(outcomeFor(204), { kind: 'ok', status: 204 });
});

test('an accepted account says so AND says where to look next', () => {
  const lines = reportLines(signedIn({ kind: 'ok', status: 200 }));
  assert.ok(lines.some((l) => /accepted this account/.test(l)));
  // Must not leave a rep concluding everything is fine when a feature is broken.
  assert.ok(lines.some((l) => /fault is in that feature/.test(l)));
});

test('never reaching the service is reported as its own answer, not as a refusal', () => {
  const lines = reportLines(signedIn({ kind: 'unreachable' }));
  assert.ok(lines.some((l) => /never arrived/.test(l)));
  assert.ok(!lines.some((l) => /REFUSED/.test(l)), 'an unreachable service was reported as a refusal');
});

test('signed out short-circuits and says what to do rather than probing', () => {
  const lines = reportLines({ signedIn: false, coach: null });
  assert.ok(lines.some((l) => /Sign in and run this again/.test(l)));
  assert.ok(!lines.some((l) => /REFUSED|accepted/.test(l)), 'it reported on a call it never made');
});

test('the check retries once after a 401, so an expired token is not called a refusal', async () => {
  const { runConnectionCheck } = await import('@/lib/connection-check');
  let calls = 0;
  const report = await runConnectionCheck({
    token: async () => 'tok',
    refresh: async () => undefined,
    apiBase: 'https://example.test',
    fetcher: (async () => {
      calls += 1;
      return { status: calls === 1 ? 401 : 200 } as Response;
    }) as unknown as typeof fetch,
  });
  assert.equal(calls, 2, 'it did not retry after refreshing');
  assert.deepEqual(report, { signedIn: true, coach: { kind: 'ok', status: 200 } });
});

test('a thrown fetch is reported as unreachable rather than crashing the screen', async () => {
  const { runConnectionCheck } = await import('@/lib/connection-check');
  const report = await runConnectionCheck({
    token: async () => 'tok',
    refresh: async () => undefined,
    apiBase: 'https://example.test',
    fetcher: (async () => { throw new Error('network down'); }) as unknown as typeof fetch,
  });
  assert.deepEqual(report, { signedIn: true, coach: { kind: 'unreachable' } });
});

test('no token means signed out, and no request is made at all', async () => {
  const { runConnectionCheck } = await import('@/lib/connection-check');
  let called = false;
  const report = await runConnectionCheck({
    token: async () => null,
    refresh: async () => undefined,
    apiBase: 'https://example.test',
    fetcher: (async () => { called = true; return { status: 200 } as Response; }) as unknown as typeof fetch,
  });
  assert.equal(called, false, 'it called the service with no token');
  assert.deepEqual(report, { signedIn: false, coach: null });
});

test('the probe route is one the APP ITSELF calls, not merely a cheap-looking one', async () => {
  /**
   * THE FIRST DRAFT GOT THIS WRONG AND WOULD HAVE SHIPPED.
   *
   * It probed `/api/coach/sales-session/quota`, picked for reading a count and
   * calling no model. Quota resolves its user from the web COOKIE, so it answered
   * 401 to a healthy account and this check would have told every rep the coach
   * service had REFUSED them — a false alarm from the very thing built to stop
   * people chasing problems that are not there.
   *
   * The rule that would have caught it: a check must authenticate the way the app
   * does, against a route the app genuinely uses. So the probe path must appear
   * somewhere in the app's own source besides this module.
   */
  const { readdirSync, readFileSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');

  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e) && !p.includes('connection-check')) files.push(p);
    }
  };
  walk('src');

  const users = files.filter((f) => readFileSync(f, 'utf8').includes(PROBE_PATH));
  assert.ok(
    users.length > 0,
    `the probe path ${PROBE_PATH} is not called anywhere else in the app, so this check can only report on itself`,
  );
});
