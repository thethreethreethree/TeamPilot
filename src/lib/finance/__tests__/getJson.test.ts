import { describe, it, expect, vi, beforeEach } from "vitest";
import { getJson } from "../getJson";

/** 2026-11-23: a finance read that failed must not reach the page as data. */
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("getJson", () => {
  it("returns the body of a good answer, empty lists included", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ bills: [] }) });
    expect(await getJson("/api/finance/ap/bills")).toEqual({ bills: [] });
  });
  it("throws on a non-OK answer", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({ error: "Could not load this right now." }) });
    await expect(getJson("/api/finance/ap/bills")).rejects.toThrow(/could not load/i);
  });
  it("throws on an error body even with 200, and on a body that isn't JSON", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ error: "nope" }) });
    await expect(getJson("/x")).rejects.toThrow("nope");
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => { throw new SyntaxError("<html>"); } });
    await expect(getJson("/x")).rejects.toThrow(/answered 200/);
  });
});
