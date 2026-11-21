import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { ErasureInputError, identifierHash, maskedHint, normaliseIdentifier } from "../erasure";

describe("normaliseIdentifier", () => {
  it("phone: digits only, national part when a country code is included", () => {
    expect(normaliseIdentifier("phone", "+1 (555) 010-0123")).toBe("5550100123");
    expect(normaliseIdentifier("phone", "555 0123")).toBe("5550123");
    expect(() => normaliseIdentifier("phone", "12-34")).toThrow(ErasureInputError);
  });
  it("email: lower-cased, must look like an email", () => {
    expect(normaliseIdentifier("email", "  Pat@Acme.COM ")).toBe("pat@acme.com");
    expect(() => normaliseIdentifier("email", "pat at acme")).toThrow(ErasureInputError);
  });
  it("client name: trimmed, lower-cased, at least two characters", () => {
    expect(normaliseIdentifier("client_label", "  Acme Corp ")).toBe("acme corp");
    expect(() => normaliseIdentifier("client_label", "A")).toThrow(ErasureInputError);
  });
});

describe("maskedHint never carries the identifier", () => {
  it("shows at most the last four digits / first letter", () => {
    expect(maskedHint("phone", "5550100123")).toBe("phone ••••0123");
    expect(maskedHint("email", "pat@acme.com")).toBe("email p•••@acme.com");
    expect(maskedHint("client_label", "acme corp")).toBe("client A•••");
    expect(maskedHint("phone", "5550100123")).not.toContain("555010");
  });
});

describe("identifierHash", () => {
  it("is keyed: the same identifier hashes the same with one key and differently with another", () => {
    const a = identifierHash("phone", "5550100123", "key-1");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(identifierHash("phone", "5550100123", "key-1")).toBe(a);
    expect(identifierHash("phone", "5550100123", "key-2")).not.toBe(a);
    expect(identifierHash("email", "5550100123", "key-1")).not.toBe(a); // the kind is part of it
  });
  it("refuses to hash without a key (fail loud, never an empty-key hash)", () => {
    expect(() => identifierHash("phone", "5550100123", "")).toThrow(/key unavailable/);
  });
});
