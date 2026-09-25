// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Sales Coach → Team, and its two DIALOGS.
 *
 * 18 of the 45 remaining white-alpha sites are in this tree: the page (3, in its section cards),
 * `AddAgentDialog` (5) and `TeamPasswordsDialog` (5). The dialogs carry the interesting ones —
 * `bg-base` inputs inside a `bg-surface` modal, each with a `border-white/10` edge. On cream that
 * is a near-white field with no border on a white sheet.
 *
 * The dialogs are rendered DIRECTLY rather than opened through the page, because each is gated on
 * an `open` prop the page only sets from a click, and a modal captured through its trigger is a
 * capture of the trigger. Same reason the live panel was mocked at its hook: photograph the thing,
 * not the path to it.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/team",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/toast";
import SalesCoachTeamPage from "@/app/dashboard/sales-coach/team/page";
import { AddAgentDialog } from "@/components/team/AddAgentDialog";
import { TeamPasswordsDialog } from "@/components/team/TeamPasswordsDialog";

const Wrap = ({ children }: { children: ReactNode }) => (
  <ThemeProvider>
    <ToastProvider>{children}</ToastProvider>
  </ThemeProvider>
);

/** `Member` at team/page.tsx:17-22. */
const MEMBERS = [
  { id: "m1", fullName: "Jordan Ellis", companyRole: "member", salesCoachRole: "admin" as const },
  { id: "m2", fullName: "Sam Ortiz", companyRole: "member", salesCoachRole: "staff" as const },
  { id: "m3", fullName: "Priya Raman", companyRole: "member", salesCoachRole: null },
  { id: "m4", fullName: null, companyRole: "member", salesCoachRole: null },
];

const serve = (over: { isManager?: boolean } = {}) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("sales-session/team"))
        return {
          ok: true,
          json: async () => ({
            isManager: over.isManager ?? true,
            members: MEMBERS,
            pendingInvites: [
              { id: "inv1", email: "newrep@example.com", createdAt: "2026-09-23T10:00:00.000Z" },
            ],
          }),
        };
      if (url.includes("/api/team")) return { ok: true, json: async () => ({ passwords: [] }) };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("team, a manager's roster", async () => {
    stubBrowserApis();
    serve();
    const { container } = render(
      <Wrap>
        <SalesCoachTeamPage />
      </Wrap>
    );
    // A member's name from the payload, not a heading — the chrome renders before the roster.
    await screen.findByText(/Priya Raman/i, undefined, { timeout: 8000 });
    capture("team", container, { width: 1180, height: 1400 });
  });

  it("team, the add-agent dialog", async () => {
    stubBrowserApis();
    serve();
    const { container } = render(
      <Wrap>
        <AddAgentDialog open onClose={() => {}} onAdded={() => {}} />
      </Wrap>
    );
    // A field label inside the modal, so the wait cannot be satisfied by the page behind it.
    await screen.findByText(/invite|email|name/i, undefined, { timeout: 8000 });
    capture("team-add-agent", container, { width: 900, height: 800 });
  });

  it("team, the passwords dialog", async () => {
    stubBrowserApis();
    serve();
    const { container } = render(
      <Wrap>
        <TeamPasswordsDialog open onClose={() => {}} />
      </Wrap>
    );
    // The dialog heading itself (:72). `/password/i` alone matched several nodes — the heading, the
    // field placeholder and the copy button title — which is a matcher that does not name a state.
    await screen.findByText(/^Team passwords$/i, undefined, { timeout: 8000 });
    capture("team-passwords", container, { width: 900, height: 800 });
  });
});
