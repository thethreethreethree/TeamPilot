import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  tagTone,
  priorityDisplay,
  ALL_TAG_COLORS,
  ALL_PRIORITIES,
} from "../tagColors";

/**
 * Care tag colors + priority display. Untested. Three things worth locking, none of which
 * TypeScript catches:
 *  1. tagTone/priorityDisplay must be TOLERANT of an unknown value (fall back to gray/normal),
 *     so a color/priority string from the DB that this file doesn't know can't crash the inbox.
 *  2. The ALL_* order arrays (typed as plain unions[]) must cover EXACTLY their display maps —
 *     TS is happy to let them go incomplete or hold duplicates, which would drop/duplicate a
 *     chip in the UI.
 *  3. CROSS-ARTIFACT: CareTagColor must match the DB CHECK constraint in migration 0035. The
 *     source comment warns "if you add a new color here, update the migration's CHECK list" —
 *     but nothing enforced it. A color in this file but NOT in the DB CHECK makes every insert
 *     of a tag with that color fail at runtime. This test is that enforcement.
 */
const here = dirname(fileURLToPath(import.meta.url));

describe("care tag colors", () => {
  it("tagTone maps a known color and falls back to gray for an unknown one", () => {
    expect(tagTone("blue").dot).toBe("bg-blue-400");
    expect(tagTone("definitely-not-a-color")).toEqual(tagTone("gray"));
    expect(tagTone("")).toEqual(tagTone("gray"));
  });

  it("priorityDisplay maps a known priority and falls back to normal for an unknown one", () => {
    expect(priorityDisplay("urgent").label).toBe("Urgent");
    expect(priorityDisplay("nonsense")).toEqual(priorityDisplay("normal"));
  });

  it("priority weights are strictly ordered urgent > high > normal > low", () => {
    const w = (p: string) => priorityDisplay(p).weight;
    expect(w("urgent")).toBeGreaterThan(w("high"));
    expect(w("high")).toBeGreaterThan(w("normal"));
    expect(w("normal")).toBeGreaterThan(w("low"));
  });

  it("ALL_TAG_COLORS / ALL_PRIORITIES have no duplicates", () => {
    expect(new Set(ALL_TAG_COLORS).size).toBe(ALL_TAG_COLORS.length);
    expect(new Set(ALL_PRIORITIES).size).toBe(ALL_PRIORITIES.length);
  });

  it("ALL_TAG_COLORS matches the DB CHECK constraint in migration 0035 (drift = runtime insert failure)", () => {
    const migDir = join(here, "../../../../supabase/migrations");
    const mig = readdirSync(migDir).find((f) => f.startsWith("0035"));
    if (!mig) throw new Error("migration 0035 must exist");
    const sql = readFileSync(join(migDir, mig), "utf8");
    const m = sql.match(/color\s+in\s*\(([^)]+)\)/i);
    const captured = m?.[1];
    if (!captured) throw new Error("0035 must define a `color in (...)` CHECK");
    const dbColors = captured
      .split(",")
      .map((s) => s.trim().replace(/^'|'$/g, ""))
      .filter(Boolean);
    expect([...ALL_TAG_COLORS].sort()).toEqual([...dbColors].sort());
  });
});
