import { describe, it, expect } from "vitest";
import { isExtensionHandoffAllowed } from "../extensionHandoff";

/**
 * Locks the connect-page token-handoff gate. `/extension/connect` hands the session + long-lived refresh
 * token to the extension id in the `?ext=` URL param — attacker-controllable. This predicate is what stops
 * a lure to `?ext=<malicious-id>` from exfiltrating the token. A regression here reopens a token-theft hole,
 * so the security-critical cases are pinned.
 */

const OFFICIAL = "abcdefghijklmnopabcdefghijklmnop"; // a stand-in official extension id

describe("isExtensionHandoffAllowed — connect-page token handoff gate", () => {
  it("PROD (official id configured): allows ONLY the official id", () => {
    expect(isExtensionHandoffAllowed(OFFICIAL, OFFICIAL)).toBe(true);
  });

  it("PROD: REFUSES any other id — the token-theft defense", () => {
    expect(isExtensionHandoffAllowed("malicious-extension-id-from-a-lure", OFFICIAL)).toBe(false);
    expect(isExtensionHandoffAllowed(OFFICIAL + "x", OFFICIAL)).toBe(false); // near-miss
  });

  it("DEV (no official id configured): allows any non-empty id (caller logs the missing pin)", () => {
    expect(isExtensionHandoffAllowed("some-unpacked-dev-id", "")).toBe(true);
  });

  it("never allows an absent/empty ext id, configured or not", () => {
    expect(isExtensionHandoffAllowed(null, OFFICIAL)).toBe(false);
    expect(isExtensionHandoffAllowed(undefined, OFFICIAL)).toBe(false);
    expect(isExtensionHandoffAllowed("", OFFICIAL)).toBe(false);
    expect(isExtensionHandoffAllowed(null, "")).toBe(false);
    expect(isExtensionHandoffAllowed("", "")).toBe(false);
  });
});
