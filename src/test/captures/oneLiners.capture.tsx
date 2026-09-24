// @vitest-environment jsdom
import { describe, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { capture, stubBrowserApis } from "@/test/visual";

/**
 * One Liners (route: /strategy) — the THIRTEENTH and last Sales Coach surface.
 *
 * It is here because of what a grep says about it: `strategy/page.tsx` contains ZERO
 * white-at-low-alpha values, and it is a confirmed member of the class that emptied every card on
 * cream. It inherits all of it from `<DeckCard>` and `<DeckPill>`. A file can be a member of a
 * defect class and carry no evidence of it, which is the whole argument for rendering rather than
 * sweeping.
 *
 * `LearningHint as="block"` WRAPS the content of both sections. Mocking it to null — as the other
 * captures do — would delete most of this page and photograph the gaps. It is mocked to render its
 * children instead.
 */

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/dashboard/sales-coach/strategy",
}));
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
vi.mock("@/components/learning/LearningHint", () => ({
  LearningHint: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

import SalesCoachStrategyPage from "@/app/dashboard/sales-coach/strategy/page";

/** `Data` at strategy/page.tsx:35-40. `outcome` is the v5 vocabulary `outcomeLabel` consumes. */
const FULL = {
  methodology:
    "We sell the street, not the product. Lead with what the crew is doing on this block, then earn the second sentence.\n\nNever answer an objection with a fact. Name the worry underneath it first, out loud, and let them correct you.",
  product:
    "Symmetrical fiber, 1 Gbps up and down. No data cap, no contract, no install fee on a block we have already trenched.",
  booksGrounded: true,
  correctLines: [
    {
      correctLine:
        "Who are you with now? I ask because the crew's already pulled fiber to this block, and that changes the price.",
      whyItWorks:
        "The reason turns a survey question into a relevant one, and it plants the thing only you can offer.",
      context: "Discovery",
      sessionLabel: "Maple Ct · Sep 20",
      outcome: "follow_up",
    },
    {
      correctLine: "That's fair — most people here said the same before they saw the upload speed.",
      whyItWorks:
        "Agreeing first removes the argument, and the specific detail gives them a reason to stay another ten seconds.",
      context: "Objection",
      sessionLabel: "Birch Row · Sep 18",
      outcome: "sold",
    },
  ],
};

const EMPTY = { methodology: null, product: null, booksGrounded: false, correctLines: [] };

const serve = (body: unknown) =>
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      // Explicit, not a catch-all. A catch-all `{}` here would set `data` to an object with no
      // `correctLines`, and `data.correctLines.length` would throw — a crash this page cannot
      // actually have, manufactured by the stub. That mistake has cost three phantoms today.
      if (url.includes("strategy-library")) return { ok: true, json: async () => body };
      return { ok: true, json: async () => ({}) };
    })
  );

describe("capture", () => {
  it("one liners, a rep with saved lines", async () => {
    stubBrowserApis();
    serve(FULL);
    const { container } = render(<SalesCoachStrategyPage />);
    await screen.findByText(/pulled fiber to this block/i, undefined, { timeout: 8000 });
    capture("one-liners", container, { width: 900, height: 1000 });
  });

  it("one liners, nothing saved yet", async () => {
    stubBrowserApis();
    serve(EMPTY);
    const { container } = render(<SalesCoachStrategyPage />);
    // Wait on the EMPTY-state sentence specifically, not on a word the populated state also
    // contains — the inverse of the Analytics matcher that was green while the page was blank.
    await screen.findByText(/No correct lines yet/i, undefined, { timeout: 8000 });
    capture("one-liners-empty", container, { width: 900, height: 600 });
  });

  /**
   * The error state, captured rather than assumed. Its `text-amber-300` was the one page-local
   * member of today's class in this file — every other defect here was inherited from the kit.
   * A 500 is the state a rep sees when the library route is down, and it is the only red text
   * on the page.
   */
  it("one liners, the route is down", async () => {
    stubBrowserApis();
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })));
    const { container } = render(<SalesCoachStrategyPage />);
    await screen.findByText(/HTTP 500/i, undefined, { timeout: 8000 });
    capture("one-liners-error", container, { width: 900, height: 400 });
  });
});
