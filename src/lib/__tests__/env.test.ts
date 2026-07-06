import { describe, expect, it } from "vitest";
import { Env } from "../env";

/**
 * Env validation (fail-fast config, audit Tier 1 #6). The schema's job is to
 * turn a misconfigured deployment into a clear STARTUP error instead of a
 * confusing runtime one. These pin the production-only rules, including the
 * newly-added provider/key-match check.
 */
function issuePaths(result: ReturnType<typeof Env.safeParse>): string[] {
  return result.success ? [] : result.error.issues.map((i) => i.path.join("."));
}

describe("Env validation (production rules)", () => {
  it("requires at least one LLM provider key in production", () => {
    const r = Env.safeParse({ NODE_ENV: "production" });
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain("DEEPSEEK_API_KEY");
  });

  it("passes with a single valid key and no explicit provider", () => {
    expect(
      Env.safeParse({ NODE_ENV: "production", DEEPSEEK_API_KEY: "sk-abc" }).success
    ).toBe(true);
  });

  it("rejects LLM_PROVIDER=anthropic when only DEEPSEEK is set (the fix)", () => {
    const r = Env.safeParse({
      NODE_ENV: "production",
      LLM_PROVIDER: "anthropic",
      DEEPSEEK_API_KEY: "sk-abc",
    });
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain("ANTHROPIC_API_KEY");
  });

  it("accepts LLM_PROVIDER=anthropic when its key is present", () => {
    expect(
      Env.safeParse({
        NODE_ENV: "production",
        LLM_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "sk-ant-abc",
      }).success
    ).toBe(true);
  });

  it("requires Supabase URL and anon key together", () => {
    const r = Env.safeParse({
      NODE_ENV: "production",
      DEEPSEEK_API_KEY: "sk-abc",
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    });
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("enforces the DEEPSEEK key prefix", () => {
    const r = Env.safeParse({ NODE_ENV: "production", DEEPSEEK_API_KEY: "nope" });
    expect(r.success).toBe(false);
    expect(issuePaths(r)).toContain("DEEPSEEK_API_KEY");
  });

  it("is lenient outside production (demo/dev is browsable with no keys)", () => {
    expect(Env.safeParse({ NODE_ENV: "development" }).success).toBe(true);
    expect(Env.safeParse({ NODE_ENV: "test" }).success).toBe(true);
    // even an explicit provider without its key is allowed in dev
    expect(
      Env.safeParse({ NODE_ENV: "development", LLM_PROVIDER: "anthropic" }).success
    ).toBe(true);
  });
});
