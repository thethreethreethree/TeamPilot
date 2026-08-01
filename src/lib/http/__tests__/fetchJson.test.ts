import { describe, it, expect, vi, afterEach } from "vitest";
import { fetchJson, FetchJsonError } from "../fetchJson";

/**
 * fetchJson turns every detectable failure into a typed throw, so a caller can
 * tell a load FAILURE from a genuinely-empty result — the fix for the
 * error-dressed-as-no-data class. These lock each failure mode + the happy path.
 */

/** Build a minimal Response-like stub (fetchJson only calls .ok/.status/.text()). */
function resp(status: number, bodyText: string): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => bodyText,
  } as unknown as Response;
}

const stubFetch = (impl: () => Promise<Response>) =>
  vi.stubGlobal("fetch", vi.fn(impl));

afterEach(() => vi.unstubAllGlobals());

describe("fetchJson", () => {
  it("returns the parsed body on a 2xx JSON response", async () => {
    stubFetch(async () => resp(200, JSON.stringify({ items: [1, 2, 3] })));
    const data = await fetchJson<{ items: number[] }>("/api/x");
    expect(data.items).toEqual([1, 2, 3]);
  });

  it("returns undefined on a 2xx with an empty body", async () => {
    stubFetch(async () => resp(204, ""));
    await expect(fetchJson("/api/x")).resolves.toBeUndefined();
  });

  it("throws with the server's error message on a non-2xx JSON body", async () => {
    stubFetch(async () => resp(500, JSON.stringify({ error: "ledger exploded" })));
    await expect(fetchJson("/api/x")).rejects.toMatchObject({
      name: "FetchJsonError",
      status: 500,
      message: "ledger exploded",
    });
  });

  it("throws a generic message on a non-2xx NON-JSON body (e.g. an HTML 500 page)", async () => {
    stubFetch(async () => resp(502, "<html>Bad Gateway</html>"));
    await expect(fetchJson("/api/x")).rejects.toMatchObject({
      status: 502,
      message: "Request failed (502)",
    });
  });

  it("throws (status 0) on a network/transport failure", async () => {
    stubFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    const err = await fetchJson("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FetchJsonError);
    const fe = err as FetchJsonError;
    expect(fe.status).toBe(0);
    expect(fe.message).toBe("Failed to fetch");
  });

  it("throws on a 2xx body carrying a string error field (default soft-error handling)", async () => {
    stubFetch(async () => resp(200, JSON.stringify({ error: "not initialized" })));
    await expect(fetchJson("/api/x")).rejects.toMatchObject({
      status: 200,
      message: "not initialized",
    });
  });

  it("does NOT treat a 2xx {error} as a failure when treatBodyErrorAsFailure is false", async () => {
    stubFetch(async () => resp(200, JSON.stringify({ error: "soft", ok: true })));
    const data = await fetchJson<{ error: string; ok: boolean }>("/api/x", {
      treatBodyErrorAsFailure: false,
    });
    expect(data.error).toBe("soft");
  });

  it("ignores a non-string / empty error field on a 2xx (real data, not a soft error)", async () => {
    stubFetch(async () => resp(200, JSON.stringify({ error: null, rows: 5 })));
    const data = await fetchJson<{ error: null; rows: number }>("/api/x");
    expect(data.rows).toBe(5);
  });

  it("wraps a body-read failure (res.text() rejects) as a FetchJsonError, not a raw error", async () => {
    const bad = {
      ok: true,
      status: 200,
      text: async () => {
        throw new TypeError("network error while reading body");
      },
    } as unknown as Response;
    stubFetch(async () => bad);
    const err = await fetchJson("/api/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FetchJsonError);
    expect((err as FetchJsonError).message).toBe("network error while reading body");
  });

  it("throws 'not valid JSON' on a 2xx with a malformed body", async () => {
    stubFetch(async () => resp(200, "{not json"));
    await expect(fetchJson("/api/x")).rejects.toMatchObject({
      status: 200,
      message: "Response was not valid JSON",
    });
  });
});
