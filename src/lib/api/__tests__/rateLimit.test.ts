import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { rateLimit } from "../rateLimit";

/**
 * rateLimit tests. This limiter guards every LLM / abuse-prone route, so a
 * regression in its window/counter logic would silently un-protect all of
 * them. Each test uses a UNIQUE id (the module-level bucket map persists
 * across calls) so tests don't bleed into each other.
 */
function reqFrom(ip: string): NextRequest {
  return new NextRequest("http://localhost/api/x", {
    headers: { "x-forwarded-for": ip },
  });
}

function reqWith(headers: Record<string, string>): NextRequest {
  return new NextRequest("http://localhost/api/x", { headers });
}

let n = 0;
const freshId = () => `test-${n++}`;

afterEach(() => {
  vi.useRealTimers();
});

describe("rateLimit", () => {
  it("allows exactly `max` requests in the window, then 429s", () => {
    const id = freshId();
    const req = reqFrom("10.0.0.1");
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(req, { id, windowMs: 60_000, max: 3 })).toBeNull();
    }
    const blocked = rateLimit(req, { id, windowMs: 60_000, max: 3 });
    expect(blocked).not.toBeNull();
    expect(blocked!.status).toBe(429);
    expect(blocked!.headers.get("Retry-After")).toBeTruthy();
  });

  it("keys separately by client IP", () => {
    const id = freshId();
    // Exhaust IP A.
    for (let i = 0; i < 2; i++) {
      expect(rateLimit(reqFrom("10.0.0.2"), { id, windowMs: 60_000, max: 2 })).toBeNull();
    }
    expect(rateLimit(reqFrom("10.0.0.2"), { id, windowMs: 60_000, max: 2 })).not.toBeNull();
    // A different IP still has its own fresh budget.
    expect(rateLimit(reqFrom("10.0.0.3"), { id, windowMs: 60_000, max: 2 })).toBeNull();
  });

  it("keys separately by limiter id", () => {
    const ip = "10.0.0.4";
    const idA = freshId();
    const idB = freshId();
    expect(rateLimit(reqFrom(ip), { id: idA, windowMs: 60_000, max: 1 })).toBeNull();
    expect(rateLimit(reqFrom(ip), { id: idA, windowMs: 60_000, max: 1 })).not.toBeNull();
    // Same client, different limiter id → independent budget.
    expect(rateLimit(reqFrom(ip), { id: idB, windowMs: 60_000, max: 1 })).toBeNull();
  });

  it("prefers x-real-ip over x-forwarded-for as the client key", () => {
    const id = freshId();
    // Same x-real-ip, DIFFERENT x-forwarded-for. If the limiter keyed on XFF, the second request
    // (fresh XFF) would get its own budget — the exact spoofing bypass this guards against. Keying
    // on the platform-set x-real-ip means both share one bucket.
    const a = reqWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" });
    const b = reqWith({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "2.2.2.2" }); // attacker rotates XFF
    expect(rateLimit(a, { id, windowMs: 60_000, max: 1 })).toBeNull();
    expect(rateLimit(b, { id, windowMs: 60_000, max: 1 })).not.toBeNull(); // same bucket → 429
  });

  it("falls back to x-forwarded-for when x-real-ip is absent (legacy behavior preserved)", () => {
    const id = freshId();
    const req = reqFrom("10.0.0.9");
    expect(rateLimit(req, { id, windowMs: 60_000, max: 1 })).toBeNull();
    expect(rateLimit(req, { id, windowMs: 60_000, max: 1 })).not.toBeNull();
  });

  it("frees the budget once the window slides past old requests", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2_000_000_000_000));
    const id = freshId();
    const req = reqFrom("10.0.0.5");
    expect(rateLimit(req, { id, windowMs: 10_000, max: 1 })).toBeNull();
    expect(rateLimit(req, { id, windowMs: 10_000, max: 1 })).not.toBeNull(); // still in window
    vi.setSystemTime(new Date(2_000_000_000_000 + 10_001)); // past the window
    expect(rateLimit(req, { id, windowMs: 10_000, max: 1 })).toBeNull(); // freed
  });
});
