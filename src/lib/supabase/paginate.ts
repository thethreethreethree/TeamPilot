/**
 * fetchAllPaged — fetch every row of a PostgREST query, paging past the server's default
 * 1000-row cap.
 *
 * WHY THIS EXISTS: an unbounded `.select()` is silently truncated by PostgREST at 1000 rows.
 * When the result is then aggregated in JS (counts, sums, rates), the aggregate is SILENTLY
 * WRONG on any table that has grown past 1000 matching rows — and it looks plausible, so no
 * one notices. That is the honesty-thesis failure class (a wrong number is worse than a
 * visible error), and it worsens exactly as a customer succeeds and accumulates data. The KPI
 * layer computes win-rate / deal-count / revenue from a full session read, so it must read the
 * FULL set, not the first page.
 *
 * The caller passes a FACTORY that builds a fresh query for a given `.range(from, to)` window
 * (a PostgREST builder is single-use, so it must be rebuilt per page). Pages are read until a
 * short page proves the end. It FAILS HONESTLY (throws) rather than returning a partial set as
 * if it were complete — returning the truncated rows would reintroduce the very bug this closes.
 *
 * NOTE (downstream ripple): once a set exceeds 1000 rows, any follow-up `.in("id", ids)` read
 * built from those ids carries >1000 ids and needs its own chunking + paging. This helper fixes
 * the primary aggregate read; large IN-list reads are a separate, higher-volume concern. The
 * fully-consolidated fix is a server-side aggregation RPC (does the math in SQL, fetches nothing).
 */
export async function fetchAllPaged<T>(
  makePage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  opts: { pageSize?: number; label?: string; maxRows?: number } = {},
): Promise<T[]> {
  const pageSize = opts.pageSize ?? 1000;
  const label = opts.label ?? "paged fetch";
  // Backstop so a logic error can never spin forever; generous vs. realistic KPI volumes.
  const maxRows = opts.maxRows ?? 200_000;
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await makePage(from, from + pageSize - 1);
    if (error) throw new Error(`${label} failed: ${error.message}`);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break; // a short (or empty) page is the end
    if (all.length >= maxRows) {
      throw new Error(`${label} exceeded ${maxRows} rows — refusing to fetch unbounded; use a server-side aggregate`);
    }
  }
  return all;
}

/**
 * fetchAllPaged adapted back to Supabase's `{ data, error }` result shape.
 *
 * fetchAllPaged FAILS HONESTLY by throwing (so a truncated set can never masquerade as complete). But some call
 * sites page a read INSIDE a Promise.all, or feed a §3.4 error-combine (e.g. `chainReadError = eA ?? eB ?? …`)
 * that expects the Supabase `{ data, error }` shape. This maps the throw to `{ data: null, error }` and a success
 * to `{ data, error: null }`, so those sites keep their existing honest-error handling unchanged. The `error` is
 * always a real Error (a non-Error throw is wrapped), so a truthiness/`.message` check behaves.
 */
export async function fetchAllPagedResult<T>(
  makePage: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  opts: { pageSize?: number; label?: string; maxRows?: number } = {},
): Promise<{ data: T[] | null; error: Error | null }> {
  try {
    return { data: await fetchAllPaged<T>(makePage, opts), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}
