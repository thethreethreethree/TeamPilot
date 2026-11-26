import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Where the bell lives (2026-11-26). It was mounted only on the Scoreboard page as `{isManager && <NotificationBell />}`,
 * so every notice written to a rep was invisible to them. Both module shells now mount it for everyone; this keeps it
 * that way — no file may put the bell behind a manager check, and both shells must mount it.
 */
const ROOT = join(__dirname, "../../..");
function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (n === "__tests__" || n === "node_modules") return [];
    return statSync(p).isDirectory() ? files(p) : /\.tsx$/.test(n) ? [p] : [];
  });
}

describe("NotificationBell is everyone's", () => {
  it("no component mounts it behind a manager check", () => {
    const gated = files(ROOT).filter((f) => /isManager\s*&&\s*<NotificationBell|isSalesCoachManager\s*&&\s*<NotificationBell/.test(readFileSync(f, "utf8")));
    expect(gated).toEqual([]);
  });
  it("both module shells mount it", () => {
    for (const shell of ["components/sales-coach/SalesCoachShell.tsx", "components/remote-sales/RemoteSalesShell.tsx"]) {
      expect(readFileSync(join(ROOT, shell), "utf8")).toMatch(/<NotificationBell\b/);
    }
  });
});
