import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

/**
 * A30 structural guard for the view-session usage fix (2026-08-27). The bug the founder reported was that the manager
 * "view session" only showed sessions with STORED AUDIO in the last 2 days, so reps who used the product but whose
 * captures left no audio were invisible. rep-activity is the USAGE view: it must NOT re-introduce an audio filter, and
 * it must stay scoped by BOTH company_id (the caller's) and agent_id (the target) so it can't leak cross-tenant.
 *
 * There is no pure-function seam here (it's a DB route), so this greps the route source — the same drift-guard pattern
 * the salesCoachShell nav test uses. If someone re-adds the audio filter or drops a tenant scope, this fails.
 */
const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "route.ts"), "utf8");

describe("rep-activity route — usage view must not gate on audio, must stay tenant-scoped (A30)", () => {
  it("does NOT filter out sessions without audio (the bug: usage != recordings)", () => {
    // The recordings route uses `.not("audio_asset_url", "is", null)` to show only stored recordings. The USAGE view
    // must never do that — it shows all sessions, with audio as an attribute.
    expect(SRC).not.toMatch(/\.not\(\s*["']audio_asset_url["']/);
  });

  it("selects audio_asset_url only as an ATTRIBUTE (hasAudio), not as a filter", () => {
    expect(SRC).toMatch(/hasAudio/);
    expect(SRC).toMatch(/audio_asset_url/); // present in the select, as a column to read
  });

  it("scopes the query by BOTH the caller's company_id and the target agent_id (no cross-tenant read)", () => {
    expect(SRC).toMatch(/\.eq\(\s*["']company_id["']\s*,\s*companyId\s*\)/);
    expect(SRC).toMatch(/\.eq\(\s*["']agent_id["']\s*,\s*targetAgentId\s*\)/);
  });

  it("gates a cross-rep read behind the manager + same-company authz (isSalesCoachManager + canManagerViewRepSkills)", () => {
    expect(SRC).toMatch(/isSalesCoachManager/);
    expect(SRC).toMatch(/canManagerViewRepSkills/);
  });

  it("uses a wider window than the 2-day recordings view (a 30-day usage window via gte started_at)", () => {
    expect(SRC).toMatch(/WINDOW_DAYS/);
    expect(SRC).toMatch(/\.gte\(\s*["']started_at["']/);
  });
});
