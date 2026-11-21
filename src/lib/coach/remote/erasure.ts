import "server-only";
import { createHmac, hkdfSync } from "node:crypto";

/**
 * Erasing a customer's data (RSS Phase 8, migration 0285; CLAUDE.md §3.1.1 / AMD-014; Gong F33.6).
 *
 * The identifier a company admin types (a phone number, an email, a client name) is NEVER stored. The request row
 * keeps only a keyed hash — so a repeat request for the same customer can be recognised — and a masked hint for the
 * admin to read ("phone ••••0123"). The hash is an HMAC, not a bare SHA-256: a phone number has so few possible
 * values that a bare hash could be reversed by trying them all; without the server's key it cannot.
 */
export const ERASURE_KINDS = ["phone", "email", "client_label"] as const;
export type ErasureKind = (typeof ERASURE_KINDS)[number];

export class ErasureInputError extends Error {}

/** The form the database search and the hash both use. Throws ErasureInputError with a sentence for the admin. */
export function normaliseIdentifier(kind: ErasureKind, raw: string): string {
  const v = String(raw ?? "").trim();
  if (kind === "phone") {
    const digits = v.replace(/\D/g, "");
    if (digits.length < 7) throw new ErasureInputError("A phone number needs at least 7 digits.");
    // Same rule as rss_erasure_matches: the national part (last 10 digits) when a country code is included.
    return digits.length > 10 ? digits.slice(-10) : digits;
  }
  if (kind === "email") {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) throw new ErasureInputError("That isn't an email address.");
    return v.toLowerCase();
  }
  if (v.length < 2) throw new ErasureInputError("Give the client name as it was entered on the call.");
  return v.toLowerCase();
}

/** "phone ••••0123", "email p•••@acme.com", "client P•••". Never enough to recover the identifier. */
export function maskedHint(kind: ErasureKind, normalised: string): string {
  if (kind === "phone") return `phone ••••${normalised.slice(-4)}`;
  if (kind === "email") {
    const [user = "", domain = ""] = normalised.split("@");
    return `email ${user.slice(0, 1)}•••@${domain}`.slice(0, 60);
  }
  return `client ${normalised.slice(0, 1).toUpperCase()}•••`;
}

/**
 * HMAC-SHA256 of kind + normalised identifier, keyed from the server's service-role secret (HKDF, so the stored hash
 * is not a function of the raw secret). Throws when the secret is missing — erasure must fail loud, not hash with
 * an empty key (§1.5.3).
 */
export function identifierHash(kind: ErasureKind, normalised: string, secret = process.env.SUPABASE_SERVICE_ROLE_KEY): string {
  if (!secret) throw new Error("erasure hashing key unavailable (SUPABASE_SERVICE_ROLE_KEY not set)");
  const key = Buffer.from(hkdfSync("sha256", secret, "elostate-erasure", "erasure-request-v1", 32));
  return createHmac("sha256", key).update(`${kind}:${normalised}`).digest("hex");
}
