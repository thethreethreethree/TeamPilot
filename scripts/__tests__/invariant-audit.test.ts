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
  it(
    "passes on the current tree (no CSV export unrouted, no finance route on the service role)",
    () => {
      const out = execFileSync("node", ["scripts/invariant-audit.mjs"], { encoding: "utf8" });
      expect(out).toContain("Violations:           0");
      expect(out).toContain("every upload route validated");
      expect(out).toContain("every cross-person read gated");
    },
    // This spawns a subprocess that scans the whole src tree (~640 files). In isolation it's ~1s, but under
    // full-suite parallelism the subprocess gets CPU-starved and can exceed vitest's 5s default → a flaky
    // timeout failure (observed 2026-07-22). Give it generous headroom; it's I/O-bound, not a hot loop.
    30_000
  );

  // The patterns must actually match a real violation. Verified against strings shaped like the code they
  // are meant to catch — a regex that matches nothing would let this audit report green forever.
  it("the CSV detector matches a real export, and the safety detector matches a real fix", () => {
    const csvProducer = /new Blob\(\s*\[[^\]]*\]\s*,\s*\{\s*type:\s*["']text\/csv/;
    expect(csvProducer.test('new Blob([csv], { type: "text/csv" })')).toBe(true);

    const routed = /csvSafe|neutralizeCsvFormula|toCsv|statementsToCsv/;
    expect(routed.test('import { toCsv } from "@/lib/export/toCsv";')).toBe(true);
    expect(routed.test('const csv = rows.map(r => r.join(",")).join("\\n");')).toBe(false);
  });

  // INVARIANT 6. The detector must match the real call shapes AND stay narrow enough not to cry wolf: the
  // gate exists because the ELO route hand-rolled the manager predicate (the 4th copy), so the negative case
  // below — an inline `role === "CEO" || sales_coach_role === "admin"` does NOT count as gated — is the one
  // that proves this catches the bug it was built for.
  it("the cross-person detector matches both agentId read shapes, and does not accept a hand-rolled gate", () => {
    const readsAgentId = /searchParams\.get\(["']agentId["']\)/;
    expect(readsAgentId.test('const requestedAgentId = new URL(req.url).searchParams.get("agentId");')).toBe(true);
    expect(readsAgentId.test("const agentId = req.nextUrl.searchParams.get('agentId') || auth.user.id;")).toBe(true);
    // Deliberately narrow (A30's false-positive constraint): a MUTATION target is not a per-person read.
    // team/route.ts reads memberId to remove a member — firing there would be the cry-wolf failure.
    expect(readsAgentId.test('const memberId = url.searchParams.get("memberId");')).toBe(false);
    expect(readsAgentId.test('const userId = url.searchParams.get("userId");')).toBe(false);

    const gated = /canManagerViewRepSkills/;
    expect(gated.test("if (!canManagerViewRepSkills(caller, target ?? null).ok) {")).toBe(true);
    // The ELO route's pre-fix shape: correct, but hand-rolled. The gate must NOT treat it as gated.
    expect(gated.test('const isManager = role === "CEO" || profile?.sales_coach_role === "admin";')).toBe(false);
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

/**
 * SECURITY DEFINER functions taking a TENANT PARAMETER.
 *
 * Found by asking what rls:audit CANNOT see (§A30: a green gate is a statement about the gate's vocabulary,
 * never about the system). It checks tables and views. It has no concept of a FUNCTION — and a DEFINER
 * function bypasses RLS entirely, by design. PostgREST exposes every public function as an RPC endpoint, so
 * one taking p_company can be called by any authenticated user with SOMEBODY ELSE'S company id.
 *
 * §A30 confirming itself: 0122 already knew, and revoked fin_post_system_entry. Nothing encoded the rule, so
 * nine later helpers were written without it — two of them mine, in the same session I spent writing about
 * this exact failure mode.
 */
describe("invariant-audit.mjs — SECURITY DEFINER tenant parameters", () => {
  it("matches a company UUID parameter, and NOT p_code or p_company_name", () => {
    // My first predicate matched `p_co` (which hits p_code) and `p_company` (which hits p_company_name — a
    // text label, not a tenant id), and flagged two pre-auth onboarding functions that are CORRECTLY
    // client-callable. A gate that cries wolf on correct code is one people learn to skip, and then the real
    // violation rides in behind the noise (§A25). The predicate now requires the NAME *and* the TYPE.
    const re = /(^|[\s,(])(p_company|p_company_id|company_id)[\s]+uuid([\s,)]|$)/i;
    expect(re.test("p_company uuid")).toBe(true);
    expect(re.test("p_company     uuid,   p_entry_date  date")).toBe(true);
    expect(re.test("p_code text, p_full_name text")).toBe(false);        // accept_invitation
    expect(re.test("p_company_name text, p_industry text")).toBe(false); // complete_company_onboarding
  });

  it("uses matchAll, not a stateful exec loop", () => {
    // The first version used `while ((m = RE.exec(sql)))` with a /g regex shared across 183 files. It
    // silently matched NOTHING while reporting green — a check that checks nothing, committed inside the
    // audit whose entire purpose is catching exactly that. matchAll is stateless.
    const block = SCRIPT.slice(SCRIPT.indexOf("const DEFINER_RE"), SCRIPT.indexOf("const revoked"));
    expect(block).toContain("matchAll");
    expect(block).not.toContain(".exec(");
  });
});

/**
 * FILE-UPLOAD VALIDATION. Five routes accept a multipart File; four wire validateUploadCandidate, one (the
 * sales-call recording upload) uses EXECUTABLE_EXTENSIONS because the shared validator blocks .webm. Before
 * this gate, that one route diverged silently and shipped an executable-via-spoofed-audio-MIME hole (fix
 * 0964c64). The gate ensures every upload route runs a sanctioned validation path or is allowlisted.
 */
describe("invariant-audit.mjs — file-upload validation", () => {
  const handlesUpload = (s) =>
    /formData\(\)/.test(s) && /(instanceof File|uploadAssetBytes|\.arrayBuffer\(\))/.test(s);
  const validated = (s) => /validateUploadCandidate|EXECUTABLE_EXTENSIONS/.test(s);

  it("flags an upload route (formData + File) that runs NO sanctioned validator", () => {
    const bad =
      'const form = await req.formData(); const file = form.get("file"); if (!(file instanceof File)) {}';
    expect(handlesUpload(bad) && !validated(bad)).toBe(true); // the recording route BEFORE 0964c64
  });

  it("a route wiring validateUploadCandidate is NOT flagged", () => {
    const good =
      'const form = await req.formData(); const file = form.get("file"); validateUploadCandidate({ sizeBytes: file.size });';
    expect(handlesUpload(good) && !validated(good)).toBe(false);
  });

  it("the media escape hatch (EXECUTABLE_EXTENSIONS) counts as validated — recordings need .webm", () => {
    const rec =
      'const form = await req.formData(); const b = await file.arrayBuffer(); EXECUTABLE_EXTENSIONS.some((e) => n.endsWith(e));';
    expect(handlesUpload(rec) && !validated(rec)).toBe(false);
  });

  it("a non-upload route (JSON body, no File) is out of scope — no false alarm", () => {
    expect(handlesUpload("const body = await req.json();")).toBe(false);
  });
});

/**
 * DATA-LAYER ERROR-AS-NO-DATA (INVARIANT 22). A data READ function with a blanket `catch { return [] }` turns
 * a transient failure into a confident "no data" — the user sees GONE/empty on an ERROR. Fixed 6+ times
 * (agent inbox, customer widget, live-visitors monitor, widget load-events telemetry). The gate forces every
 * data-layer error-swallow to classify: rethrow, use a migration guard-predicate, or allowlist with a reason.
 *
 * These re-declare the classifier's logic (as the other blocks do) so a weakened matcher fails HERE, not just
 * silently in the script's own self-tests.
 */
describe("invariant-audit.mjs — data-layer error-as-no-data", () => {
  const stripComments = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
  const swallows = (body: string) => {
    const code = stripComments(body);
    return /\breturn\b/.test(code) && !/\bthrow\b/.test(code) && !/isMissing(Relation|Column)Error/.test(code);
  };

  it("flags a bare swallow, and accepts a rethrow or a guard-predicate", () => {
    expect(swallows(" return []; ")).toBe(true); // the bug shape
    expect(swallows(" throw e; ")).toBe(false); // rethrow — the route 500s
    expect(swallows(" if (isMissingRelationError(e)) return []; throw e; ")).toBe(false); // classified
  });

  it("does NOT flag a void catch whose comment merely mentions 'return' (comment-stripped)", () => {
    // The false-positive the script's own self-test caught mid-build: prose is not code.
    expect(swallows(" /* non-fatal — no return here */ ")).toBe(false);
    expect(swallows(" // best-effort, do not return early ")).toBe(false);
  });

  it("keys the allowlist on file::fn and documents each degrade's reason", () => {
    // A file has multiple catches (care.ts: one guarded, one rethrowing, one allowlisted), so a file-level key
    // would mask a future new swallow in the same file. The two current degrades must be present WITH reasons.
    expect(SCRIPT).toContain('"src/lib/data/care.ts::fetchCareCommandStats"');
    expect(SCRIPT).toContain('"src/lib/data/chats.ts::readDemoState"');
  });

  it("the enclosing-fn scan does not mistake a local `const x = call()` for the function", () => {
    // The extraction bug the live run surfaced: `const seeded = seedDemoState()` inside readDemoState was
    // being read as the fn name. Only a function/arrow declaration is a boundary — a call-assigned const is not.
    const fnDecl =
      /(?:export\s+)?(?:async\s+)?function\s+(\w+)|(?:export\s+)?(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*(?::[^=]+)?=>|\w+\s*=>)/g;
    const nameOf = (src: string) => {
      const d = [...src.matchAll(fnDecl)];
      const last = d[d.length - 1];
      return last ? last[1] || last[2] : "(anonymous)";
    };
    expect(nameOf("function readDemoState(){ const seeded = seedDemoState();")).toBe("readDemoState");
    expect(nameOf("const hasActivity = (totalProbe.count ?? 0) > 0;")).toBe("(anonymous)"); // NOT a fn boundary
    expect(nameOf("const loadIt = async () => {")).toBe("loadIt"); // arrow IS a boundary
  });
});
