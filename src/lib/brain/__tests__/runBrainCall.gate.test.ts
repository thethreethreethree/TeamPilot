import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "../../data/__tests__/_supabaseMock";

/**
 * §3.4 ENFORCEMENT test — complements controlGate.test.ts (which tests the pure
 * decision `evaluateControlGate`). This pins the moat's TEETH: `runBrainCall`
 * must return a suppressed placeholder and NEVER call the provider while the
 * control window is open, and must call it once guidance is enabled OR the
 * Sales-Coach `controlExempt` flag is explicitly set.
 *
 * Why this matters beyond the boolean test: a refactor of runBrainCall could
 * leave `evaluateControlGate` correct yet still call the LLM during Month 1 —
 * leaking AI guidance into the honest control baseline (the §3.4 catastrophe)
 * while every decision-level test stayed green. The assertion that carries the
 * guarantee is `expect(llmCall).not.toHaveBeenCalled()` in the suppressed case.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/llm", () => ({
  llmCall: vi.fn().mockResolvedValue({ text: "REAL", model: "m", provider: "p" }),
  llmStream: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { llmCall } from "@/lib/llm";
import { runBrainCall } from "../index";

const FUTURE = "2999-01-01T00:00:00Z"; // unlock far ahead → control window OPEN
const PAST = "2000-01-01T00:00:00Z"; // unlock elapsed → guidance ENABLED

function clientFor(
  companyRow: Record<string, unknown>,
  calls: Array<[string, unknown[]]>
) {
  return makeSupabaseClient(
    {
      company_brain: {
        data: {
          version: 3,
          system_prompt_addendum: "",
          known_patterns: [],
          style_calibration: {},
          vocabulary: {},
          disabled_suggestions: [],
          validated_methods: [],
          last_learning_at: null,
          last_learning_summary: null,
          updated_at: PAST,
        },
      },
      companies: { data: companyRow },
    },
    calls
  ) as never;
}

describe("runBrainCall — §3.4 control-window enforcement", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
    vi.mocked(llmCall).mockClear();
  });

  it("SUPPRESSES during the control window: suppressed placeholder + provider NEVER called", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      clientFor(
        { ai_guidance_enabled: false, ai_guidance_unlock_at: FUTURE, ai_guidance_enabled_at: null },
        calls
      )
    );
    const r = await runBrainCall({
      companyId: "co1",
      basePrompt: "p",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(r.provider).toBe("(suppressed)");
    expect(r.text).toBe("");
    expect(r.gate.guidanceEnabled).toBe(false);
    expect(r.suppressed).toBe(true); // the single-source verdict consumers branch on (§2.2/AMD-010)
    // THE moat: no provider call during Month 1, or the control baseline is contaminated.
    expect(llmCall).not.toHaveBeenCalled();
  });

  it("CALLS the provider once guidance is enabled (window elapsed)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      clientFor(
        { ai_guidance_enabled: false, ai_guidance_unlock_at: PAST, ai_guidance_enabled_at: null },
        calls
      )
    );
    const r = await runBrainCall({
      companyId: "co1",
      basePrompt: "p",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(llmCall).toHaveBeenCalledTimes(1);
    expect(r.text).toBe("REAL");
    expect(r.gate.guidanceEnabled).toBe(true);
    expect(r.suppressed).toBe(false);
  });

  it("controlExempt (Sales Coach) calls the provider EVEN while suppressed", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      clientFor(
        { ai_guidance_enabled: false, ai_guidance_unlock_at: FUTURE, ai_guidance_enabled_at: null },
        calls
      )
    );
    const r = await runBrainCall({
      companyId: "co1",
      basePrompt: "p",
      messages: [{ role: "user", content: "hi" }],
      controlExempt: true,
    });
    // Exemption bypasses SUPPRESSION only — still a real provider call, and the verdict says NOT suppressed
    // so consumers (call(), rippleTrace, …) pass the real text through instead of discarding it (A40).
    expect(llmCall).toHaveBeenCalledTimes(1);
    expect(r.text).toBe("REAL");
    expect(r.suppressed).toBe(false);
  });
});
