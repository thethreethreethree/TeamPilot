import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rubricConfigRow, RUBRIC_VERSION } from "../rubric";

/**
 * 0268 seeds the rubric_config row every pitch score's foreign key needs — the row whose absence made every
 * production save fail (2026-09-29). It is generated from rubricConfigRow(); this is the drift guard (§2.2):
 * the migration's rubric and the code's rubric must be the SAME rubric, or scores would be stored against a
 * definition that no longer matches how they were graded.
 */
const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/0268_seed_rubric_config_attfiber_v1.sql"),
  "utf8"
);
const blocks = [...sql.matchAll(/\$rubric\$([\s\S]*?)\$rubric\$::jsonb/g)].map((m) => JSON.parse(m[1]!));

describe("0268 — the seeded rubric is the code's rubric", () => {
  const row = rubricConfigRow();

  it("seeds the version the scorer stamps", () => {
    expect(sql).toContain(`'${RUBRIC_VERSION}'`);
    expect(row.version).toBe(RUBRIC_VERSION);
  });

  it("carries exactly the code's elements, bonuses and violations", () => {
    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toEqual(row.elements);
    expect(blocks[1]).toEqual(row.bonuses);
    expect(blocks[2]).toEqual(row.violations);
  });

  it("carries the code's thresholds", () => {
    const tail = sql.slice(sql.lastIndexOf("$rubric$::jsonb") + "$rubric$::jsonb".length);
    const nums = tail.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
    expect(nums.slice(0, 4)).toEqual([row.base_max, row.bonus_cap, row.qualifying_min_base, row.audio_confidence_threshold]);
    expect(tail).toMatch(/\btrue\b/);
  });

  it("never overwrites an existing row", () => {
    expect(sql).toMatch(/on conflict \(version\) do nothing;/);
  });
});

describe("0307 — the phone/video rubric row is the code's draft, seeded INACTIVE (D6)", () => {
  it("carries exactly remoteRubricConfigRow(), and stays inactive until approval", async () => {
    const { remoteRubricConfigRow } = await import("../rubricRegistry");
    const s = readFileSync(join(process.cwd(), "supabase/migrations/0307_seed_rubric_config_attfiber_remote_v1.sql"), "utf8");
    const b = [...s.matchAll(/\$rubric\$([\s\S]*?)\$rubric\$::jsonb/g)].map((m) => JSON.parse(m[1]!));
    const row = remoteRubricConfigRow();
    expect(s).toContain(`'${row.version}'`);
    expect(b).toEqual([row.elements, row.bonuses, row.violations].map((x) => JSON.parse(JSON.stringify(x))));
    const tail = s.slice(s.lastIndexOf("$rubric$::jsonb") + "$rubric$::jsonb".length);
    expect(tail).toMatch(/\bfalse\b/);
    expect(row.is_active).toBe(false);
    expect(s).toMatch(/on conflict \(version\) do nothing;/);
  });
});
