/**
 * One request per key while it is in flight.
 *
 * WHY, SPECIFICALLY. Progress and Breakdown are two panes of ONE screen and both stay mounted, so
 * `useFocusEffect` fires in both the moment the tab is focused — and they share a period, which
 * means both ask for `/breakdown?period=week` in the same tick. That is two identical reads, and
 * the second one is not merely waste: the two panes could be served from different moments, and
 * Breakdown's reconciling footer ASSERTS an identity over numbers Progress is printing beside it.
 * Two boards one swipe apart, disagreeing, each rendering confidently — the exact shape this build
 * exists to make impossible.
 *
 * IN FLIGHT ONLY, AND THAT IS THE WHOLE DESIGN. Nothing is remembered once a response settles, so
 * pull-to-refresh is still a real read. A response cache would have been the larger change and the
 * wrong one: it would answer a rep's deliberate refresh with the number they were already looking
 * at, which is worse than a slow screen because it looks like a fresh one.
 *
 * A FAILURE IS SHARED TOO. Callers that arrived together get the same rejection, because they asked
 * the same question at the same instant and there is only one truthful answer to give them. The map
 * is cleared either way, so the next attempt is a real attempt rather than a replayed failure.
 *
 * PURE AND MAP-IN, so it can be tested without a network or a native module. `api.ts` imports
 * `expo/fetch` transitively, which the unit runner cannot load at all — a coalescer that lived
 * there would only ever have been checked by reading it.
 */
export function coalesce<T>(
  inFlight: Map<string, Promise<unknown>>,
  key: string,
  start: () => Promise<T>,
): Promise<T> {
  const existing = inFlight.get(key);
  if (existing) return existing as Promise<T>;

  const started = start().finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, started);
  return started;
}
