// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * The bell is everyone's (2026-11-26). It used to render only on the Scoreboard page, behind a manager check, so a rep
 * never saw the notices written to them — call ready, call scored, score corrected, dispute answered, mentions.
 */
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/remote-sales" }));
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false, useCurrentUserRole: () => "member", isCompanyAdminRole: () => false }));
vi.mock("@/lib/hooks/useRemoteMacroMode", () => ({ useRemoteMacroMode: () => ({ enabled: false }) }));
vi.mock("@/lib/supabase/client", () => ({ supabaseEnabled: false, createClient: () => ({}) }));

import { RemoteSalesShell } from "../RemoteSalesShell";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Remote Sales shell — the bell", () => {
  it("a rep (not a manager) has the bell, with their unread count", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ notifications: [], unread: 2, total: 2 }) })));
    render(<RemoteSalesShell><p>page</p></RemoteSalesShell>);
    expect(await screen.findByRole("button", { name: "Notifications (2 unread)" })).toBeTruthy();
  });
});
