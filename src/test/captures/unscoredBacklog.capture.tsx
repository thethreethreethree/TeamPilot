// @vitest-environment jsdom
import { describe, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";
import { UnscoredBacklog } from "@/components/sales-coach/UnscoredBacklog";

/**
 * The panel that tells a manager why their dashboards are empty, and drains the backlog.
 *
 * Captured because I built it earlier today and looked at it in DARK ONLY before shipping — on the
 * same afternoon I found three controls that were invisible on cream. Its amber-tinted card
 * (`border-ember-400/40`, `bg-ember-400/[0.06]`) has never been seen on a light ground.
 *
 * The button on it spends money per recording. A call-to-action a manager cannot read, or an
 * amber wash that disappears into cream and takes the panel's urgency with it, is not a cosmetic
 * problem on this particular surface.
 */

beforeEach(() => {
  vi.clearAllMocks();
});

describe("capture", () => {
  it("unscored backlog, 142 waiting", async () => {
    stubBrowserApis();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => ({ unscored: 142 }) }))
    );

    const { container } = render(<UnscoredBacklog />);
    await screen.findByText(/never been scored/i);

    capture("unscored-backlog", container.firstElementChild as HTMLElement, {
      width: 1000,
      height: 160,
    });
  });
});
