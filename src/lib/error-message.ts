/**
 * Which words a rep actually sees when a screen cannot load.
 *
 * THE BUG THIS FIXES, and it was in every data screen in the app. Each one wrote
 * a good sentence — "Could not reach your numbers. Try again when you have
 * signal." — and then put it in the FALLBACK position:
 *
 *     e instanceof Error && e.message ? e.message : 'Could not reach your numbers…'
 *
 * An Error almost always has a message, so the good sentence was nearly
 * unreachable. What a rep in a dead zone actually got was `Network request
 * failed`, or `TypeError: Failed to fetch`, or a PostgREST string about a
 * relation. Every one of those reads as the app being broken rather than the
 * signal being bad, and none of them says what to do.
 *
 * THE RULE, and it comes from where the error was born rather than from what it
 * says. Guessing from the text is what `signInMessage` has to do, because the
 * auth library gives nothing else; here there is a better signal available.
 *
 *   - An error carrying a numeric HTTP STATUS came back from the coach API,
 *     which writes its errors for people: "Deal value must be at most
 *     100000000", "Manager access required". Those are worth showing verbatim —
 *     they say what to change, and the screen cannot know them.
 *
 *   - An error with NO status never reached a server. It is a dropped socket, a
 *     DNS failure, a JSON parse, or a Supabase client error whose message is
 *     written for whoever wrote the query. The screen's own sentence is better
 *     than all of them, because the screen knows what the rep was trying to do.
 *
 * WHAT IT NEVER DOES. It never invents a diagnosis. When it falls back, it uses
 * the caller's sentence unchanged — the screens already say the right thing, they
 * were simply never reaching it.
 */

/**
 * An error this app raised on purpose, whose message was written for the rep.
 *
 * The status rule below cannot see these: a recording file that vanished before
 * it could be saved never touches a server, so it has no status, and it would be
 * replaced by the caller's generic sentence — losing the one message that
 * actually says what happened to the call. Throwing this instead says "these
 * words are the answer", and it is the only way to say so that does not depend
 * on guessing from the text.
 */
export class HumanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HumanError';
  }
}

/**
 * True for an error this app authored for a person.
 *
 * Checked by NAME as well as by instance: the class can be duplicated across
 * bundles, and a check that quietly fails would silently downgrade a real message
 * back to the generic one — the exact bug this module exists to fix.
 */
function isHuman(e: unknown): e is Error {
  return (
    e instanceof HumanError ||
    ((e as { name?: unknown })?.name === 'HumanError' &&
      typeof (e as { message?: unknown })?.message === 'string')
  );
}

/**
 * The one shape that means "a server answered and said why".
 *
 * Deliberately structural rather than an `instanceof` check against the API
 * client's own class: the error crosses module boundaries and may be rebuilt on
 * the way, and this module must not import the HTTP client to ask a question
 * about a number.
 */
function statusOf(e: unknown): number | undefined {
  const status = (e as { status?: unknown })?.status;
  return typeof status === 'number' && Number.isFinite(status) ? status : undefined;
}

/**
 * The server's own marker that it WROTE this error for a person.
 *
 * The coach's generative routes answer an LLM failure with `{error, kind}` and a
 * 502 — deliberately, and on the record: "surfacing the LlmError cause to the
 * AUTHENTICATED, entitled, same-tenant user is a deliberate design decision
 * (2026-07-25)". `kind` is the flag that separates that written sentence from
 * the framework's own "Internal Server Error".
 */
function kindOf(e: unknown): string | null {
  const kind = (e as { kind?: unknown })?.kind;
  return typeof kind === 'string' && kind.trim() ? kind.trim() : null;
}

/**
 * A message from a server that is meant for a person, or null.
 *
 * A 5xx IS EXCLUDED — UNLESS THE SERVER LABELLED IT. Plain 5xx bodies carry
 * "Internal Server Error", which is true, unhelpful and alarming, and the
 * caller's own sentence beats it. But this rule was swallowing the one class of
 * 5xx that is worth more than anything a screen could write.
 *
 * FOUND 4 SEPTEMBER, and it cost hours. Every AI feature was failing in the app
 * while the website was fine. The coach's generative routes were answering 502
 * with a real explanation of what the model did — and this function threw every
 * one of them away, so the app fell back to "try again when you have signal" on
 * a phone with full bars. The server was saying exactly what was wrong and the
 * app was refusing to listen.
 *
 * So a 5xx carrying `kind` is shown. Everything else 5xx still falls back.
 */
function serverSentence(e: unknown): string | null {
  const status = statusOf(e);
  if (status === undefined) return null;
  if (status >= 500 && !kindOf(e)) return null;
  const message = (e as { message?: unknown })?.message;
  if (typeof message !== 'string') return null;
  const trimmed = message.trim();
  if (!trimmed) return null;
  // `HTTP 404` is what the client synthesises when a route returned no body of
  // its own. It is a status code wearing a sentence's clothes.
  if (/^HTTP \d{3}$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * What to put on the screen.
 *
 * `fallback` is the screen's own sentence and is used whenever the failure did
 * not come with something a person wrote.
 */
export function humanError(e: unknown, fallback: string): string {
  if (isHuman(e) && e.message.trim()) return e.message.trim();
  return serverSentence(e) ?? fallback;
}
