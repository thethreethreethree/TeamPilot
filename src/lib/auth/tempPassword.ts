import { randomInt } from "node:crypto";
import { isStrongPassword } from "./passwordPolicy";

/**
 * A one-time temporary password an admin reads out to a locked-out teammate.
 *
 * WHY GENERATED AND NOT ADMIN-CHOSEN. The admin never types this, so it cannot be a weak or reused secret, and
 * it cannot quietly become a second shared team password handed to five people. It is generated, shown ONCE,
 * and paired with profiles.must_change_password so it stops working the moment its owner signs in.
 *
 * WHY THESE ALPHABETS. Ambiguous glyphs are removed — no O/0, no I/l/1 — because the delivery channel for this
 * string is a human reading it down a phone line or retyping it from a text message. A password that is
 * technically strong and practically unreadable just produces a second support call, which is the failure this
 * whole feature exists to end.
 *
 * Satisfies validateStrongPassword BY CONSTRUCTION (one of each required class is placed, not hoped for), and
 * the assertion below makes that structural rather than a comment: if the alphabets are ever edited such that a
 * class is lost, this throws at the call site instead of creating a login nobody can use.
 */

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I, no O
const LOWER = "abcdefghijkmnopqrstuvwxyz"; // no l
const DIGIT = "23456789"; // no 0, no 1
const SPECIAL = "!@#$%*?"; // shell- and URL-safe enough to paste without escaping

// charAt (not []) because noUncheckedIndexedAccess types index access as string | undefined; charAt is total.
const pick = (s: string) => s.charAt(randomInt(s.length));

/** Fisher-Yates over a crypto RNG, so the required characters aren't always in the same positions. */
function shuffle(chars: string[]): string[] {
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    // Bounded by construction; the ?? "" only exists to satisfy noUncheckedIndexedAccess, and an empty string
    // sneaking in would be caught by the policy assertion below rather than reaching a login screen.
    const a = chars[i] ?? "";
    const b = chars[j] ?? "";
    chars[i] = b;
    chars[j] = a;
  }
  return chars;
}

export function generateTempPassword(length = 14): string {
  if (length < 8) throw new Error("temp password must be at least 8 characters (policy floor)");
  const pool = UPPER + LOWER + DIGIT + SPECIAL;
  const required = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SPECIAL)];
  const rest = Array.from({ length: length - required.length }, () => pick(pool));
  const out = shuffle([...required, ...rest]).join("");

  // Structural, not decorative: the generator's contract IS the shared policy, so a drifting alphabet fails
  // here rather than at a rep's login screen.
  if (!isStrongPassword(out)) {
    throw new Error("generated temp password failed the shared policy — alphabets have drifted");
  }
  return out;
}
