import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * "Active means all AI functional" seam-coverage guard (founder 2026-08-14).
 *
 * There are TWO ways a vendor admin marks an account live, and BOTH must open the §3.4 AI gate
 * (`companies.ai_guidance_enabled`) — otherwise an account looks active while non-`controlExempt`
 * AI stays suppressed:
 *   1. subscription status → "active"   (accounts/[id]/subscription/route.ts)
 *   2. lifecycle stage → "activated"/"paying"  (accounts/[id]/route.ts)
 *
 * Seam #2 was the original hole: it patched the stage but left the gate closed — and it is the
 * control the founder's "6 in Control month" view actually flips. What `activateAccountGuidance`
 * DOES is behaviorally locked in crm/__tests__/activateAccount.test.ts; this pins the necessary
 * structural condition that both activation seams CALL it, so a future edit that drops the wiring
 * (or a new activation path that forgets it) fails CI instead of silently re-gating the AI.
 *
 * Coarse backstop by design (it does not prove the call is on the right branch — that stays a
 * review concern), matching vendorGate.coverage.test.ts.
 */
const here = dirname(fileURLToPath(import.meta.url));
const CRM_DIR = join(here, ".."); // src/app/api/admin/crm

const ACTIVATION_SEAMS = [
  "accounts/[id]/subscription/route.ts",
  "accounts/[id]/route.ts",
];

describe("every CRM activation seam opens the AI gate (founder 2026-08-14)", () => {
  for (const rel of ACTIVATION_SEAMS) {
    it(`${rel} calls activateAccountGuidance`, () => {
      const src = readFileSync(join(CRM_DIR, rel), "utf8");
      expect(
        src.includes("activateAccountGuidance"),
        `${rel} sets an account live but never opens the AI gate — a vendor-activated account would show "active" while non-controlExempt AI stays suppressed (founder: "active must mean all AI functional").`
      ).toBe(true);
    });
  }
});
