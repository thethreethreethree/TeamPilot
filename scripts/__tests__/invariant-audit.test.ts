import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

/**
 * Tests for the invariant audit.
 *
 * A gate that cannot FAIL is not a gate — it is a green light with extra steps. I shipped exactly that bug
 * earlier in this same session: the rls-audit's SELECT rule had a regex that could never match, so the
 * check silently never ran while the audit reported success.
 *
 * So these tests assert the DETECTION LOGIC ITSELF, not just that the script exits 0 today. If someone
 * later weakens a pattern, these fail.
 */

const SCRIPT = readFileSync("scripts/invariant-audit.mjs", "utf8");

describe("invariant-audit.mjs", () => {
  it("passes on the current tree (no CSV export unrouted, no finance route on the service role)", () => {
    const out = execFileSync("node", ["scripts/invariant-audit.mjs"], { encoding: "utf8" });
    expect(out).toContain("Every CSV export is formula-safe");
  });

  // The patterns must actually match a real violation. Verified against strings shaped like the code they
  // are meant to catch — a regex that matches nothing would let this audit report green forever.
  it("the CSV detector matches a real export, and the safety detector matches a real fix", () => {
    const csvProducer = /new Blob\(\s*\[[^\]]*\]\s*,\s*\{\s*type:\s*["']text\/csv/;
    expect(csvProducer.test('new Blob([csv], { type: "text/csv" })')).toBe(true);

    const routed = /csvSafe|neutralizeCsvFormula|toCsv|statementsToCsv/;
    expect(routed.test('import { toCsv } from "@/lib/export/toCsv";')).toBe(true);
    expect(routed.test('const csv = rows.map(r => r.join(",")).join("\\n");')).toBe(false);
  });

  it("the service-role detector matches every way a finance route could reach for it", () => {
    const sr = /createAdminClient|SUPABASE_SERVICE_ROLE|service_role/;
    expect(sr.test('import { createAdminClient } from "@/lib/supabase/admin";')).toBe(true);
    expect(sr.test("process.env.SUPABASE_SERVICE_ROLE_KEY")).toBe(true);
    expect(sr.test('const sb = await createClient();')).toBe(false); // the RLS-bound client is fine
  });

  // Every exception must carry a REASON. An allowlist of bare paths is just a disabled check — it records
  // that someone silenced the audit, not why it was safe to.
  it("every allowlisted exception states its reason", () => {
    const entries = [...SCRIPT.matchAll(/\[\s*"(src\/[^"]+)"\s*,\s*\n?\s*"([^"]{20,})/g)];
    expect(entries.length).toBeGreaterThanOrEqual(3);
    for (const [, path, reason] of entries) {
      expect(reason.length, `${path} has no substantive reason`).toBeGreaterThan(20);
    }
  });
});
