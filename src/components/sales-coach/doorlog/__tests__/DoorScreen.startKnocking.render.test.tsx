// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

/**
 * "Start Knocking" at the bottom of the page a rep LANDS on (REV 1; founder, 2026-09-29: "match it on the
 * website"). DoorScreen has FOUR states and early-returns for three of them — so the button is pinned in
 * every one, not only the loaded screen. A day target that is loading, not yet rolled out or failed to
 * load is no reason to make a rep swipe before they can start a shift.
 */

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { DoorScreen } from "../DoorScreen";

const DATA = {
  localDate: "2026-09-29",
  repName: "Jordan Ellis",
  target: {
    doorsTarget: 80, presentationsTarget: 18, soldTarget: 2, usedStarter: false,
    salesGoal: 2, closeRatio: 0.11, contactRatio: 0.23, saleValueCents: 18_500,
  },
  today: { doors: 31, presentations: 7, sold: 1 },
};

const respond = (res: Partial<Response> | Promise<never>) =>
  vi.stubGlobal("fetch", vi.fn(() => (res instanceof Promise ? res : Promise.resolve(res))));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

/** Exactly one, and it opens the Door Log. */
async function expectOneStartKnocking() {
  const buttons = await screen.findAllByRole("button", { name: /Start Knocking/i });
  expect(buttons).toHaveLength(1);
  fireEvent.click(buttons[0]!);
  expect(push).toHaveBeenCalledWith("/dashboard/sales-coach/doors");
}

describe("DoorScreen — Start Knocking in every state", () => {
  it("loaded: it is the last control on the page", async () => {
    respond({ ok: true, status: 200, json: async () => DATA } as Partial<Response>);
    const { container } = render(<DoorScreen />);
    await screen.findByText(/Doors knocked/i);
    await expectOneStartKnocking();
    const all = Array.from(container.querySelectorAll("button"));
    expect(all.at(-1)?.textContent).toMatch(/Start Knocking/);
  });

  it("while the day target is still loading", async () => {
    respond(new Promise<never>(() => {})); // never resolves: the loading state stays on screen
    render(<DoorScreen />);
    await screen.findByText(/Loading your day/i);
    await expectOneStartKnocking();
  });

  it("when the day target failed to load", async () => {
    respond({ ok: false, status: 500, json: async () => ({}) } as Partial<Response>);
    render(<DoorScreen />);
    await screen.findByText(/Couldn.t load your numbers/i);
    await expectOneStartKnocking();
  });

  it("when the door screen is not rolled out yet", async () => {
    respond({ ok: false, status: 503, json: async () => ({}) } as Partial<Response>);
    render(<DoorScreen />);
    await screen.findByText(/isn.t available yet/i);
    await expectOneStartKnocking();
  });
});
