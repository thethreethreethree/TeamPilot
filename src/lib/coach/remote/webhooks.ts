import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { lookup as lookupCb, type LookupAddress } from "node:dns";
import { request as httpsRequest } from "node:https";

/**
 * Signed outbound webhooks (RSS Phase 9, migration 0286; Gong F31.8). Ported from the scaffold's webhooks.ts.
 *
 * Every request carries `X-Elostate-Timestamp` (unix seconds) and `X-Elostate-Signature` = hex HMAC-SHA256 of
 * `${timestamp}.${body}` under the ENDPOINT's secret. A receiver verifies with `verify` (or the same three lines in its
 * own language) and rejects anything older than MAX_SKEW_SECONDS, which stops replays.
 *
 * ONE SECRET PER ENDPOINT, NOT ONE FOR EVERYONE. The plan said a single deployment-wide secret; but to verify, a
 * receiver has to hold the secret, so one shared secret would let any customer forge webhooks to every other
 * customer. Each endpoint's secret is HMAC(RSS_WEBHOOK_SIGNING_SECRET, endpoint id): different per endpoint, still
 * nothing stored in the database, and the admin can see their own endpoint's secret again at any time.
 */
// call.to_crm (0330): a call sent to the company's CRM from Highlights ("Send to CRM").
export const WEBHOOK_EVENTS = ["session.scored", "session.closed", "deal.closed", "call.to_crm", "agent.ran"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export const MAX_SKEW_SECONDS = 300;
export const MAX_ATTEMPTS = 6;

export class WebhookConfigError extends Error {}
export class EndpointUrlError extends Error {}

/**
 * Can this server sign — and so send — webhooks? The one verdict (§2.2) read by the Protection panel, "Send to CRM",
 * the send cron and /api/health, so none of them can disagree about whether a queued webhook will ever leave.
 */
export function webhooksConfigured(): boolean {
  return Boolean(process.env.RSS_WEBHOOK_SIGNING_SECRET);
}

/** The endpoint's own signing secret. Throws WebhookConfigError when the deployment secret is missing (fail loud). */
export function endpointSecret(endpointId: string, master = process.env.RSS_WEBHOOK_SIGNING_SECRET): string {
  if (!master) throw new WebhookConfigError("RSS_WEBHOOK_SIGNING_SECRET is not set");
  return "whsec_" + createHmac("sha256", master).update(`endpoint:${endpointId}`).digest("hex");
}

export function sign(secret: string, timestamp: number, body: string): string {
  if (!secret) throw new WebhookConfigError("no signing secret");
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

/** For receivers (and our own tests): true only for a fresh timestamp and an exact signature. */
export function verify(secret: string, timestamp: number, body: string, signature: string, nowSec: number): boolean {
  if (!Number.isFinite(timestamp) || Math.abs(nowSec - timestamp) > MAX_SKEW_SECONDS) return false;
  const expected = Buffer.from(sign(secret, timestamp, body), "hex");
  const got = Buffer.from(String(signature), "hex");
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Lower-case, no brackets, no trailing dots ("localhost." is localhost). */
function normHost(h: string): string {
  return h.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.+$/, "");
}

/**
 * True for a literal address on a private, loopback, link-local or shared network. Pure.
 * IPv6: anything starting "::" is refused — unspecified (::), loopback (::1), and IPv4-mapped/compatible forms, which
 * the URL parser rewrites to hex (::ffff:127.0.0.1 → ::ffff:7f00:1) so a dotted-quad test cannot see the 127 inside.
 * No webhook receiver needs one of those. Also unique-local fc00::/7 and link-local fe80::/10.
 */
export function isPrivateAddress(ip: string): boolean {
  const h = normHost(ip);
  if (h.includes(":")) return h.startsWith("::") || h.startsWith("64:ff9b:") || /^f[cd][0-9a-f]{0,2}:/.test(h) || /^fe[89ab][0-9a-f]?:/.test(h);
  return PRIVATE_V4.some((re) => re.test(h));
}

type Resolver = (host: string) => Promise<Array<{ address: string }>>;
const defaultResolver: Resolver = (host) => lookup(host, { all: true, verbatim: true });

/**
 * Does this URL's host resolve to ANY private address? Checked right before each send, because a public-looking name
 * can point inside a network (and can be changed after it was added). A lookup failure is reported as an error, so
 * the attempt fails and is retried, rather than sending blind.
 */
export async function resolvesPrivate(url: string, resolve: Resolver = defaultResolver): Promise<string | null> {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  if (isPrivateAddress(host)) return "address is on a private network";
  try {
    const addrs = await resolve(host);
    if (addrs.length === 0) return "address did not resolve";
    return addrs.some((a) => isPrivateAddress(a.address)) ? "address resolves to a private network" : null;
  } catch (err) {
    return `address did not resolve (${err instanceof Error ? err.message : String(err)})`.slice(0, 300);
  }
}

const PRIVATE_V4 = [
  /^10\./, /^127\./, /^169\.254\./, /^192\.168\./, /^172\.(1[6-9]|2\d|3[01])\./, /^0\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.1[89]\./, /^192\.0\.0\./, /^2(2[4-9]|3\d)\./, /^2(4\d|5[0-5])\./, // benchmarking, IETF, multicast, reserved/broadcast
];

/**
 * https only, and not an address on a private network: the sender runs on our servers, so a URL pointing inside them
 * would let a customer make our servers call internal addresses. Throws EndpointUrlError with a sentence.
 * Hostnames that RESOLVE to a private address are caught at send time by resolvesPrivate (sendSigned).
 */
export function assertEndpointUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(String(raw).trim());
  } catch {
    throw new EndpointUrlError("That isn't a web address.");
  }
  if (u.protocol !== "https:") throw new EndpointUrlError("Webhook addresses must start with https://");
  if (u.username || u.password) throw new EndpointUrlError("Put credentials in your receiver, not in the address.");
  const host = normHost(u.hostname);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    throw new EndpointUrlError("The address can't point at a local or internal machine.");
  }
  if (isPrivateAddress(host)) {
    throw new EndpointUrlError("The address can't point at a private network.");
  }
  if (u.toString().length > 500) throw new EndpointUrlError("That address is too long.");
  return u.toString();
}

/** The JSON a receiver gets. `id` is the delivery id: the same id on a retry, so receivers can de-duplicate. */
export function webhookBody(d: { deliveryId: number | string; event: string; createdAt: string; payload: unknown }): string {
  return JSON.stringify({ id: String(d.deliveryId), event: d.event, createdAt: d.createdAt, data: d.payload });
}

export type SendResult = { ok: boolean; status: number | null; error: string | null };

/** One signed POST with a 10-second limit. Never throws. 2xx = delivered. */
export async function sendSigned(
  url: string,
  secret: string,
  body: string,
  nowSec = Math.floor(Date.now() / 1000),
  fetcher?: typeof fetch,
  resolve: Resolver = defaultResolver,
): Promise<SendResult> {
  const blocked = await resolvesPrivate(url, resolve);
  if (blocked) return { ok: false, status: null, error: blocked };
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "Elostate-Webhooks/1",
    "X-Elostate-Timestamp": String(nowSec),
    "X-Elostate-Signature": sign(secret, nowSec, body),
  };
  // Production: connect only to the address checked at connection time (pinnedPost). The pre-check above would
  // otherwise be beaten by DNS rebinding — a name that resolves public for the check and private for the connect.
  if (!fetcher) return pinnedPost(url, headers, body);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetcher(url, {
      method: "POST",
      headers,
      body,
      redirect: "manual", // a redirect could point anywhere, including inside our network
      signal: ctrl.signal,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, error: res.status >= 300 ? `HTTP ${res.status}` : null };
  } catch (err) {
    const msg = err instanceof Error ? (err.name === "AbortError" ? "timed out after 10 s" : err.message) : String(err);
    return { ok: false, status: null, error: msg.slice(0, 300) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One POST over node:https whose DNS lookup refuses private answers AT CONNECT TIME and connects to the address it
 * checked — no second lookup, so no rebinding window. Never follows redirects; 10-second limit; never throws.
 */
function pinnedPost(url: string, headers: Record<string, string>, body: string): Promise<SendResult> {
  return new Promise((resolveResult) => {
    const done = (r: SendResult) => resolveResult(r);
    let req: ReturnType<typeof httpsRequest>;
    try {
      req = httpsRequest(
        url,
        {
          method: "POST",
          headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
          lookup: (host, opts, cb) => {
            lookupCb(host, { ...opts, all: true }, (err, addrs) => {
              if (err) return (cb as (e: Error | null, a: string, f: number) => void)(err, "", 4);
              const list = addrs as unknown as LookupAddress[];
              const bad = list.find((a) => isPrivateAddress(a.address));
              if (bad || list.length === 0) {
                return (cb as (e: Error | null, a: string, f: number) => void)(new Error("address resolves to a private network"), "", 4);
              }
              if ((opts as { all?: boolean }).all) return (cb as unknown as (e: null, a: LookupAddress[]) => void)(null, list);
              (cb as (e: Error | null, a: string, f: number) => void)(null, list[0]!.address, list[0]!.family);
            });
          },
        },
        (res) => {
          res.resume(); // drain; only the status matters
          const status = res.statusCode ?? 0;
          done({ ok: status >= 200 && status < 300, status, error: status >= 200 && status < 300 ? null : `HTTP ${status}` });
        },
      );
    } catch (err) {
      return done({ ok: false, status: null, error: (err instanceof Error ? err.message : String(err)).slice(0, 300) });
    }
    req.setTimeout(10_000, () => req.destroy(new Error("timed out after 10 s")));
    req.on("error", (err) => done({ ok: false, status: null, error: err.message.slice(0, 300) }));
    req.end(body);
  });
}
