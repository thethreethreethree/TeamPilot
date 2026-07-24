import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * FAIL-OPEN INVARIANT GUARD — profiles.status must stay exactly {'active','removed'}.
 *
 * Two auth gates block access with a DENYLIST, not an allowlist:
 *   - src/lib/api/careAgentAuth.ts  (deriveCareAccess: isRemoved = status === 'removed' → block)
 *   - src/lib/api/extensionAuth.ts  (status === 'removed' → block)
 *
 * A denylist is safe ONLY while the column can be exactly one of two values. The moment a THIRD
 * status is introduced (e.g. 'suspended', 'invited', 'pending'), BOTH gates silently FAIL OPEN — a
 * suspended agent, being "not 'removed'", keeps full access to live customer conversations. The
 * safety of those gates therefore rests on the DB CHECK constraint (migration 0008:
 * `check (status in ('active','removed'))`), which today is only asserted by a code COMMENT.
 *
 * This test turns that comment-invariant into an enforced one (§0.1 structural-defense discipline:
 * a required precondition must be enforced, not merely fortunate). If it fails, someone changed the
 * allowed profiles.status set — before shipping that, FLIP BOTH GATES to an allowlist
 * (`status === 'active'`) so a new status defaults to NO access. Migrations are append-only, so a
 * change is always a NEW migration altering the constraint; this scans them all and checks the
 * effective (last-defined) set.
 */

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

// A statement targets the `profiles` table if it creates/alters it.
const PROFILES_STMT =
  /\b(?:alter|create)\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?profiles\b/i;
// The status CHECK list, e.g. check (status in ('active', 'removed'))
const STATUS_CHECK = /check\s*\(\s*status\s+in\s*\(([^)]*)\)\s*\)/i;

function extractValues(list: string): string[] {
  return Array.from(list.matchAll(/'([^']*)'/g)).map((m) => m[1]);
}

describe("profiles.status fail-open invariant", () => {
  it("keeps profiles.status constrained to exactly {active, removed} (both auth gates are denylists)", () => {
    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort(); // lexical sort == migration order (zero-padded numeric prefixes)

    let effective: Set<string> | null = null;
    let source = "";

    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      // Split into statements; a profiles status CHECK lives in a single statement.
      for (const stmt of sql.split(";")) {
        if (!PROFILES_STMT.test(stmt)) continue;
        const m = stmt.match(STATUS_CHECK);
        if (!m) continue;
        effective = new Set(extractValues(m[1]));
        source = file; // later migrations override earlier ones
      }
    }

    // The invariant source must exist at all — if it vanished, the gates lost their footing.
    expect(
      effective,
      "No profiles.status CHECK constraint found in any migration. The two denylist auth gates " +
        "(careAgentAuth.ts, extensionAuth.ts) depend on it existing. Restore it or flip both gates " +
        "to an allowlist."
    ).not.toBeNull();

    const allowed = Array.from(effective!).sort();
    expect(
      allowed,
      `profiles.status allowed set changed to {${allowed.join(", ")}} in ${source}. The C.A.R.E ` +
        `agent gate (src/lib/api/careAgentAuth.ts) and the extension gate (src/lib/api/extensionAuth.ts) ` +
        `both block ONLY status==='removed' — any new status FAILS OPEN (keeps access). Before shipping ` +
        `this migration, flip BOTH gates to an allowlist (status === 'active').`
    ).toEqual(["active", "removed"]);
  });
});
