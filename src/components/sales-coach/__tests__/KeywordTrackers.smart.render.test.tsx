// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Smart trackers on the Trackers screen (0329): pick "Same idea, any words", write examples, save → the last calls are read. */
vi.mock("../TrackerAdoption", () => ({ TrackerAdoption: () => null }));
vi.mock("../AdoptionBoard", () => ({ AdoptionBoard: () => null }));
import { KeywordTrackers } from "../KeywordTrackers";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("KeywordTrackers — smart", () => {
  it("a manager adds a smart tracker from example sentences and is told its last calls are being read", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return json({ id: "t9", backfilling: 7 }, 201);
      }
      return json({ available: true, canManage: true, trackers: [{ id: "t1", name: "Locked in", phrases: ["We're locked into a contract"], side: "customer", active: true, kind: "smart" }] });
    }));
    render(<KeywordTrackers />);
    expect(await screen.findByText("Smart")).toBeTruthy();
    expect(screen.getByText(/“We're locked into a contract”/)).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: /Same idea, any words/ }));
    expect(screen.queryByRole("button", { name: /Preview on recent calls/ })).toBeNull();
    fireEvent.change(screen.getByPlaceholderText("e.g. Competitors"), { target: { value: "Call me later" } });
    fireEvent.change(screen.getByLabelText(/Example sentences/), { target: { value: "Can you call me next week\n\nI need to think about it" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tracker" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toMatch(/Reading your last 7 calls/));
    expect(posts).toEqual([{ name: "Call me later", phrases: ["Can you call me next week", "I need to think about it"], side: "any", kind: "smart", withinFirstMinutes: null, startsOn: null, endsOn: null, channels: null }]);
  });
});
