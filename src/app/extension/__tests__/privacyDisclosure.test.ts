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
