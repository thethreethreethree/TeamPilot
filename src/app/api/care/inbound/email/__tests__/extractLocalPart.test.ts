import { describe, expect, it } from "vitest";
import { extractLocalPart } from "../route";

/**
 * extractLocalPart parses the inbound To: address to find the tenant's
 * inbound_email_local_part. A regression here silently misroutes or drops
 * support email (tenant lookup fails -> "tenant_unknown" -> 200 ignore), so
 * the parsing edge cases are pinned here.
 */
describe("extractLocalPart", () => {
  it("extracts and lowercases a bare address", () => {
    expect(extractLocalPart("jane@example.com")).toBe("jane");
    expect(extractLocalPart("T-ABC123@care.elostate.com")).toBe("t-abc123");
  });

  it("strips a display-name / angle-bracket wrapper", () => {
    expect(extractLocalPart("Jane Doe <jane@example.com>")).toBe("jane");
    expect(extractLocalPart("<t-x@care.elostate.com>")).toBe("t-x");
    expect(extractLocalPart("  Spaced <s@x.com>  ")).toBe("s");
  });

  it("takes the local part up to the FIRST @", () => {
    expect(extractLocalPart("a@b@c.com")).toBe("a");
  });

  it("returns null when there is no usable local part", () => {
    expect(extractLocalPart("no-at-sign")).toBeNull();
    expect(extractLocalPart("@nolocal.com")).toBeNull(); // '@' at index 0
    expect(extractLocalPart("")).toBeNull();
  });
});
