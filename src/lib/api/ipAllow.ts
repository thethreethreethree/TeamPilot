/**
 * Trusted addresses for an API key (Engage plan E15, 0393; Gong F33.10). Whether an IP address falls in any of a key's
 * allowed entries — a single address or a CIDR range, IPv4 or IPv6 (an IPv4-mapped IPv6 address, ::ffff:1.2.3.4, is
 * read as its IPv4 address). Anything that doesn't parse never matches: an allow-list fails closed. Pure.
 */

/** An address as bits (big-endian) and its family, or null when it doesn't parse. */
function parse(ip: string): { v: 4 | 6; bits: bigint } | null {
  const s = ip.trim();
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(s);
  if (v4) {
    const parts = v4.slice(1).map(Number);
    if (parts.some((p) => p > 255)) return null;
    return { v: 4, bits: parts.reduce((acc, p) => (acc << 8n) | BigInt(p), 0n) };
  }
  if (!s.includes(":") || !/^[0-9a-fA-F:.]+$/.test(s)) return null;
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(s);
  if (mapped) return parse(mapped[1]!);
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? head.length !== 8 : missing < 1) return null;
  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-fA-F]{1,4}$/.test(g))) return null;
  return { v: 6, bits: groups.reduce((acc, g) => (acc << 16n) | BigInt(parseInt(g, 16)), 0n) };
}

/** Whether `ip` is in `entry` ("1.2.3.4", "10.0.0.0/8", "2001:db8::/32"). Pure. */
export function inRange(ip: string, entry: string): boolean {
  const [base, lenS] = entry.trim().split("/");
  const a = parse(ip);
  const b = parse(base ?? "");
  if (!a || !b || a.v !== b.v) return false;
  const width = a.v === 4 ? 32 : 128;
  const len = lenS === undefined ? width : /^\d{1,3}$/.test(lenS) ? Number(lenS) : -1;
  if (len < 0 || len > width) return false;
  const shift = BigInt(width - len);
  return a.bits >> shift === b.bits >> shift;
}

/** Whether a request from `ip` may use a key with `allowed` (null/empty = anywhere; no address = refused). Pure. */
export function ipAllowed(ip: string | null | undefined, allowed: string[] | null | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (!ip) return false;
  return allowed.some((e) => inRange(ip, e));
}

/**
 * The caller's address for an allow-list: Vercel's x-real-ip, which the platform sets to the connecting address. Not
 * x-forwarded-for: its first entry can be sent by the client. An outside precondition (§1.5.3): this holds on Vercel.
 */
export function requestIp(req: Request): string | null {
  const v = req.headers.get("x-real-ip")?.trim();
  return v ? v : null;
}

/** Whether an entry is a usable address or CIDR range (what 0393's cidr type will accept as written here). Pure. */
export function validEntry(entry: string): boolean {
  const [base, len] = entry.trim().split("/");
  const a = parse(base ?? "");
  if (!a) return false;
  if (len === undefined) return true;
  if (!/^\d{1,3}$/.test(len)) return false;
  const n = Number(len);
  if (n > (a.v === 4 ? 32 : 128)) return false;
  // cidr refuses host bits set past the prefix ("10.0.0.1/8"); say so here rather than as a database error.
  const shift = BigInt((a.v === 4 ? 32 : 128) - n);
  return (a.bits >> shift) << shift === a.bits;
}
