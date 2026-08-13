import { describe, it, expect } from "vitest";
import { selectConnectPanel, type ConnectPanel } from "../connectPanelState";

const base = {
  state: "ready" as "loading" | "ready" | "signedout",
  token: "tok" as string | null,
  autoConnected: false,
  refusedExtId: null as string | null,
  isSales: false,
};

describe("selectConnectPanel", () => {
  it("loading state → loading (regardless of the rest)", () => {
    expect(selectConnectPanel({ ...base, state: "loading" })).toBe("loading");
  });

  it("signedout state → signedout", () => {
    expect(selectConnectPanel({ ...base, state: "signedout", token: null })).toBe("signedout");
  });

  it("ready + autoConnected → connected", () => {
    expect(selectConnectPanel({ ...base, autoConnected: true })).toBe("connected");
  });

  it("ready + refused → refused", () => {
    expect(selectConnectPanel({ ...base, refusedExtId: "abc" })).toBe("refused");
  });

  it("ready + not connected + Sales → sales-guidance (no token offered)", () => {
    expect(selectConnectPanel({ ...base, isSales: true })).toBe("sales-guidance");
  });

  it("ready + not connected + C.A.R.E → care-token (the manual fallback)", () => {
    expect(selectConnectPanel({ ...base, isSales: false })).toBe("care-token");
  });

  it("ready but token missing → signedout (defensive, never care-token)", () => {
    expect(selectConnectPanel({ ...base, token: null })).toBe("signedout");
  });

  /**
   * SECURITY INVARIANT: the "care-token" panel exposes the raw session token for manual copy. It must NEVER
   * appear when the handoff was REFUSED (wrong ext id) or already CONNECTED — otherwise the id-pin is
   * bypassable via manual paste. Exhaustively assert the token panel only appears in the one safe combination.
   */
  it("NEVER offers the token panel on a refused handoff, for either product", () => {
    for (const isSales of [true, false]) {
      const panel = selectConnectPanel({ ...base, isSales, refusedExtId: "malicious-id" });
      expect(panel).toBe("refused");
      expect(panel).not.toBe("care-token");
    }
  });

  it("NEVER offers the token panel once connected", () => {
    const panel = selectConnectPanel({ ...base, autoConnected: true });
    expect(panel).not.toBe("care-token");
  });

  it("the token panel appears ONLY in the exact safe combination", () => {
    // Enumerate the full boolean space; care-token must be reachable by exactly one combination.
    const states: Array<"loading" | "ready" | "signedout"> = ["loading", "ready", "signedout"];
    const tokenPanels: ConnectPanel[] = [];
    for (const state of states)
      for (const token of ["tok", null])
        for (const autoConnected of [true, false])
          for (const refusedExtId of ["id", null])
            for (const isSales of [true, false]) {
              const p = selectConnectPanel({ state, token, autoConnected, refusedExtId, isSales });
              if (p === "care-token") {
                expect({ state, token, autoConnected, refusedExtId, isSales }).toEqual({
                  state: "ready",
                  token: "tok",
                  autoConnected: false,
                  refusedExtId: null,
                  isSales: false,
                });
                tokenPanels.push(p);
              }
            }
    // Exactly the token=present variations of the one safe combo (here token is fixed non-null → one hit).
    expect(tokenPanels.length).toBe(1);
  });
});
