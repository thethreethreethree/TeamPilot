/**
 * Shared Supabase-client mock for data-layer unit tests (no live DB).
 *
 * Not a test file (underscore prefix, no `.test`), so vitest won't run it.
 *
 * Usage:
 *   const calls: Array<[string, unknown[]]> = [];
 *   vi.mocked(createClient).mockResolvedValue(
 *     makeSupabaseClient({ coaching_sessions: { data: [row] } }, calls) as never
 *   );
 *
 * Design notes / gotchas:
 *  - The CLIENT object must be non-thenable, else vi's mockResolvedValue follows
 *    its `.then` and unwraps it. Only the query BUILDER returned by .from() is
 *    the thenable.
 *  - The builder is a Proxy: every method (select/eq/order/in/gte/limit/…)
 *    records its call and returns the builder, so any chain + any await point
 *    works. Awaiting resolves to the table's canned result.
 *  - Query FILTERS are not evaluated — you hand each table exactly the rows it
 *    should return. Assert scoping via the recorded `calls` (e.g. that
 *    .eq("agent_id", id) was issued), and assert the JS transform via the
 *    function's return value.
 */
export function makeSupabaseClient(
  byTable: Record<string, unknown>,
  calls: Array<[string, unknown[]]>
) {
  function builder(result: unknown) {
    const b: Record<string | symbol, unknown> = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            return (resolve: (v: unknown) => void) => resolve(result);
          }
          return (...args: unknown[]) => {
            calls.push([String(prop), args]);
            return b;
          };
        },
      }
    );
    return b;
  }
  return {
    from: (table: string, ...rest: unknown[]) => {
      calls.push(["from", [table, ...rest]]);
      return builder(byTable[table] ?? { data: [] });
    },
  };
}
