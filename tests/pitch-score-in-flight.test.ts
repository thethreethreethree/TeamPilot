/**
 * Two panes, one screen, one request.
 *
 * WHAT THIS IS FOR. Today's Metrics grew to four segments and every pane stays mounted, so
 * `useFocusEffect` fires in all of them the moment the tab is focused. Progress and Breakdown share
 * one period by the guide's own requirement, which means both ask for `/breakdown?period=week` in
 * the same tick. The duplicate is not merely waste: the two panes would be served from different
 * moments, and Breakdown's reconciling footer ASSERTS an identity over numbers Progress is printing
 * one swipe away. Two boards disagreeing, each rendering confidently, is the failure this whole
 * build is organised against.
 *
 * TESTED HERE RATHER THAN IN `api.ts`, which imports `expo/fetch` transitively and cannot be loaded
 * by this runner at all. A coalescer that lived there could only ever have been checked by reading
 * it — and reading it is what this project has repeatedly found is not checking.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { coalesce } from '@/lib/pitch-score/in-flight';

/** A start function that reports how many times it was actually called. */
function counted<T>(value: T) {
  const state = { starts: 0, resolve: (_: T) => {}, reject: (_: unknown) => {} };
  const start = () => {
    state.starts += 1;
    return new Promise<T>((res, rej) => {
      state.resolve = res;
      state.reject = rej;
    });
  };
  return { state, start, value };
}

test('two callers in the same tick make ONE request', () => {
  const map = new Map<string, Promise<unknown>>();
  const c = counted(1);

  const a = coalesce(map, '/breakdown?period=week', c.start);
  const b = coalesce(map, '/breakdown?period=week', c.start);

  assert.equal(c.state.starts, 1, 'the second pane started a second identical read');
  assert.equal(a, b, 'the two panes must be waiting on the same answer, not two answers');
});

test('both callers get the same answer, so the two panes cannot disagree', async () => {
  const map = new Map<string, Promise<unknown>>();
  const c = counted(0);

  const a = coalesce(map, '/breakdown?period=week', c.start);
  const b = coalesce(map, '/breakdown?period=week', c.start);
  c.state.resolve(80.3);

  assert.equal(await a, 80.3);
  assert.equal(await b, 80.3);
});

test('a different key is a different request', () => {
  // Progress also reads `day` for its "+177 today" line while the shared period is `week`. Those
  // are two genuinely different questions and must stay two requests.
  const map = new Map<string, Promise<unknown>>();
  const c = counted(0);

  coalesce(map, '/breakdown?period=week', c.start);
  coalesce(map, '/breakdown?period=day', c.start);

  assert.equal(c.state.starts, 2);
});

test('nothing is remembered after it settles, so pull-to-refresh is a real read', async () => {
  /*
    THE LINE BETWEEN THIS AND A CACHE. A response cache would answer a rep's deliberate refresh with
    the number they were already looking at — worse than a slow screen, because it looks like a
    fresh one. Only the IN-FLIGHT window is shared.
  */
  const map = new Map<string, Promise<unknown>>();
  const first = counted(0);
  const p = coalesce(map, '/rubric', first.start);
  first.state.resolve(1);
  await p;

  assert.equal(map.size, 0, 'a settled request must leave nothing behind');

  const second = counted(0);
  coalesce(map, '/rubric', second.start);
  assert.equal(second.state.starts, 1, 'the refresh was answered from memory');
});

test('a failure reaches everyone who asked, and clears the way for a retry', async () => {
  /*
    Callers that arrived together asked the same question at the same instant, and there is one
    truthful answer to give them. What must NOT happen is the failure being remembered: the next
    attempt has to be a real attempt rather than a replayed error, or a rep who regains signal and
    pulls to refresh gets the offline message again.
  */
  const map = new Map<string, Promise<unknown>>();
  const c = counted(0);

  const a = coalesce(map, '/best?period=week', c.start);
  const b = coalesce(map, '/best?period=week', c.start);
  c.state.reject(new Error('offline'));

  await assert.rejects(a, /offline/);
  await assert.rejects(b, /offline/);
  assert.equal(map.size, 0);

  const retry = counted(0);
  coalesce(map, '/best?period=week', retry.start);
  assert.equal(retry.state.starts, 1, 'the retry was answered with the remembered failure');
});
