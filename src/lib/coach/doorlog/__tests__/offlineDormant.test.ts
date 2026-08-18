import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Dormancy gate for the Door Log offline system (founder instruction 2026-08-18: the offline system is WITHHELD
 * until its build plan/structure is set — it must stay "hidden from the user and must not interfere").
 *
 * The code currently honors this — DoorLog.tsx sends online-only and no live surface imports the offline queue,
 * so it is never bundled into the client. But the existing offlineQueue.test.ts only guards the DRAIN INTEGRITY
 * invariant (remove-only-on-success); nothing guards the DORMANCY itself. Without this gate a future edit could
 * re-wire enqueue()/drainQueue()/startAutoDrain() into a client surface before the founder's build plan is ready,
 * silently re-enabling the withheld system with every other test green.
 *
 * This scans every LIVE (non-test) client/source file and fails if any of them IMPORTS the dormant module. When
 * the founder deliberately re-enables the offline system (per offlineQueue.ts: re-wire DoorLog's noAnswer/save to
 * enqueue()+drainQueue() and restore startAutoDrain()), THIS TEST is the conscious gate that must be updated in
 * the same change — that is the point: re-enable is a decision, never an accident.
 */

const OFFLINE_MODULE = /from\s+["'][^"']*doorlog\/offlineQueue["']|from\s+["']\.\/offlineQueue["']/;

// Only real ES imports count — a comment that names the path (DoorLog.tsx documents where the dormant module
// lives) is not a wiring. We match the `from "...offlineQueue"` import form, which never appears in prose.
const ROOTS = ["src/components", "src/app", "src/lib"];

function walk(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === "__tests__") continue; // tests may exercise the dormant module directly
      out.push(...walk(p));
    } else if ((p.endsWith(".ts") || p.endsWith(".tsx")) && !p.endsWith(".test.ts") && !p.endsWith(".test.tsx")) {
      // the module itself is allowed to reference its own path
      if (!p.replace(/\\/g, "/").endsWith("doorlog/offlineQueue.ts")) out.push(p);
    }
  }
  return out;
}

describe("Door Log offline system — DORMANT until the founder's build plan re-enables it (2026-08-18)", () => {
  const files = ROOTS.flatMap(walk);

  it("scans a non-trivial number of source files (guard is actually wired)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no live (non-test) surface imports doorlog/offlineQueue", () => {
    const wired = files.filter((f) => OFFLINE_MODULE.test(readFileSync(f, "utf8")));
    expect(
      wired.map((f) => f.replace(/\\/g, "/")),
      "the WITHHELD offline system is imported by a live surface — if you are DELIBERATELY re-enabling it per the " +
        "founder's build plan, update this gate in the same change; otherwise remove the import (DoorLog is online-only)",
    ).toEqual([]);
  });
});
