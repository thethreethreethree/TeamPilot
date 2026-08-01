/**
 * Coerce a model's text response into a parseable JSON string.
 *
 * WHY THIS EXISTS: callers that need structured output pass `expectJson: true`. The DeepSeek provider
 * honors it via `response_format: { type: "json_object" }`, so DeepSeek returns BARE JSON. The Anthropic
 * provider (the failover) has no equivalent — it returns whatever the model wrote, which for a "respond
 * with JSON" prompt is USUALLY bare JSON but sometimes arrives wrapped in a ```json fence or with a short
 * preamble ("Here is the analysis:\n{…}"). The ~14 `JSON.parse(text)` call sites are defensively
 * try-caught, so a fenced response doesn't crash — but it degrades to an EMPTY result (the "error dressed
 * as no-data" class), and it does so exactly when the system is already degraded (a DeepSeek outage is
 * what routed the call to Anthropic in the first place). This helper makes the failover path as robust as
 * the primary: it extracts the JSON from a fenced / prose-wrapped response.
 *
 * SAFETY: it is behaviour-preserving on the happy path — text that is already valid JSON is returned
 * trimmed, unchanged (so DeepSeek's bare-JSON output is a passthrough). The transformation only engages
 * when the text is NOT already parseable — i.e. cases that ALREADY fail downstream today — and if it
 * can't find valid JSON it returns the fence-stripped remainder, so the downstream `JSON.parse` fails
 * exactly as it would have. It can never turn a currently-passing parse into a failure.
 */
export function coerceJsonText(text: string): string {
  if (typeof text !== "string") return text;
  const trimmed = text.trim();

  // Fast path: already valid JSON (DeepSeek's json_object output, and a well-behaved Anthropic reply).
  if (isParseable(trimmed)) return trimmed;

  // Strip a Markdown code fence if the model wrapped the JSON in one (```json … ``` or ``` … ```).
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fence?.[1] ?? trimmed).trim();
  if (isParseable(candidate)) return candidate;

  // Extract the outermost {…} or […] span, tolerating a prose preamble/suffix around it. Only returned
  // if it actually parses — otherwise we fall through, never returning a worse string than we started with.
  const span = outermostJsonSpan(candidate);
  if (span && isParseable(span)) return span;

  // No parseable JSON found — hand back the fence-stripped remainder. Downstream JSON.parse will fail and
  // the caller's existing try/catch degrades exactly as it does today (never worse than the raw text).
  return candidate;
}

function isParseable(s: string): boolean {
  if (!s) return false;
  try {
    JSON.parse(s);
    return true;
  } catch {
    return false;
  }
}

/** The substring from the first opening brace/bracket to the matching LAST closing one of that kind. */
function outermostJsonSpan(s: string): string | null {
  const firstObj = s.indexOf("{");
  const firstArr = s.indexOf("[");
  const starts = [firstObj, firstArr].filter((i) => i >= 0);
  if (starts.length === 0) return null;
  const start = Math.min(...starts);
  const close = s[start] === "{" ? "}" : "]";
  const end = s.lastIndexOf(close);
  if (end <= start) return null;
  return s.slice(start, end + 1);
}
