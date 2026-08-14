import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "../../data/__tests__/_supabaseMock";

/**
 * §3.4 ENFORCEMENT test for the STREAMING authority — the sibling of runBrainCall.gate.test.ts.
 *
 * runBrainStream is the streaming gate authority (the extension's "Suggested Response" uses it). It carries
 * the SAME control-window decision as runBrainCall — `suppress ⇔ (!guidanceEnabled && !controlExempt)` — and
 * the SAME two teeth must hold:
 *   1. SUPPRESS during the control window: yield NOTHING and never call the provider (the honest control
 *      baseline must not be contaminated by a leaked stream).
 *   2. controlExempt (Sales Coach) must STREAM real content EVEN while suppressed.
 *
 * Why this test exists (2026-08-14, AMD-010 / A40): the non-stream sibling `call()` once RE-DERIVED this gate
 * decision and dropped the controlExempt term, discarding real answers for every guidance-off account. The
 * streaming path was verified correct (it keeps the term at index.ts) but had NO guard — so a future edit could
 * drop `&& !args.controlExempt` here and silently blank every streamed exempt surface with all checks green.
 * This converts that verification into a structural guard: removing the exemption term fails test 2.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

async function* fakeStream() {
  yield "Sug";
  yield "gestion";
}
vi.mock("@/lib/llm", () => ({
  llmCall: vi.fn(),
  llmStream: vi.fn(() => fakeStream()),
}));

import { createClient } from "@/lib/supabase/server";
import { llmStream } from "@/lib/llm";
import { runBrainStream } from "../index";

const FUTURE = "2999-01-01T00:00:00Z"; // unlock far ahead → control window OPEN
const PAST = "2000-01-01T00:00:00Z"; // unlock elapsed → guidance ENABLED

function clientFor(companyRow: Record<string, unknown>) {
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
    []
  ) as never;
}

/** Drain the generator: collect yielded deltas + the returned gate value. */
async function drain(
  gen: AsyncGenerator<string, { gate: { guidanceEnabled: boolean }; suppressed: boolean }, void>
) {
  const chunks: string[] = [];
  let res = await gen.next();
  while (!res.done) {
    chunks.push(res.value);
    res = await gen.next();
  }
  return { chunks, ret: res.value };
}

describe("runBrainStream — §3.4 control-window enforcement (streaming authority)", () => {
  beforeEach(() => vi.mocked(llmStream).mockClear());

  it("SUPPRESSES during the control window: yields NOTHING + provider NEVER called", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientFor({ ai_guidance_enabled: false, ai_guidance_unlock_at: FUTURE, ai_guidance_enabled_at: null })
    );
    const { chunks, ret } = await drain(
      runBrainStream({ companyId: "co1", basePrompt: "p", messages: [{ role: "user", content: "hi" }] })
    );
    expect(chunks).toEqual([]);
    expect(llmStream).not.toHaveBeenCalled(); // the moat: no leaked stream into the control baseline
    expect(ret.gate.guidanceEnabled).toBe(false);
    expect(ret.suppressed).toBe(true); // the single-source verdict stream routes branch on (§2.2/AMD-010)
  });

  it("controlExempt (Sales Coach) STREAMS real deltas EVEN while suppressed", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientFor({ ai_guidance_enabled: false, ai_guidance_unlock_at: FUTURE, ai_guidance_enabled_at: null })
    );
    const { chunks, ret } = await drain(
      runBrainStream({
        companyId: "co1",
        basePrompt: "p",
        messages: [{ role: "user", content: "hi" }],
        controlExempt: true,
      })
    );
    // The exemption must survive here exactly as it does in runBrainCall — real content, not an empty stream.
    expect(llmStream).toHaveBeenCalledTimes(1);
    expect(chunks.join("")).toBe("Suggestion");
    expect(ret.suppressed).toBe(false); // verdict: NOT suppressed → stream routes emit the deltas, not a gate event
  });

  it("streams once guidance is enabled (window elapsed), no exemption needed", async () => {
    vi.mocked(createClient).mockResolvedValue(
      clientFor({ ai_guidance_enabled: false, ai_guidance_unlock_at: PAST, ai_guidance_enabled_at: null })
    );
    const { chunks } = await drain(
      runBrainStream({ companyId: "co1", basePrompt: "p", messages: [{ role: "user", content: "hi" }] })
    );
    expect(llmStream).toHaveBeenCalledTimes(1);
    expect(chunks.join("")).toBe("Suggestion");
  });
});
