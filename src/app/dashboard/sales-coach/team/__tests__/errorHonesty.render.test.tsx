// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";

/**
 * Honesty guard for the Sales-Coach Team page (audit 2026-08-18, founder-directed sweep). A failed /team fetch
 * previously ran `else { setMembers([]) }`, and since isManager also stays false on failure, a real admin saw
 * EITHER "Team management is admin-only" (told they lost access) OR "No members found" (roster vanished) — an
 * error dressed as no-data / a demotion (INV22). This locks the fix: on failure the page shows an honest
 * "couldn't load your team" that takes precedence over the admin gate and the empty state; on success the roster
 * renders.
 */

vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: vi.fn(), error: vi.fn() }) }));
vi.mock("@/components/team/InviteMemberDialog", () => ({ InviteMemberDialog: () => null }));

import TeamPage from "../page";

function stubFetch(ok: boolean) {
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn(), addListener: vi.fn(), removeListener: vi.fn() })));
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      ok
        ? { ok: true, status: 200, json: async () => ({ isManager: true, members: [{ id: "1", fullName: "Rep Alpha", companyRole: "member", salesCoachRole: "staff" }], pendingInvites: [] }) }
        : { ok: false, status: 500, json: async () => ({}) },
    ),
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Team — a fetch error is neither an empty roster nor a demotion (founder 2026-08-18)", () => {
  it("fetch fails: honest 'couldn't load your team', NOT the admin-only gate or 'No members found'", async () => {
    stubFetch(false);
    render(<TeamPage />);
    await waitFor(() => expect(screen.getByText(/Couldn't load your team/i)).toBeTruthy());
    expect(screen.queryByText(/admin-only/i)).toBeNull();
    expect(screen.queryByText(/No members found/i)).toBeNull();
  });

  it("fetch succeeds (manager): the roster renders", async () => {
    stubFetch(true);
    render(<TeamPage />);
    await waitFor(() => expect(screen.getByText("Rep Alpha")).toBeTruthy());
    expect(screen.queryByText(/Couldn't load your team/i)).toBeNull();
  });
});
