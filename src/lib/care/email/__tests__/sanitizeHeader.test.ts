import { describe, expect, it } from "vitest";
import {
  sanitizeEmailDisplayName,
  formatEmailAddress,
} from "../sanitizeHeader";

/**
 * These pin the fix for the outbound email recipient-injection finding
 * (audit 2026-07-07): an attacker-controlled inbound From display name is
 * stored as the customer name and interpolated into Postmark's To field,
 * which accepts a comma-separated address list. A `"` in the name could
 * close the quoted display-string and inject a second recipient.
 */
describe("sanitizeEmailDisplayName", () => {
  it("neutralizes the recipient-injection payload", () => {
    const evil = 'X" <attacker@evil.com>, "Y';
    const safe = sanitizeEmailDisplayName(evil);
    // The quote + angle brackets that enable break-out are gone.
    expect(safe).not.toContain('"');
    expect(safe).not.toContain("<");
    expect(safe).not.toContain(">");
    // And the full formatted address stays a SINGLE quoted display-string —
    // no second address can be parsed out of it.
    const formatted = formatEmailAddress("real@customer.com", evil);
    expect(formatted).toBe('"X attacker@evil.com, Y" <real@customer.com>');
    // Exactly one `<addr>` token → exactly one recipient.
    expect(formatted.match(/</g)?.length).toBe(1);
  });

  it("strips backslashes (the other quoted-string escape char)", () => {
    expect(sanitizeEmailDisplayName('a\\"b')).toBe("ab");
  });

  it("strips CR/LF and control chars (header injection)", () => {
    const out = sanitizeEmailDisplayName("Jane\r\nBcc: evil@x.com");
    expect(out).not.toContain("\r");
    expect(out).not.toContain("\n");
    expect(out).toContain("Jane");
  });

  it("preserves an ordinary name unchanged", () => {
    expect(sanitizeEmailDisplayName("Jane Doe")).toBe("Jane Doe");
  });

  it("caps length at 200 chars", () => {
    expect(sanitizeEmailDisplayName("a".repeat(500)).length).toBe(200);
  });

  it("handles null/undefined/empty", () => {
    expect(sanitizeEmailDisplayName(null)).toBe("");
    expect(sanitizeEmailDisplayName(undefined)).toBe("");
    expect(sanitizeEmailDisplayName("   ")).toBe("");
  });
});

describe("formatEmailAddress", () => {
  it("returns the bare address when the name sanitizes to empty", () => {
    // No empty `""` wrapper — a name of only quotes collapses to nothing.
    expect(formatEmailAddress("a@b.com", '"')).toBe("a@b.com");
    expect(formatEmailAddress("a@b.com", null)).toBe("a@b.com");
  });

  it("wraps a valid name in quotes", () => {
    expect(formatEmailAddress("a@b.com", "Jane")).toBe('"Jane" <a@b.com>');
  });

  it("strips CR/LF from the address so a caller can't smuggle a header (§A27 defense-in-depth)", () => {
    // A control char is never valid in an email address; if an unvalidated address ever reached here,
    // the CRLF-injected header must not survive into the built recipient string.
    const evil = "real@customer.com\r\nBcc: attacker@evil.com";
    const out = formatEmailAddress(evil, "Jane");
    // The security property: NO CR/LF survives, so the "Bcc:" text can never become a real header — it
    // collapses into one malformed address token on a single line (harmless), not a header break.
    expect(out).not.toMatch(/[\r\n]/);
    expect(out).toBe('"Jane" <real@customer.comBcc: attacker@evil.com>');
  });

  it("strips angle brackets from the address so it can't close its own <...> early", () => {
    // "<" and ">" removed → the injected second address can't become its own <...> token.
    expect(formatEmailAddress("a@b.com> <evil@x.com", null)).toBe("a@b.com evil@x.com");
  });
});
