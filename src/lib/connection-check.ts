/**
 * A check a rep can run, that says what is actually wrong.
 *
 * WHY THIS EXISTS. On 4 September the founder reported every AI feature failing
 * on a phone with full bars and fast Wi-Fi, while the same account worked
 * perfectly in the browser. Five plausible causes were eliminated from the source
 * alone — the routes all set a serverless budget, the API base answers, the
 * streaming client is the right one, every route the app calls accepts a Bearer
 * token, and the app and server share one Supabase project. Each elimination cost
 * a round trip and none of them found it, because the ONE fact that separates the
 * remaining causes — the HTTP status the phone actually receives — never left the
 * phone.
 *
 * That is the real defect: a rep can see that something is broken and has no way
 * to say WHAT. "It does not work" and "the coach service refused us, 401" send
 * two completely different people to two completely different places.
 *
 * NOT A DEBUG SCREEN. It answers three questions a person can act on — are you
 * signed in, can this phone reach the service, does the service accept this
 * account — and the results are written as sentences, not a dump. The status
 * number rides along at the end of the sentence because it is the one token that
 * turns a support message into a fix.
 *
 * IT PROBES A ROUTE THAT COSTS NOTHING AND THAT THE APP ACTUALLY USES. Both
 * halves matter, and the first draft got the second one wrong.
 *
 * It probed `/api/coach/sales-session/quota`, chosen because it reads a count and
 * calls no model. But quota resolves its user from the web COOKIE, and the app is
 * the only caller that would ever have hit it — so this check answered 401 to a
 * perfectly healthy account and would have told every rep the coach service had
 * REFUSED them. A diagnostic that raises a false alarm is worse than none: it
 * sends somebody to fix a thing that is not broken, which is exactly the hour
 * this module was written to save.
 *
 * `macro-mode` replaces it: a GET the app already calls on the doors screen, it
 * returns `{enabled}` from one row, calls no model, and answers the app's own
 * Bearer token (200, verified against production on 4 September). Probing a route
 * the app genuinely uses is the point — a check that authenticates differently
 * from the app can only report on itself.
 */

export type CheckOutcome =
  /** Reached the service and it accepted this account. */
  | { kind: 'ok'; status: number }
  /** Reached the service and it refused. The status is the whole point. */
  | { kind: 'refused'; status: number }
  /** Never reached the service at all. */
  | { kind: 'unreachable' };

export type ConnectionReport = {
  signedIn: boolean;
  /** Null when there was no point asking, because nobody is signed in. */
  coach: CheckOutcome | null;
};

/** The route to probe: authenticated, cheap, calls no model, and used by the app. */
export const PROBE_PATH = '/api/coach/sales-session/macro-mode';

/**
 * The sentences a rep reads, in order.
 *
 * EACH LINE IS A FACT, and the last line is the one worth sending to somebody.
 * Where the answer is "we could not tell", it says so rather than filling in.
 */
export function reportLines(r: ConnectionReport): string[] {
  const lines: string[] = [];
  lines.push(r.signedIn ? 'Signed in on this phone: yes.' : 'Signed in on this phone: no.');

  if (!r.signedIn) {
    lines.push(
      'Because nothing is signed in, the coach service was not asked. Sign in and run this again.',
    );
    return lines;
  }
  if (!r.coach) {
    lines.push('The coach service was not asked.');
    return lines;
  }
  if (r.coach.kind === 'unreachable') {
    lines.push(
      'Could not reach the coach service at all — the request never arrived. If other apps are working, this is the service rather than your signal.',
    );
    return lines;
  }
  if (r.coach.kind === 'ok') {
    lines.push(
      `The coach service answered and accepted this account (${r.coach.status}). If a coaching feature is still failing, the fault is in that feature rather than in signing in.`,
    );
    return lines;
  }
  // The case the founder is in, and the number is the whole message.
  lines.push(
    `The coach service answered and REFUSED this account (${r.coach.status}). This is why the coaching features are not working. Send this screen — the number is what somebody needs.`,
  );
  return lines;
}

/**
 * Turn a status into the outcome.
 *
 * 2xx is acceptance. EVERYTHING ELSE IS A REFUSAL, including a 404: a route that
 * cannot find this account's data behind a token it should recognise is refusing
 * in the way that matters to a rep, and calling it "not found" would send them
 * looking for missing data rather than reporting a rejected sign-in.
 */
export function outcomeFor(status: number): CheckOutcome {
  return status >= 200 && status < 300 ? { kind: 'ok', status } : { kind: 'refused', status };
}

/**
 * Run the check.
 *
 * MIRRORS `coachGet` EXACTLY — same base, same Bearer header, same one refresh
 * on a 401 — because a check that authenticates differently from the app can
 * only report on itself. If this says the account is accepted, the real calls
 * are sending the same thing.
 *
 * NEVER THROWS. A diagnostic that fails with an error is the problem it was
 * built to solve.
 */
export async function runConnectionCheck(deps: {
  token: () => Promise<string | null>;
  refresh: () => Promise<unknown>;
  apiBase: string;
  fetcher?: typeof fetch;
}): Promise<ConnectionReport> {
  const f = deps.fetcher ?? fetch;
  let token: string | null = null;
  try {
    token = await deps.token();
  } catch {
    token = null;
  }
  if (!token) return { signedIn: false, coach: null };

  const call = async (t: string | null) =>
    f(deps.apiBase + PROBE_PATH, {
      method: 'GET',
      headers: { Accept: 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
    });

  try {
    let res = await call(token);
    if (res.status === 401) {
      // The same single retry the real calls make, so a merely expired token is
      // not reported as a refusal.
      try {
        await deps.refresh();
        res = await call(await deps.token());
      } catch {
        /* keep the first answer */
      }
    }
    return { signedIn: true, coach: outcomeFor(res.status) };
  } catch {
    return { signedIn: true, coach: { kind: 'unreachable' } };
  }
}
