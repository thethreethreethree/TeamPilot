import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Data-use accuracy guard for the two extension privacy pages (Chrome Web Store compliance + honesty).
 *
 * The class: both pages claimed "we don't sell or share your data with third parties", but every coaching tool
 * sends the conversation text to a THIRD-PARTY AI provider (DeepSeek) to generate the result. That claim is
 * false (a Web Store data-use rejection + a misleading statement). Fixed 2026-08-09 to disclose the AI
 * sub-processor accurately. This locks it: the false claim can't silently return, and the sub-processor
 * disclosure can't be dropped. Detection-true: fails on the pre-fix copy.
 */

const pages = {
  "C.A.R.E": "src/app/extension/privacy/page.tsx",
  Sales: "src/app/extension/privacy-sales/page.tsx",
} as const;

describe("extension privacy pages — accurate third-party AI disclosure (CWS + §3.4)", () => {
  for (const [name, rel] of Object.entries(pages)) {
    const src = readFileSync(join(process.cwd(), rel), "utf-8");

    it(`${name}: does NOT carry the false "don't share with third parties" claim`, () => {
      expect(src).not.toMatch(/sell or share your data with third parties/i);
    });

    it(`${name}: DISCLOSES the third-party AI sub-processor that generates the result`, () => {
      expect(src).toMatch(/sub-processor/i);
      expect(src).toMatch(/AI provider/i);
    });
  }
});

/**
 * Accuracy guards for the specific defects the 2026-08-09 compliance review caught (which the disclosure guard
 * above missed): a save-path claim that doesn't match the code, and stale tool names. Detection-true: each fails
 * on the pre-fix copy.
 */
describe("extension privacy pages — feature accuracy (matches the shipped code)", () => {
  const care = readFileSync(join(process.cwd(), "src/app/extension/privacy/page.tsx"), "utf-8");
  const sales = readFileSync(join(process.cwd(), "src/app/extension/privacy-sales/page.tsx"), "utf-8");

  it("C.A.R.E: does NOT claim Spawn saves data (only Capture is a save-path in the code)", () => {
    // spawn/route.ts returns a DRAFT and does not persist; Capture is the only save. The page must not list
    // "spawning a task" as a save example (it did — review Finding 1).
    expect(care).not.toMatch(/spawning a task[\s\S]{0,60}(saved|stored|store)/i);
  });

  it("Sales: does NOT list the pre-merge tool names (the UI has Prospect Intel + Suggested Response)", () => {
    for (const stale of ["Coach my reply", "Catch me up", "Draft my reply", "Say it for me"]) {
      expect(sales).not.toContain(stale);
    }
    expect(sales).toMatch(/Prospect Intel/);
    expect(sales).toMatch(/Suggested Response/);
  });

  it("Sales: discloses the Upload-conversation file channel (a distinct data-collection path)", () => {
    expect(sales).toMatch(/Upload conversation/i);
  });
});
