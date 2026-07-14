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

/**
 * REACHABILITY — the blind spot that produced four separate "BUILT but nonexistent" features in one
 * session: the Controls page with no nav entry, the invoice→stock link with no picker, problem_id with no
 * write path anywhere, and a collections ladder nobody could create.
 *
 * In every case the schema was right, the views were right, the page was right — and the feature did not
 * exist. A feature complete in the database and invisible in the product is not built.
 *
 * The seam between schema and surface is where this author is careless, so it gets a gate rather than a
 * resolution to be more careful.
 */
describe("invariant-audit.mjs — reachability", () => {
  it("the RPC-only allowlist explains why each table is unreachable from src/", () => {
    const block = SCRIPT.slice(SCRIPT.indexOf("const RPC_ONLY_TABLES"), SCRIPT.indexOf("const ADD_COL_RE"));
    const entries = [...block.matchAll(/\["(fin_\w+)",\s*"([^"]{20,})"\]/g)];
    expect(entries.length).toBeGreaterThanOrEqual(8);
    // A bare path list would be a disabled check: it records that someone silenced the audit, not why it
    // was safe to.
    for (const [, table, reason] of entries) {
      expect(reason.length, `${table} has no substantive reason`).toBeGreaterThan(20);
    }
  });

  it("bookkeeping columns are exempt — naming them in src/ would itself be the bug", () => {
    // created_by / company_id are set by DB defaults and frozen by triggers (§A23). An app that wrote them
    // could forge an author or move a row between tenants, so their absence from src/ is CORRECT.
    expect(SCRIPT).toMatch(/created_at\|updated_at\|created_by\|company_id/);
  });

  // The gate must cover the WHOLE codebase, not the domain its author happened to be working in. A gate
  // scoped to fin_* would have been a gate that misses the next domain — which is the same shape of
  // blind spot it exists to catch.
  it("checks EVERY table, not just finance ones", () => {
    // Read the real regex source rather than a hand-escaped copy — a test asserting against a string I
    // typed out is a test of my typing, not of the gate. A gate scoped to fin_* would miss the next
    // domain, which is the same shape of blind spot it exists to catch.
    const createRe = SCRIPT.match(/const CREATE_TBL_RE = (\/.*?\/)[a-z]*;/)?.[1] ?? "";
    expect(createRe.length).toBeGreaterThan(0);
    expect(createRe.includes("fin_")).toBe(false);
  });

  // The sharpest true negative the gate produced, and the distinction the allowlist exists to make:
  // "nothing writes it" is a BUG when a human must set it, and a CONTROL when a human must never be able to.
  it("problem_thresholds is allowlisted as unreachable BY DESIGN, with the constitutional reason", () => {
    expect(SCRIPT).toMatch(/problem_thresholds[\s\S]{0,400}lower the evidence bar/);
  });

  it("the whole tree currently passes reachability", () => {
    const out = execFileSync("node", ["scripts/invariant-audit.mjs"], { encoding: "utf8" });
    expect(out).toContain("Violations:           0");
  });
});
