import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Cross-extension drift guard for the capture-preview class.
 *
 * The class (memory: reference_scrape_capture_ui_must_preview_not_count): a capture UI that shows only a COUNT
 * of what was grabbed ("Read 47 characters") looks identical for a right grab and a wrong one. C.A.R.E's
 * `readAdapter()` auto-extracts via a per-site selector that is reasoned, not runtime-verified — a wrong match
 * returns plausible non-empty garbage (sidebar chrome instead of the thread). Without a preview the user acts on
 * garbage believing it's right (the honesty thesis applied to INPUT).
 *
 * The Sales Coach extension already guards this (salesExtensionClientWiring.test.ts — "previews the captured
 * text, not just a count"). This is the C.A.R.E half of the same class: the sales extension was forked FROM this
 * client, so a fix that lands only in the fork leaves the parent — a LIVE shipped product — count-only. This guard
 * keeps the parent's text-selection status previewing too, so the class can't silently reopen on the parent side.
 *
 * Detection-true: both assertions fail on the pre-fix count-only string ("Read N characters. Pick a tool.").
 * content.js is runtime-unverifiable here (page DOM, no browser) — the browser behavior is confirmed live by the
 * founder; this locks the static invariant.
 */

const CARE_CONTENT = readFileSync(join(process.cwd(), "extension", "content.js"), "utf-8");

describe("C.A.R.E extension content.js — capture status previews, not count-only (honest input)", () => {
  it("derives a bounded preview of the captured text from the current selection", () => {
    expect(CARE_CONTENT).toMatch(/const preview = currentSelection[\s\S]{0,120}slice\(0, 90\)/);
  });

  it("interpolates that preview into the 'Read N characters' selection-info status", () => {
    // The status line the user reads after a grab must carry the preview, not just the character count — so an
    // adapter that matched the wrong nodes is self-evident. Fails on the pre-fix "…characters…. Pick a tool."
    expect(CARE_CONTENT).toMatch(/characters[\s\S]{0,160}\$\{preview\}/);
  });
});
