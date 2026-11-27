import { describe, it, expect } from "vitest";
import { summarizeUsage } from "../usageReport";

describe("API usage report (E7; F31.9)", () => {
  it("groups by key and route, counts errors (400 and up) and 429s", () => {
    const out = summarizeUsage([
      { key_id: "a", route: "/api/v1/deals", status: 200 },
      { key_id: "a", route: "/api/v1/deals", status: 429 },
      { key_id: "a", route: "/api/v1/deals", status: 500 },
      { key_id: "a", route: "/api/v1/calls", status: 200 },
      { key_id: "b", route: "/api/v1/deals", status: 399 },
    ]);
    expect(out).toEqual([
      { keyId: "a", route: "/api/v1/deals", requests: 3, errors: 2, limited: 1 },
      { keyId: "a", route: "/api/v1/calls", requests: 1, errors: 0, limited: 0 },
      { keyId: "b", route: "/api/v1/deals", requests: 1, errors: 0, limited: 0 },
    ]);
  });
  it("no requests → no lines", () => expect(summarizeUsage([])).toEqual([]));
});
