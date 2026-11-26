// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { getConfig } from "@testing-library/dom";

/** vitest.setup.ts raises Testing Library's wait budget for every DOM test (2026-11-26); this proves it applies. */
describe("Testing Library wait budget", () => {
  it("is 5 s in DOM tests, under the 20 s test timeout", () => {
    expect(getConfig().asyncUtilTimeout).toBe(5000);
  });
});
