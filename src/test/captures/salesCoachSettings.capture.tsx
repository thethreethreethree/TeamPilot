// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Sales Coach → Settings. 1060 lines, nine white-alpha sites, and the screen a manager uses to
 * make the coach reason from THEIR methodology instead of generic sales books — so the most likely
 * of the remaining routes to appear in a demo.
 *
 * TWO TABS, and the second only exists for managers (`tab === "coaching" && isManager`). Both are
 * captured, because a capture of one branch is not a capture of the file — a lesson this session
 * has now learned four times: After Pitch (Standard/Expert), Sessions (three branches), Analytics
 * (the ELO gauge lives only in Expert).
 *
 * The Coaching tab mounts seven panels reading eight endpoints between them. Each is answered
 * explicitly; a catch-all `{}` has manufactured three phantom crashes in this session.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/settings",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/experience/ExperienceModeProvider", () => ({
  useExperienceMode: () => ({ isStandard: true, isExpert: false, loaded: true }),
}));

import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { ToastProvider } from "@/components/ui/toast";
import SalesCoachSettingsPage from "@/app/dashboard/sales-coach/settings/page";

/**
 * The page must be rendered INSIDE ThemeProvider. `LearningModePanel` calls `useTheme()`, which
 * throws by design outside a provider ("Throwing here surfaces the bug at the call site",
 * ThemeProvider.tsx:246-248) — and a throw during render unmounts the tree, so the capture's
 * container came back as a single empty <div>.
 *
 * ToastProvider is needed for the same reason — a manager panel calls `useToast`, which throws
 * "Mount it once at the layout root".
 *
 * Both are HARNESS gaps and not defects: `layout.tsx:144` and `:8` mount both providers around the
 * whole app. Each was checked before it was worked around, because "the page renders nothing" is
 * exactly what a real crash looks like too — and on a 1060-line settings page reached only by a
 * manager, a real one could sit there a long time.
 */
const Page = () => (
  <ThemeProvider>
    <ToastProvider>
      <SalesCoachSettingsPage />
    </ToastProvider>
  </ThemeProvider>
);

/** `SettingsCtx` at settings/page.tsx:32-41. */
const CTX = {
  account: { fullName: "Jordan Ellis", companyRole: "member", salesCoachRole: "admin" },
  isManager: true,
  corpus: { loaded: true, words: 1840 },
};

/** `CorpusData` at :228 — `effectiveSource: "custom"` is the state a set-up company is in. */
const CORPUS = {
  content:
    "We sell the street, not the product. Lead with what the crew is doing on this block, then earn the second sentence.\n\nNever answer an objection with a fact. Name the worry underneath it first, out loud, and let them correct you.",
  isCustom: true,
  updatedAt: "2026-09-18T14:20:00.000Z",
  updatedByName: "Jordan Ellis",
  effectiveSource: "custom" as const,
};

/** `ProductData` at :423. */
const PRODUCT = {
  content:
    "Symmetrical fiber, 1 Gbps up and down. No data cap, no contract, no install fee on a block we have already trenched.",
  isSet: true,
  updatedAt: "2026-09-18T14:25:00.000Z",
  updatedByName: "Jordan Ellis",
};

const serve = () =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("sales-session/settings")) return { ok: true, json: async () => CTX };
      if (url.includes("sales-session/corpus")) return { ok: true, json: async () => CORPUS };
      if (url.includes("sales-session/product")) return { ok: true, json: async () => PRODUCT };
      if (url.includes("sales-session/quota"))
        return { ok: true, json: async () => ({ target: 20, setByName: "Jordan Ellis", updatedAt: null }) };
      if (url.includes("doorlog/rep-goal"))
        return { ok: true, json: async () => ({ goals: [], salesGoal: 2, saleValueCents: null }) };
      if (url.includes("sales-session/team"))
        return {
          ok: true,
          json: async () => ({
            isManager: true,
            members: [
              { id: "m1", fullName: "Jordan Ellis", companyRole: "member", salesCoachRole: "admin" },
              { id: "m2", fullName: "Sam Ortiz", companyRole: "member", salesCoachRole: "staff" },
            ],
            pendingInvites: [],
          }),
        };
      if (url.includes("voice-enrollment"))
        return { ok: true, json: async () => ({ enrolled: false, pitchHz: null }) };
      if (url.includes("voice-health"))
        return { ok: true, json: async () => ({ enrolledCount: 1, totalReps: 2, recent: [] }) };
      if (url.includes("capture-health"))
        return { ok: true, json: async () => ({ sessions: 24, oneSided: 3, noAudio: 1, recent: [] }) };
      if (url.includes("sales-session/voice") || url.includes("sales-session/tts"))
        return { ok: true, json: async () => ({ voice: "alloy", voices: [] }) };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("settings, the account tab", async () => {
    stubBrowserApis();
    serve();
    const { container } = render(<Page />);
    // The rep's own name from the ctx payload — the page chrome and the tab strip both render
    // before this arrives.
    await screen.findByText(/Jordan Ellis/i, undefined, { timeout: 8000 });
    capture("settings-account", container, { width: 1180, height: 1200 });
  });

  it("settings, the manager coaching tab", async () => {
    stubBrowserApis();
    serve();
    const { container } = render(<Page />);
    fireEvent.click(await screen.findByText(/^Coaching$/i, undefined, { timeout: 8000 }));
    // A sentence from the company's own methodology — proves the corpus editor populated, not just
    // that the tab switched.
    await screen.findByText(/sell the street/i, undefined, { timeout: 8000 });
    capture("settings-coaching", container, { width: 1180, height: 2600 });
  });
});
