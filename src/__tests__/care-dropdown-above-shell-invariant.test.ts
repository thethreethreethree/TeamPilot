import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * REGRESSION GUARD for THE Assign bug (2026-07-24, root cause commit ad3b46a5).
 *
 * The C.A.R.E surface renders inside CareShell, whose root is `fixed inset-0 z-[60]` with an OPAQUE
 * background. FloatingMenu portals its dropdown to document.body, so a dropdown becomes a SIBLING of
 * that shell — if its zIndex is <= the shell's z, it opens INVISIBLY BEHIND the opaque shell and is
 * neither visible nor clickable. That was the real cause of "Assign does nothing at all" (the two
 * earlier `relative z-10` toolbar fixes were the wrong layer). The dropdowns were lifted to z-70.
 *
 * This test enforces the invariant so no one can silently drop a care dropdown back below the shell:
 *   every zIndex passed to a FloatingMenu in the shell-hosted care files MUST exceed the shell z.
 *
 * If it fails: a care FloatingMenu's zIndex is <= CareShell's root z-index. Raise it above the shell
 * (>= 70, matching the other above-shell care overlays) or the dropdown will render behind the shell.
 */

const CARE = join(process.cwd(), "src", "components", "care");
const SHELL_FILE = join(CARE, "CareShell.tsx");
// Files whose FloatingMenus render INSIDE the z-[60] CareShell (portaled to body, so they must clear it).
const SHELL_HOSTED = [SHELL_FILE, join(CARE, "ConversationsApp.tsx")];

function readShellZ(): number {
  const src = readFileSync(SHELL_FILE, "utf8");
  // The shell root: `fixed inset-0 z-[60] ... bg-base ...`. Grab the z on that fixed full-viewport root.
  const m = src.match(/fixed\s+inset-0\s+z-\[(\d+)\]/);
  if (!m) throw new Error("Could not find CareShell's `fixed inset-0 z-[NN]` root — did the shell change?");
  return Number(m[1]);
}

function floatingMenuZIndexes(file: string): number[] {
  const src = readFileSync(file, "utf8");
  const zs: number[] = [];
  // Match each <FloatingMenu ...> open tag and pull its zIndex={NN}. FloatingMenu is the only
  // body-portaled dropdown shell in the app, so a zIndex prop here is a portaled-dropdown layer.
  // The `(?<!=)>` stops at the tag-closing `>` and NOT at the `>` inside arrow props like
  // `onClose={() => ...}` — a plain `*?>` truncates the tag before zIndex and reads vacuously empty.
  for (const tag of src.matchAll(/<FloatingMenu\b[\s\S]*?(?<!=)>/g)) {
    const z = tag[0].match(/zIndex=\{(\d+)\}/);
    if (z) zs.push(Number(z[1]));
  }
  return zs;
}

describe("care dropdowns render above the CareShell overlay (Assign-bug regression guard)", () => {
  it("every FloatingMenu inside the shell uses a zIndex greater than the shell's z-index", () => {
    const shellZ = readShellZ();
    expect(shellZ).toBeGreaterThan(0);

    const offenders: string[] = [];
    for (const file of SHELL_HOSTED) {
      for (const z of floatingMenuZIndexes(file)) {
        if (z <= shellZ) {
          offenders.push(`${file.split(/[\\/]/).pop()}: FloatingMenu zIndex=${z} <= shell z-[${shellZ}]`);
        }
      }
    }

    expect(
      offenders,
      `A C.A.R.E dropdown would open BEHIND the opaque z-[${shellZ}] CareShell (portaled to body). ` +
        `This is THE Assign bug. Raise the zIndex above ${shellZ} (>= 70):\n  ${offenders.join("\n  ")}`
    ).toEqual([]);
  });

  it("finds the shell-hosted FloatingMenus it is meant to guard (not vacuously green)", () => {
    const total = SHELL_HOSTED.reduce((n, f) => n + floatingMenuZIndexes(f).length, 0);
    // Assign + Priority (ConversationsApp) + status picker (CareShell) = at least 3 today.
    expect(total).toBeGreaterThanOrEqual(3);
  });
});
