/**
 * Shared strong-password policy for the Add-agent team feature (2026-08-21). The founder's spec for a team
 * password: "8 character password that must contain Letters, Numbers, and Character (lower and upper case),
 * Sensitive." Read as: at least 8 chars, and containing a lowercase letter, an uppercase letter, a digit, and a
 * special character; case-sensitive (all password comparison is case-sensitive by default). Applied to BOTH the
 * admin's team passwords and the user's own password on the forced first-login change, so the rule lives in ONE
 * place (no drift between the two surfaces). Pure + unit-tested; safe to import on client and server.
 */

export const PASSWORD_POLICY_TEXT =
  "At least 8 characters, with an uppercase letter, a lowercase letter, a number, and a special character.";

/** A special character = anything that is not a letter or a digit (and not whitespace). */
const SPECIAL = /[^A-Za-z0-9\s]/;

export interface PasswordCheck {
  ok: boolean;
  /** A single human-readable reason when !ok (the first failing rule), else "". */
  error: string;
}

/**
 * Validate a password against the team policy. Returns the FIRST failing rule so the UI can show one clear
 * message. Rejects whitespace-only padding tricks by requiring the real character classes on the raw string.
 */
export function validateStrongPassword(raw: string): PasswordCheck {
  const pw = raw ?? "";
  if (pw.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  if (pw.length > 200) return { ok: false, error: "Password is too long (max 200 characters)." };
  if (!/[a-z]/.test(pw)) return { ok: false, error: "Password must include a lowercase letter." };
  if (!/[A-Z]/.test(pw)) return { ok: false, error: "Password must include an uppercase letter." };
  if (!/[0-9]/.test(pw)) return { ok: false, error: "Password must include a number." };
  if (!SPECIAL.test(pw)) return { ok: false, error: "Password must include a special character (e.g. ! @ # $ %)." };
  return { ok: true, error: "" };
}

/** Convenience boolean for call sites that only need pass/fail. */
export function isStrongPassword(raw: string): boolean {
  return validateStrongPassword(raw).ok;
}
