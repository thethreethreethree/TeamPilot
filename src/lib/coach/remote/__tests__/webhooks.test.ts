import { describe, it, expect } from "vitest";
import { assertEndpointUrl, endpointSecret, EndpointUrlError, isPrivateAddress, resolvesPrivate, sendSigned, sign, verify, webhookBody, WebhookConfigError } from "../webhooks";

const PUBLIC = async () => [{ address: "93.184.216.34" }];

describe("signing and verifying", () => {
  const now = 1_763_600_000;
  it("verify accepts exactly what sign produced, inside the time window", () => {
    const body = webhookBody({ deliveryId: 7, event: "session.scored", createdAt: "2026-11-20T10:00:00Z", payload: { total: 81 } });
    expect(verify("s3", now, body, sign("s3", now, body), now + 60)).toBe(true);
  });
  it("rejects a changed body, a wrong secret, a stale or future timestamp, and garbage", () => {
    const body = "{}";
    const sig = sign("s3", now, body);
    expect(verify("s3", now, "{ }", sig, now)).toBe(false);
    expect(verify("other", now, body, sig, now)).toBe(false);
    expect(verify("s3", now, body, sig, now + 301)).toBe(false);
    expect(verify("s3", now, body, sig, now - 301)).toBe(false);
    expect(verify("s3", now, body, "zz", now)).toBe(false);
  });
});

describe("endpointSecret", () => {
  it("differs per endpoint, is stable, and never equals the master", () => {
    const a = endpointSecret("ep-a", "master");
    expect(a).toBe(endpointSecret("ep-a", "master"));
    expect(a).not.toBe(endpointSecret("ep-b", "master"));
    expect(a).not.toContain("master");
    expect(a.startsWith("whsec_")).toBe(true);
  });
  it("fails loud without the deployment key", () => {
    expect(() => endpointSecret("ep-a", "")).toThrow(WebhookConfigError);
  });
});

describe("assertEndpointUrl", () => {
  it("accepts a public https address", () => {
    expect(assertEndpointUrl(" https://hooks.example.com/elostate ")).toBe("https://hooks.example.com/elostate");
  });
  it("refuses http, credentials, and local or private addresses", () => {
    for (const bad of ["http://hooks.example.com", "https://u:p@hooks.example.com", "https://localhost/x", "https://10.0.0.5/x", "https://192.168.1.2",
      "https://169.254.169.254/latest", "https://172.20.0.1", "https://[::1]/x", "https://db.internal/x", "not a url",
      // Found by probing 2026-11-20: forms the URL parser rewrites, which a dotted-quad test cannot see through.
      "https://2130706433/", "https://0177.0.0.1/", "https://0x7f.0.0.1/", "https://127.1/",
      "https://[::ffff:127.0.0.1]/", "https://[::ffff:7f00:1]/", "https://[::]/", "https://localhost./", "https://[fd00::1]/", "https://[fe80::1]/"]) {
      expect(() => assertEndpointUrl(bad), bad).toThrow(EndpointUrlError);
    }
  });
});

describe("sendSigned — the plan's Phase 9 'Looked at', as a test", () => {
  it("a receiver gets a signed POST that verify() accepts with the endpoint's secret", async () => {
    const captured: { url?: string; headers?: Record<string, string>; body?: string; redirect?: string } = {};
    const fake = (async (url: string, init: RequestInit) => {
      captured.url = url;
      captured.headers = init.headers as Record<string, string>;
      captured.body = String(init.body);
      captured.redirect = init.redirect;
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;
    const secret = endpointSecret("ep-1", "master");
    const body = webhookBody({ deliveryId: 42, event: "session.scored", createdAt: "2026-11-20T10:00:00Z", payload: { sessionId: "s1", total: 81 } });
    const r = await sendSigned("https://hooks.example.com/x", secret, body, 1_763_600_000, fake, PUBLIC);
    expect(r).toEqual({ ok: true, status: 200, error: null });
    const ts = Number(captured.headers!["X-Elostate-Timestamp"]);
    expect(verify(secret, ts, captured.body!, captured.headers!["X-Elostate-Signature"]!, ts + 5)).toBe(true);
    expect(verify(endpointSecret("ep-2", "master"), ts, captured.body!, captured.headers!["X-Elostate-Signature"]!, ts)).toBe(false);
    expect(JSON.parse(captured.body!)).toEqual({ id: "42", event: "session.scored", createdAt: "2026-11-20T10:00:00Z", data: { sessionId: "s1", total: 81 } });
    expect(captured.redirect).toBe("manual");
  });
  it("a non-2xx or a network error is a failed attempt, never a throw", async () => {
    const r500 = await sendSigned("https://x.example.com", "s", "{}", 1, (async () => new Response("", { status: 500 })) as unknown as typeof fetch, PUBLIC);
    expect(r500).toEqual({ ok: false, status: 500, error: "HTTP 500" });
    const down = await sendSigned("https://x.example.com", "s", "{}", 1, (async () => { throw new Error("ECONNREFUSED"); }) as unknown as typeof fetch, PUBLIC);
    expect(down).toEqual({ ok: false, status: null, error: "ECONNREFUSED" });
  });
});

describe("resolvesPrivate — a public-looking name that points inside a network is never called", () => {
  it("classifies literal addresses", () => {
    for (const ip of ["10.1.2.3", "127.0.0.1", "169.254.169.254", "192.168.0.9", "172.16.5.5", "::1", "::", "fd12::1", "fe80::1", "::ffff:10.0.0.1", "::ffff:7f00:1", "[::ffff:a9fe:a9fe]"]) expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["93.184.216.34", "8.8.8.8", "2606:4700::1111"]) expect(isPrivateAddress(ip), ip).toBe(false);
  });
  it("refuses a name resolving to ANY private address, and a name that does not resolve", async () => {
    expect(await resolvesPrivate("https://ok.example.com", PUBLIC)).toBeNull();
    expect(await resolvesPrivate("https://sneaky.example.com", async () => [{ address: "93.184.216.34" }, { address: "10.0.0.7" }])).toMatch(/private/);
    expect(await resolvesPrivate("https://gone.example.com", async () => { throw new Error("ENOTFOUND"); })).toMatch(/did not resolve/);
  });
  it("sendSigned does not call the address when it resolves privately", async () => {
    let called = false;
    const fake = (async () => { called = true; return new Response("", { status: 200 }); }) as unknown as typeof fetch;
    const r = await sendSigned("https://sneaky.example.com", "s", "{}", 1, fake, async () => [{ address: "169.254.169.254" }]);
    expect(r.ok).toBe(false);
    expect(called).toBe(false);
  });
});

describe("DNS rebinding — the connection uses the address checked at connect time", () => {
  it("a name the pre-check saw as public but that resolves private when connecting is refused, not sent", async () => {
    // The injected pre-check says "public" (a rebinding name's first answer); the real connect-time lookup of
    // localhost answers 127.0.0.1 and must refuse before any connection is made.
    const r = await sendSigned("https://localhost:9/hook", "s", "{}", 1, undefined, async () => [{ address: "93.184.216.34" }]);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/private network/);
  });
  it("covers the extra reserved ranges and NAT64", () => {
    for (const ip of ["198.18.0.1", "192.0.0.8", "224.0.0.1", "239.255.255.250", "255.255.255.255", "64:ff9b::7f00:1", "fe90::1"]) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });
});
