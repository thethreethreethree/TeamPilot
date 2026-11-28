import { describe, it, expect } from "vitest";
import { inRange, ipAllowed, requestIp, validEntry } from "../ipAllow";

/** Trusted addresses (E15; F33.10). Pinned: v4 and v6 addresses and ranges; a mapped v4; anything unparsable never matches (fail closed); x-real-ip only. */
describe("trusted addresses", () => {
  it("IPv4 addresses and ranges", () => {
    expect(inRange("203.0.113.7", "203.0.113.7")).toBe(true);
    expect(inRange("203.0.113.8", "203.0.113.7")).toBe(false);
    expect(inRange("198.51.100.200", "198.51.100.0/24")).toBe(true);
    expect(inRange("198.51.101.1", "198.51.100.0/24")).toBe(false);
    expect(inRange("10.9.8.7", "10.0.0.0/8")).toBe(true);
    expect(inRange("1.2.3.4", "0.0.0.0/0")).toBe(true);
  });
  it("IPv6, and an IPv4-mapped address read as IPv4", () => {
    expect(inRange("2001:db8::1", "2001:db8::/32")).toBe(true);
    expect(inRange("2001:db9::1", "2001:db8::/32")).toBe(false);
    expect(inRange("::1", "::1")).toBe(true);
    expect(inRange("::ffff:203.0.113.7", "203.0.113.0/24")).toBe(true);
    expect(inRange("2001:db8::1", "203.0.113.0/24")).toBe(false);
  });
  it("garbage never matches; no list = anywhere; a list with no address = refused", () => {
    expect(inRange("not-an-ip", "0.0.0.0/0")).toBe(false);
    expect(inRange("1.2.3.4", "1.2.3.4/33")).toBe(false);
    expect(inRange("999.1.1.1", "0.0.0.0/0")).toBe(false);
    expect(ipAllowed(null, null)).toBe(true);
    expect(ipAllowed("1.2.3.4", [])).toBe(true);
    expect(ipAllowed(null, ["1.2.3.4"])).toBe(false);
    expect(ipAllowed("1.2.3.4", ["5.6.7.8", "1.2.3.0/24"])).toBe(true);
  });
  it("valid entries are what the cidr column accepts", () => {
    expect(validEntry("203.0.113.0/24")).toBe(true);
    expect(validEntry("2001:db8::/32")).toBe(true);
    expect(validEntry("10.0.0.1/8")).toBe(false); // host bits past the prefix
    expect(validEntry("example.com")).toBe(false);
  });
  it("the address is x-real-ip only, never the client-sendable x-forwarded-for", () => {
    expect(requestIp(new Request("http://x", { headers: { "x-real-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" } }))).toBe("1.2.3.4");
    expect(requestIp(new Request("http://x", { headers: { "x-forwarded-for": "9.9.9.9" } }))).toBeNull();
  });
});
