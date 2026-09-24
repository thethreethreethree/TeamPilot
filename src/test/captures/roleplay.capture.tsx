// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * Roleplay Practice — the twelfth of thirteen Sales Coach surfaces to be rendered.
 *
 * Three phases, all three captured, because they are three different surfaces sharing a route:
 * SETUP is a form, CHAT is a messenger, REVIEW is a report. A capture of one says nothing about
 * the other two.
 *
 * Getting into CHAT without a network round-trip: the page's own in-progress recovery
 * (`sc-roleplay-inprogress` in sessionStorage, roleplay/page.tsx:96-126) restores messages and
 * sets phase to "chat" on mount. That is the product's real resume path, not a test hook.
 *
 * REVIEW is reached by pressing the page's own "End & review" button against a stubbed route
 * reply — the same way a rep reaches it.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/roleplay",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));

import SalesCoachRoleplayPage from "@/app/dashboard/sales-coach/roleplay/page";

const STORAGE_KEY = "sc-roleplay-inprogress";

/**
 * A real half of a doorstep conversation. The rep's lines render as ember bubbles on the right,
 * the prospect's as the other treatment on the left — which is the pair this capture exists to
 * compare.
 */
const MESSAGES = [
  { role: "rep" as const, text: "Morning — I'm with the fiber crew that's been on Maple this week." },
  { role: "prospect" as const, text: "I've already got internet and I'm late for something." },
  { role: "rep" as const, text: "Totally fair. Who are you with right now?" },
  { role: "prospect" as const, text: "Spectrum. It's fine. Why?" },
];

const REVIEW = {
  summary:
    "You opened with the crew on the street, which earned you the second sentence. You then asked who they were with and stopped — good. You never named a reason for the question.",
  whatWorked: [
    "Led with something visible and local instead of the company name.",
    "Took the brush-off without arguing with it.",
  ],
  toImprove: [
    "You asked the incumbent question with no reason attached, so it read as a survey.",
    "No ask at the end — the conversation just stopped.",
  ],
  correctLine: {
    line: "Who are you with now? I ask because the crew's already pulled fiber to this block, and that changes the price.",
    why: "The reason turns a survey question into a relevant one, and it plants the thing only you can offer.",
  },
};

describe("capture", () => {
  it("roleplay setup, choosing a prospect", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    sessionStorage.clear();
    const { container } = render(<SalesCoachRoleplayPage />);
    await screen.findByText(/Skeptical & guarded/i, undefined, { timeout: 8000 });
    capture("roleplay-setup", container, { width: 900, height: 900 });
  });

  it("roleplay chat, mid-conversation", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ context: "in_person", persona: "Busy & rushed", messages: MESSAGES })
    );
    const { container } = render(<SalesCoachRoleplayPage />);
    // Wait on a PROSPECT line: the left-hand bubble is the half of the conversation under
    // examination, and waiting on the rep's line would go green with the other side missing.
    await screen.findByText(/already got internet/i, undefined, { timeout: 8000 });
    capture("roleplay-chat", container, { width: 900, height: 620 });
  });

  it("roleplay review, after the practice ends", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ review: REVIEW }) }))
    );
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ context: "in_person", persona: "Busy & rushed", messages: MESSAGES })
    );
    const { container } = render(<SalesCoachRoleplayPage />);
    fireEvent.click(await screen.findByText(/End & review/i, undefined, { timeout: 8000 }));
    await screen.findAllByText(/read as a survey/i, undefined, { timeout: 8000 });
    capture("roleplay-review", container, { width: 900, height: 1000 });
  });

  /**
   * The composer with something TYPED in it. The empty state shows only the placeholder, which is
   * `text-muted` — the one token that resolves identically in both themes, so the empty composer
   * looks fine on both and says nothing about the state that matters: can the rep read their own
   * sentence back?
   */
  it("roleplay composer, a line typed", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ context: "in_person", persona: "Busy & rushed", messages: MESSAGES })
    );
    const { container } = render(<SalesCoachRoleplayPage />);
    const box = await screen.findByLabelText(/Your line to the prospect/i, undefined, {
      timeout: 8000,
    });
    fireEvent.change(box, { target: { value: "Who are you with now? I ask because—" } });
    capture("roleplay-composer", container, { width: 900, height: 620 });
  });
});
