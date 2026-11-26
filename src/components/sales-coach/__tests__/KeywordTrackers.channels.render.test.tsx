// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Call types on a tracker (0361, F11.3): the form sends the chosen type; the list says "video calls only". */
vi.mock("../TrackerAdoption", () => ({ TrackerAdoption: () => null }));
vi.mock("../AdoptionBoard", () => ({ AdoptionBoard: () => null }));
import { KeywordTrackers } from "../KeywordTrackers";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("KeywordTrackers — call types", () => {
  it("sends the chosen call type and shows it on the list", async () => {
    const posts: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return json({ id: "t9" }, 201);
      }
      return json({ available: true, canManage: true, trackers: [{ id: "t1", name: "Screen share", phrases: ["share my screen"], side: "rep", active: true, kind: "keyword", channels: ["video"] }] });
    }));
    render(<KeywordTrackers />);
    expect(await screen.findByText(/video calls only/)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("e.g. Competitors"), { target: { value: "Dial-in" } });
    fireEvent.change(screen.getByLabelText(/Words or phrases/), { target: { value: "dial in number" } });
    fireEvent.change(screen.getByLabelText("Call types"), { target: { value: "phone" } });
    fireEvent.click(screen.getByRole("button", { name: "Add tracker" }));
    await waitFor(() => expect(posts[0]).toMatchObject({ name: "Dial-in", channels: ["phone"] }));
  });
});
