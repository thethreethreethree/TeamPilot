import { describe, expect, it } from "vitest";
import { isSafePushEndpoint } from "../pushEndpoint";

describe("isSafePushEndpoint — SSRF guard for stored push endpoints", () => {
  it("accepts the real push-service endpoints", () => {
    // These are the hosts legitimate browsers hand us — must never be rejected.
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc123", // Chrome/Android (starts with "fc"!)
      "https://updates.push.services.mozilla.com/wpush/v2/xyz", // Firefox
      "https://web.push.apple.com/QABC", // Safari
      "https://sea-1.notify.windows.com/w/?token=abc", // Edge/WNS
    ]) {
      expect(isSafePushEndpoint(url), url).toBe(true);
    }
  });

  it("rejects cloud-metadata + loopback + private IPv4 literals (the SSRF targets)", () => {
    for (const url of [
      "https://169.254.169.254/latest/meta-data/", // AWS/GCP metadata
      "https://127.0.0.1/", // loopback
      "https://10.0.0.5/internal", // RFC1918
      "https://192.168.1.1/", // RFC1918
      "https://172.16.0.1/", // RFC1918
      "https://0.0.0.0/", // this-network
    ]) {
      expect(isSafePushEndpoint(url), url).toBe(false);
    }
  });

  it("rejects localhost + IPv6 loopback/link-local/unique-local literals", () => {
    expect(isSafePushEndpoint("https://localhost/x")).toBe(false);
    expect(isSafePushEndpoint("https://[::1]/x")).toBe(false);
    expect(isSafePushEndpoint("https://[fe80::1]/x")).toBe(false);
    expect(isSafePushEndpoint("https://[fc00::1]/x")).toBe(false);
  });

  it("requires https (blocks http://internal targets)", () => {
    expect(isSafePushEndpoint("http://fcm.googleapis.com/fcm/send/x")).toBe(false);
    expect(isSafePushEndpoint("http://127.0.0.1/")).toBe(false);
  });

  it("rejects garbage / non-URLs", () => {
    expect(isSafePushEndpoint("not a url")).toBe(false);
    expect(isSafePushEndpoint("")).toBe(false);
    expect(isSafePushEndpoint("ftp://example.com/")).toBe(false);
  });
});
