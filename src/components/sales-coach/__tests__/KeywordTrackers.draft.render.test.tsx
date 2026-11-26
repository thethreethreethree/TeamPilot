// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Draft trackers (0352, F11.4): save without switching on, see it marked Draft, put it live, or copy it into the form. */
vi.mock("../TrackerAdoption", () => ({ TrackerAdoption: () => null }));
vi.mock("../AdoptionBoard", () => ({ AdoptionBoard: () => null }));
import { KeywordTrackers } from "../KeywordTrackers";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const DRAFT = { id: "d1", name: "Disclosure", phrases: ["this call is recorded"], side: "rep", active: true, draft: true, kind: "keyword", within_first_seconds: 120 };

const setup = () => {
  const calls: Array<{ method: string; body: unknown }> = [];
  vi.stubGlobal("fetch", vi.fn((_u: string, init?: { method?: string; body?: string }) => {
    if (init?.method) {
      calls.push({ method: init.method, body: JSON.parse(init.body!) });
      return json(init.method === "PATCH" ? { id: "d1", draft: false, backfilling: 0 } : { id: "t9", draft: true }, init.method === "POST" ? 201 : 200);
    }
    return json({ available: true, canManage: true, trackers: [DRAFT] });
  }));
  render(<KeywordTrackers />);
  return calls;
};

describe("KeywordTrackers — drafts", () => {
  it("a draft is marked Draft and goes live from its row", async () => {
    const calls = setup();
    expect(await screen.findByText("Draft")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Go live" }));
    await waitFor(() => expect(calls).toContainEqual({ method: "PATCH", body: { id: "d1", action: "publish" } }));
    expect(await screen.findByText(/"Disclosure" is live/)).toBeTruthy();
  });

  it("Save as draft sends draft: true and says it isn't checked until live", async () => {
    const calls = setup();
    await screen.findByText("Draft");
    fireEvent.change(screen.getByPlaceholderText("e.g. Competitors"), { target: { value: "Price" } });
    fireEvent.change(screen.getByLabelText(/Words or phrases/), { target: { value: "price" } });
    fireEvent.click(screen.getByRole("button", { name: "Save as draft" }));
    await waitFor(() => expect(calls.find((c) => c.method === "POST")?.body).toMatchObject({ name: "Price", phrases: ["price"], draft: true }));
    expect(await screen.findByText(/Saved as a draft/)).toBeTruthy();
  });

  it("Copy to form fills the form with the draft's words, side and window (its own words never change)", async () => {
    setup();
    fireEvent.click(await screen.findByRole("button", { name: "Copy to form" }));
    expect((screen.getByPlaceholderText("e.g. Competitors") as HTMLInputElement).value).toBe("Disclosure");
    expect((screen.getByLabelText(/Words or phrases/) as HTMLTextAreaElement).value).toBe("this call is recorded");
    expect(screen.getByText(/Copied "Disclosure" into the form/)).toBeTruthy();
  });
});
