import { describe, expect, it } from "vitest";
import { extractLocalPart, pickInboundRoutingAddress } from "../route";

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

/**
 * pickInboundRoutingAddress selects which address tenant routing parses. It must prefer
 * Postmark's OriginalRecipient (the single delivered-to address) over the To header, which
 * can list multiple/reordered recipients — otherwise a support email whose tenant address
 * isn't first in To is silently dropped (tenant_unknown).
 */
describe("pickInboundRoutingAddress", () => {
  it("prefers OriginalRecipient when present", () => {
    expect(
      pickInboundRoutingAddress({
        OriginalRecipient: "t-acme@care.elostate.com",
        To: "t-acme@care.elostate.com",
      })
    ).toBe("t-acme@care.elostate.com");
  });

  it("routes correctly when the tenant address is NOT first in a multi-recipient To (the fix)", () => {
    // Without OriginalRecipient, extractLocalPart(To) would parse "cc" → tenant miss → drop.
    const addr = pickInboundRoutingAddress({
      OriginalRecipient: "t-acme@care.elostate.com",
      To: "cc@customer.com, t-acme@care.elostate.com",
    });
    expect(addr).toBe("t-acme@care.elostate.com");
    expect(extractLocalPart(addr)).toBe("t-acme"); // correct tenant local part
  });

  it("falls back to To when OriginalRecipient is absent or blank (no behavior change)", () => {
    expect(pickInboundRoutingAddress({ To: "t-x@care.elostate.com" })).toBe(
      "t-x@care.elostate.com"
    );
    expect(
      pickInboundRoutingAddress({ OriginalRecipient: "   ", To: "t-y@care.elostate.com" })
    ).toBe("t-y@care.elostate.com");
  });
});
