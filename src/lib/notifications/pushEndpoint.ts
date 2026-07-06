/**
 * Validate a Web Push endpoint URL BEFORE storing it — because the fan-out
 * (`sendPushToUsers` → `webpush.sendNotification`) later POSTs to this exact URL
 * server-side. Without a check, an authenticated user could register an INTERNAL
 * target (cloud metadata `169.254.169.254`, `localhost`, an RFC1918 service) and
 * turn the push fan-out into a (blind) SSRF.
 *
 * Real Web Push endpoints are ALWAYS public https URLs on push-service hostnames
 * (fcm.googleapis.com, *.push.services.mozilla.com, web.push.apple.com,
 * *.notify.windows.com). So requiring https + rejecting loopback / link-local /
 * private IP *literals* blocks the SSRF class without rejecting any legitimate
 * endpoint.
 *
 * Scope note: this does NOT resolve DNS, so a public hostname that RESOLVES to a
 * private IP (DNS rebinding) is not caught here — a harder problem for the fetch
 * layer. This blocks the direct-internal-target attack, which is the practical
 * vector for a stored, later-fetched URL.
 */
export function isSafePushEndpoint(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false; // Web Push is always https
  const host = u.hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");

  if (host === "localhost") return false;

  // IPv6 literals contain a colon; ordinary hostnames (fcm.googleapis.com) do
  // NOT — so the IPv6-prefix checks must be gated on `includes(":")`, else
  // "fcm..." would be wrongly rejected for starting with "fc".
  if (host.includes(":")) {
    if (
      host === "::1" || // loopback
      host.startsWith("fe80:") || // link-local
      host.startsWith("fc") || // unique-local fc00::/7
      host.startsWith("fd")
    ) {
      return false;
    }
    return true;
  }

  // IPv4 literal ranges (a hostname that is NOT a dotted-quad falls through as
  // a normal public host).
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 0 || a === 127 || a === 10) return false; // this-net, loopback, private
    if (a === 169 && b === 254) return false; // link-local incl. cloud metadata
    if (a === 192 && b === 168) return false; // private
    if (a === 172 && b >= 16 && b <= 31) return false; // private
  }

  return true;
}
