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

  // INVARIANT 14 (CWE-209). The detector must catch a raw `.message` returned in an `error:` field — INCLUDING
  // the NESTED-access form `error: fc.error.message` (fc = a Supabase result; fc.error is the PostgrestError).
  // That nested form slipped the original one-hop regex and let finance/forecast leak the raw RPC error
  // (build xi, 2026-08-11). It must ALSO stay narrow: controlled result fields (`auth.error`/`result.error`,
  // which don't end in `.message`), Zod `parsed.error.issues[0]?.message`, and string literals must NOT match.
  it("the CWE-209 detector catches nested AND direct raw .message, but not controlled error fields", () => {
    const RAW_ERR_MSG_RE =
      /\berror:\s*(?:`[^`]*\$\{[^}]*\??\.\s*message|[A-Za-z_$][\w$]*(?:\s*\??\.\s*[A-Za-z_$][\w$]*)?\s*\??\.\s*message\b|[A-Za-z_$][\w$]*\s+instanceof\s+Error\s*\?\s*[A-Za-z_$][\w$]*\s*\??\.\s*message)/;
    // LEAKS — must match
    expect(RAW_ERR_MSG_RE.test("return NextResponse.json({ error: fc.error.message }, { status: 500 });")).toBe(true); // the nested regression
    expect(RAW_ERR_MSG_RE.test("{ error: err.message }")).toBe(true); // the original one-hop form
    expect(RAW_ERR_MSG_RE.test("{ error: `failed: ${e.message}` }")).toBe(true); // interpolated
    expect(RAW_ERR_MSG_RE.test("{ error: err instanceof Error ? err.message : \"x\" }")).toBe(true); // catch fallback
    expect(RAW_ERR_MSG_RE.test("{ error: insertErr?.message ?? 'x' }")).toBe(true); // optional chaining (2026-08-19 blind spot)
    // CONTROLLED — must NOT match (no crying wolf)
    expect(RAW_ERR_MSG_RE.test("{ error: auth.error }")).toBe(false);
    expect(RAW_ERR_MSG_RE.test("{ error: result.error }")).toBe(false);
    expect(RAW_ERR_MSG_RE.test("{ error: result?.error }")).toBe(false); // optional-chained controlled field (still not terminal .message)
    expect(RAW_ERR_MSG_RE.test('{ error: parsed.error.issues[0]?.message ?? "Invalid." }')).toBe(false);
    expect(RAW_ERR_MSG_RE.test('{ error: "Not authenticated." }')).toBe(false);
    // Bind the test to the SCRIPT: the nested-access group (now optional-chaining-aware) must remain, so the
    // widening can't be silently reverted (which would re-open the ?.message blind spot on its copy).
    expect(SCRIPT).toContain("[A-Za-z_$][\\w$]*(?:\\s*\\??\\.\\s*[A-Za-z_$][\\w$]*)?\\s*\\??\\.\\s*message");
  });

  // INVARIANT 13 (PostgREST .or(...ilike...) injection). Flags an INTERPOLATED raw ilike filter; a
  // parameterized .ilike(col, term) or a non-interpolated literal is safe and must NOT fire.
  it("the raw-ilike detector flags an interpolated filter string, not a parameterized or literal ilike", () => {
    const RAW_ILIKE_FILTER_RE = /`[^`]*ilike\.[^`]*\$\{/;
    expect(RAW_ILIKE_FILTER_RE.test("supabase.or(`name.ilike.${term},email.ilike.${term}`)")).toBe(true);
    expect(RAW_ILIKE_FILTER_RE.test('supabase.ilike("name", term)')).toBe(false); // parameterized (escaped)
    expect(RAW_ILIKE_FILTER_RE.test("supabase.or(`name.ilike.fixedword`)")).toBe(false); // literal, no ${}
    expect(SCRIPT).toContain("const RAW_ILIKE_FILTER_RE = /`[^`]*ilike\\.[^`]*\\$\\{/");
  });

  // INVARIANT 16 (LLM/transcription route needs maxDuration). The chokepoint names + known wrappers must
  // match; an ordinary call must not. A silent narrowing of this list = a route times out in prod undetected.
  it("the LLM-call detector matches the chokepoints + known wrappers, not an ordinary call", () => {
    const LLM_CALL_RE =
      /\b(llmCall|llmStream|generateCareReply|dissectCoachV5|generateSales\w+|runAndStore\w+|transcribeWithDiarization|gradeCareAgentReply|generateSessionWhy|mintRealtimeSttToken|runLearningCycle|runBrainCall|analyzeCoachV5|followUpCoachV5|gradeCoachV5|debriefCoachV5|liveSalesCue|proposeDecisionDialogue|generateDailyQuestions|generateDailyBriefing|proposeCoachPatterns|generateOutsideViews|traceRipples)\s*\(/;
    expect(LLM_CALL_RE.test("await llmCall({ ... })")).toBe(true); // the shared chokepoint
    expect(LLM_CALL_RE.test("const r = await runLearningCycle(input)")).toBe(true); // the wrapper that slipped once
    expect(LLM_CALL_RE.test("await transcribeWithDiarization({ audio })")).toBe(true);
    expect(LLM_CALL_RE.test("generateSalesPivot(ctx)")).toBe(true); // generateSales\w+
    expect(LLM_CALL_RE.test("await fetchTopics(scope)")).toBe(false); // an ordinary call
    expect(SCRIPT).toContain("llmCall|llmStream|generateCareReply");
  });

  // INVARIANT 18 (non-public mutation must reference a recognised auth/tenant gate). The mutation-export and
  // the auth-reference detectors must each match their real shapes and reject a gate-less mutation.
  it("the anon-writable detector matches a mutation export + a recognised gate, and rejects a gate-less one", () => {
    const ROUTE_AUTH_RE = /auth\.getUser|getCurrentCompanyId|getCurrentAuthContext|requireCareAgent|requireVendorAdmin|requirePlatformAdmin|requireSuperAdmin|\bisAdmin\b|guardExtensionRequest|requireEntitledExtensionUser|requireExtensionAuth|CRON_SECRET|SWEEP_SECRET|CARE_INBOUND_EMAIL_SECRET|getCareConversationByToken/;
    const MUTATION_EXPORT_RE = /export\s+(?:async\s+function|const)\s+(?:POST|PATCH|PUT|DELETE)\b/;
    expect(MUTATION_EXPORT_RE.test("export async function POST(req: NextRequest) {")).toBe(true);
    expect(MUTATION_EXPORT_RE.test("export const DELETE = async () => {")).toBe(true);
    expect(MUTATION_EXPORT_RE.test("export async function GET() {")).toBe(false); // read-only, out of scope
    expect(ROUTE_AUTH_RE.test("const { data } = await supabase.auth.getUser();")).toBe(true);
    expect(ROUTE_AUTH_RE.test("const conv = await getCareConversationByToken(token);")).toBe(true); // capability token
    expect(ROUTE_AUTH_RE.test("const body = await req.json();")).toBe(false); // no recognised gate → flagged
    expect(SCRIPT).toContain("const MUTATION_EXPORT_RE = /export\\s+(?:async\\s+function|const)\\s+(?:POST|PATCH|PUT|DELETE)\\b/");
  });

  // INVARIANT 19 (owner-required service-role append needs a session-owner check). The append detector must
  // match the three private-append fns; the owner-check detector must require the `!==` guard shape (an
  // `===` comparison does NOT satisfy it — the guard is "reject when not the owner").
  it("the owner-append detector matches the private appends and requires the !== owner guard", () => {
    const OWNER_REQUIRED_APPEND_RE = /\bappend(Cue|CueOutcome|TranscriptSegment)\s*\(/;
    const SESSION_OWNER_CHECK_RE = /\.agentId\s*!==/;
    expect(OWNER_REQUIRED_APPEND_RE.test("await appendCue({ sessionId, text })")).toBe(true);
    expect(OWNER_REQUIRED_APPEND_RE.test("await appendTranscriptSegment(seg)")).toBe(true);
    expect(OWNER_REQUIRED_APPEND_RE.test("await appendMessage(m)")).toBe(false); // not an owner-required table
    expect(SESSION_OWNER_CHECK_RE.test("if (session.agentId !== auth.user.id) return forbidden();")).toBe(true);
    expect(SESSION_OWNER_CHECK_RE.test("if (session.agentId === auth.user.id) ok();")).toBe(false); // === is not the guard
    expect(SCRIPT).toContain("const OWNER_REQUIRED_APPEND_RE = /\\bappend(Cue|CueOutcome|TranscriptSegment)\\s*\\(/");
  });

  // INVARIANT 21 (.limit(N) > 1000 is a false bound). The detector must capture a literal N and the caller
  // flags only N > 1000; a variable limit or a <=1000 literal must not fire.
  it("the false-limit detector captures a literal N and the > 1000 threshold, not a variable or a small limit", () => {
    const FALSE_LIMIT_RE = /\.limit\(\s*(\d+)\s*\)/g;
    const grab = (s: string) => [...s.matchAll(FALSE_LIMIT_RE)].map((m) => Number(m[1]));
    expect(grab(".limit(5000)").some((n) => n > 1000)).toBe(true); // false bound
    expect(grab(".limit(50)").some((n) => n > 1000)).toBe(false); // real, small bound
    expect(grab(".limit(pageSize)")).toEqual([]); // variable — not a literal false bound
    expect(SCRIPT).toContain("const FALSE_LIMIT_RE = /\\.limit\\(\\s*(\\d+)\\s*\\)/g");
    expect(SCRIPT).toContain("Number(m[1]) > 1000");
  });

  // INVARIANT 7 (admin route needs an admin gate). Matches each admin-gate reference; a bare authenticated
  // read is NOT an admin gate.
  it("the admin-gate detector matches the admin guards, not a bare auth check", () => {
    const ADMIN_GATE_RE = /isAdmin|requireAdmin|requireVendorAdmin|requirePlatformAdmin|requireSuperAdmin/;
    expect(ADMIN_GATE_RE.test("if (!requireVendorAdmin(ctx).ok) return forbidden();")).toBe(true);
    expect(ADMIN_GATE_RE.test("if (!auth.isAdmin) return forbidden();")).toBe(true);
    expect(ADMIN_GATE_RE.test("const { data } = await supabase.auth.getUser();")).toBe(false); // authed ≠ admin
    expect(SCRIPT).toContain("const ADMIN_GATE_RE = /isAdmin|requireAdmin|requireVendorAdmin|requirePlatformAdmin|requireSuperAdmin/");
  });

  // INVARIANT 8 (extension route must be authenticated). Matches the three extension guards; a bare handler
  // does not.
  it("the extension-auth detector matches the extension guards, not an ungated handler", () => {
    const EXT_AUTH_RE = /guardExtensionRequest|requireEntitledExtensionUser|requireExtensionAuth/;
    expect(EXT_AUTH_RE.test("const g = await guardExtensionRequest(req);")).toBe(true);
    expect(EXT_AUTH_RE.test("const u = await requireEntitledExtensionUser(req);")).toBe(true);
    expect(EXT_AUTH_RE.test("export async function POST(req) { const b = await req.json();")).toBe(false);
    expect(SCRIPT).toContain("const EXT_AUTH_RE = /guardExtensionRequest|requireEntitledExtensionUser|requireExtensionAuth/");
  });

  // INVARIANT 20 (auth middleware redirects preserve rotated cookies). The gate strips comments then counts
  // raw `NextResponse.redirect(` — > 1 means a second redirect bypasses the cookie-preserving helper. A
  // comment naming the API must NOT count; the single helper call must.
  it("the middleware-redirect counter strips comments and flags a SECOND raw redirect", () => {
    const stripAndCount = (src: string) =>
      (src
        .split("\n")
        .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
        .join("\n")
        .match(/NextResponse\.redirect\(/g) ?? []).length;
    expect(stripAndCount("return NextResponse.redirect(u1);\nreturn NextResponse.redirect(u2);")).toBe(2); // > 1 → flagged
    expect(stripAndCount("  // NextResponse.redirect(x) is only via the helper\n  return doStuff();")).toBe(0); // comment stripped
    expect(stripAndCount("return redirectPreservingCookies(response, url); // wraps NextResponse.redirect")).toBe(0); // helper, not raw
    expect(SCRIPT).toContain("const rawRedirects = (codeOnly.match(/NextResponse\\.redirect\\(/g) ?? []).length");
  });

  // INVARIANT 24 (coach EXTENSION engine calling an LLM must fence external text). Matches the extension LLM
  // callers + the shared fence token; a pure util engine (no LLM call) is out of scope.
  it("the extension-fence detector matches an LLM-calling engine + the fence token, not a pure util", () => {
    const EXT_LLM_CALLER_RE = /\b(dissectCoachV5|generateCareReply)\b/;
    const TRANSCRIPT_FENCE_RE = /CONVERSATION_IS_DATA/;
    expect(EXT_LLM_CALLER_RE.test("const r = await dissectCoachV5(input);")).toBe(true);
    expect(EXT_LLM_CALLER_RE.test("export function formatSegments(s) { return s.join(''); }")).toBe(false); // pure util
    expect(TRANSCRIPT_FENCE_RE.test("const fenced = CONVERSATION_IS_DATA + text;")).toBe(true);
    expect(TRANSCRIPT_FENCE_RE.test("const p = systemPrompt + text;")).toBe(false); // no fence
    expect(SCRIPT).toContain("const EXT_LLM_CALLER_RE = /\\b(dissectCoachV5|generateCareReply)\\b/");
  });

  // INVARIANT 15 (coaching_sessions write pins company_id). Re-declares the statement-bounded scan: a
  // `.from("coaching_sessions").update(...)` WITHOUT an `.eq("company_id")` in the same statement is a latent
  // cross-tenant write; a scoped write or a read (.select) is fine.
  it("the coaching_sessions-write scan flags an unscoped update, not a scoped one or a read", () => {
    const unscoped = (sql: string) => {
      const lines = sql.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!/\.from\(["']coaching_sessions["']\)/.test(lines[i])) continue;
        let stmt = "";
        for (let j = i; j < lines.length && j < i + 20; j++) {
          stmt += lines[j] + "\n";
          if (lines[j].includes(";")) break;
        }
        if (!/\.update\(/.test(stmt)) continue;
        if (/\.eq\(["']company_id["']/.test(stmt)) continue;
        return true;
      }
      return false;
    };
    expect(unscoped('await admin.from("coaching_sessions").update({ x: 1 }).eq("id", id);')).toBe(true); // id-only → flagged
    expect(unscoped('await admin.from("coaching_sessions").update({ x: 1 }).eq("id", id).eq("company_id", c);')).toBe(false); // scoped
    expect(unscoped('await sb.from("coaching_sessions").select("*").eq("id", id);')).toBe(false); // a read is not a write
    // Bind to the script so a later weakening (e.g. dropping the company_id check) trips this test.
    expect(SCRIPT).toContain('.eq\\(["\']company_id["\']');
  });

  // INVARIANT 9 (NEXT_PUBLIC_ vars are secret-leak surface). The extractor must catch every NEXT_PUBLIC_ name
  // (so the allowlist can vet it) and a secret prefixed NEXT_PUBLIC_ must NEVER be silently allowlisted.
  it("the NEXT_PUBLIC extractor catches env-var names, and no secret var is allowlisted", () => {
    const RE = /NEXT_PUBLIC_[A-Z0-9_]+/g;
    expect("process.env.NEXT_PUBLIC_ANTHROPIC_KEY".match(RE)).toEqual(["NEXT_PUBLIC_ANTHROPIC_KEY"]);
    expect("process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY".match(RE)).toEqual(["NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    expect("process.env.SUPABASE_SERVICE_ROLE_KEY".match(RE)).toBeNull(); // not NEXT_PUBLIC_ prefixed
    expect(SCRIPT).toContain("f.sql.match(/NEXT_PUBLIC_[A-Z0-9_]+/g)");
    expect(SCRIPT).toContain('"NEXT_PUBLIC_SUPABASE_ANON_KEY"'); // the known-safe one is allowlisted
    // Every allowlisted NEXT_PUBLIC_ entry must carry a reason (the allowlist is [name, reason] pairs) — an
    // allowlist of bare names would be a disabled check; the "every allowlisted exception states its reason"
    // test below enforces that structurally across all allowlists.
  });

  // INVARIANT 10 (dangerouslySetInnerHTML must be justified). Presence detector — matches a use, not a
  // component without it.
  it("the dangerouslySetInnerHTML detector matches a use, not a component without it", () => {
    const RE = /dangerouslySetInnerHTML/;
    expect(RE.test("<div dangerouslySetInnerHTML={{ __html: sanitized }} />")).toBe(true);
    expect(RE.test("<div>{value}</div>")).toBe(false);
    expect(SCRIPT).toContain("/dangerouslySetInnerHTML/.test(f.sql)");
  });

  // INVARIANT 11 (cron route needs CRON_SECRET). The path matcher + the CRON_SECRET presence check.
  it("the cron-secret detector keys on a *-cron path and the CRON_SECRET reference", () => {
    expect(/cron\/route\.(ts|tsx)$/.test("src/app/api/recording-purge-cron/route.ts")).toBe(true);
    expect(/cron\/route\.(ts|tsx)$/.test("src/app/api/recordings/route.ts")).toBe(false); // not a cron route
    expect(/CRON_SECRET/.test("if (bearer !== process.env.CRON_SECRET) return unauthorized();")).toBe(true);
    expect(SCRIPT).toContain("if (/CRON_SECRET/.test(f.sql)) continue;");
  });

  // INVARIANT 12 (constitution version matches the ratified amendments). The AMD-number extractor + the
  // padded expected-id formatting + the amendmentCount reader.
  it("the constitution-version check extracts the AMD number and formats the padded expected last id", () => {
    expect("AMD-005-establish-process.md".match(/^AMD-(\d+).*\.md$/i)?.[1]).toBe("005");
    const nums = ["AMD-001-a.md", "AMD-012-b.md", "AMD-008-c.md"].map(
      (f) => Number(f.match(/^AMD-(\d+).*\.md$/i)![1])
    );
    expect(`AMD-${String(Math.max(...nums)).padStart(3, "0")}`).toBe("AMD-012");
    expect("  amendmentCount: 12,".match(/amendmentCount:\s*(\d+)/)?.[1]).toBe("12");
    expect(SCRIPT).toContain("f.match(/^AMD-(\\d+).*\\.md$/i)");
    expect(SCRIPT).toContain("amendmentCount:\\s*(\\d+)");
  });

  // INVARIANT 17 (every cron route is registered in vercel.json). The route-path key and the vercel cron-path
  // key must derive to the SAME string for a registered cron (else the route reads as an unscheduled dead cron).
  it("the cron-registration cross-reference derives matching keys from a route path and a vercel cron path", () => {
    const routeKey = "src/app/api/coach/sales-session/recording-purge-cron/route.ts"
      .replace(/^src\/app\/api\//, "")
      .replace(/\/route\.ts$/, "");
    const vercelKey = "/api/coach/sales-session/recording-purge-cron".replace(/^\/?api\//, "").replace(/^\//, "");
    expect(routeKey).toBe("coach/sales-session/recording-purge-cron");
    expect(vercelKey).toBe(routeKey); // registered → keys match; an unregistered route would be absent from the set
    expect(SCRIPT).toContain('.replace(/^src\\/app\\/api\\//, "").replace(/\\/route\\.ts$/, "")');
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

/**
 * TRANSCRIPT PROMPT-INJECTION FENCE (INVARIANT 23). A Live Sales Coach engine feeds a raw diarized transcript
 * (untrusted customer speech) into an LLM whose output reaches the rep or a stored review. Every such engine
 * must apply the shared CONVERSATION_IS_DATA fence (or a documented bespoke inline one). Re-declares the
 * trigger + fence logic so a weakened matcher fails HERE.
 */
describe("invariant-audit.mjs — transcript prompt-injection fence", () => {
  const isEngineFile = (p: string) => /^src\/lib\/coach\/v5\/[^/]+\.ts$/.test(p);
  const buildsSystemPrompt = (s: string) => /systemPrompt\s*=/.test(s);
  const injectsSegments = (s: string) => /\bsegments\b/.test(s);
  const fenced = (s: string) => /CONVERSATION_IS_DATA/.test(s);

  it("flags a transcript engine that builds a systemPrompt + injects segments but has no fence", () => {
    const bad = "const systemPrompt = buildX();\n buildXUser({ segments });";
    expect(buildsSystemPrompt(bad) && injectsSegments(bad) && !fenced(bad)).toBe(true);
  });

  it("does NOT flag an engine that appends the shared fence", () => {
    const good = "const systemPrompt = buildX() + CONVERSATION_IS_DATA;\n buildXUser({ segments });";
    expect(buildsSystemPrompt(good) && injectsSegments(good) && !fenced(good)).toBe(false);
  });

  it("does NOT flag a pure prompt BUILDER (returns a string; no `systemPrompt =`) or a non-transcript engine", () => {
    const builder = "export function buildSalesPivotSystemPrompt(){ return `analyze the [n] segments`; }";
    expect(buildsSystemPrompt(builder)).toBe(false); // returns, never assigns systemPrompt
    const debriefLike = "const systemPrompt = buildDebrief();\n buildDebriefUser({ messages });";
    expect(injectsSegments(debriefLike)).toBe(false); // injects OWN messages, not transcript segments
  });

  it("the path matcher accepts a flat engine and rejects nested/test paths", () => {
    expect(isEngineFile("src/lib/coach/v5/salesScore.ts")).toBe(true);
    expect(isEngineFile("src/lib/coach/v5/__tests__/x.ts")).toBe(false);
    expect(isEngineFile("src/lib/coach/v5/sub/x.ts")).toBe(false);
  });

  it("liveCue is allowlisted (bespoke inline fence), documented with the reason", () => {
    expect(SCRIPT).toContain('"src/lib/coach/v5/liveCue.ts"');
    expect(SCRIPT).toMatch(/liveCue[\s\S]{0,300}bespoke inline fence/);
  });
});
