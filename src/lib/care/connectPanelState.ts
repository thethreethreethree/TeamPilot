/**
 * Which panel the /extension/connect page shows, as ONE pure decision.
 *
 * The connect page hands the user's session + refresh token to a browser extension. WHICH panel it renders
 * is security-relevant: the "care-token" panel exposes the raw token for manual copy, and it must NEVER show
 * when the handoff was REFUSED (the extension id isn't the pinned official one) or already CONNECTED. This
 * was inline JSX gating (six independent conditions) — extracted here so the invariant is a testable function
 * instead of a render-time coincidence. Locked by connectPanelState.test.ts.
 *
 * Panels:
 * - "loading"       — session still resolving.
 * - "signedout"     — no session; prompt to sign in.
 * - "connected"     — the auto-handoff succeeded; nothing to do.
 * - "refused"       — the ext id didn't match the pinned official id; explain, offer NO token.
 * - "sales-guidance"— Sales ready-but-not-connected: guide back to one-click Sign in (no manual paste).
 * - "care-token"    — C.A.R.E ready-but-not-connected: the manual copy-token fallback.
 */
export type ConnectPanel =
  | "loading"
  | "signedout"
  | "connected"
  | "refused"
  | "sales-guidance"
  | "care-token";

export function selectConnectPanel(args: {
  state: "loading" | "ready" | "signedout";
  token: string | null;
  autoConnected: boolean;
  refusedExtId: string | null;
  isSales: boolean;
}): ConnectPanel {
  const { state, token, autoConnected, refusedExtId, isSales } = args;
  if (state === "loading") return "loading";
  if (state === "signedout") return "signedout";
  // state === "ready"
  if (autoConnected) return "connected";
  // A refused handoff must NOT fall through to any token-offering panel — the whole point of the id pin is to
  // withhold the token from an unrecognized extension. Explain instead.
  if (refusedExtId) return "refused";
  // Ready but no token is a defensive dead-end (shouldn't happen — "ready" implies a token) → treat as signed out.
  if (!token) return "signedout";
  return isSales ? "sales-guidance" : "care-token";
}
