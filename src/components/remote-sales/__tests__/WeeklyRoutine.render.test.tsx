// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { WeeklyRoutine } from "../WeeklyRoutine";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("WeeklyRoutine", () => {
  it("shows each step with its count, and a failed source as 'couldn't check'", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("coaching-inbox")) return json({ items: [{ open: true }, { open: false }] });
      if (url.includes("disputes")) return json({ disputes: [] });
      if (url.includes("backfill")) return json({ error: "x" }, 500);
      return json({ assignments: [{ state: "overdue" }, { state: "due" }] });
    }));
    render(<WeeklyRoutine />);
    expect(await screen.findByText("1 rep is waiting for your feedback on a call.")).toBeTruthy();
    expect(screen.getByText("No open disputes.")).toBeTruthy();
    expect(screen.getByText("Couldn't check right now.")).toBeTruthy();
    expect(screen.getByText("1 assigned practice is past due.")).toBeTruthy();
    expect(screen.getByText("1 of 3 clear")).toBeTruthy();
  });
  it("renders nothing for a rep (every source says managers only)", async () => {
    const f = vi.fn(() => json({ error: "Managers only." }, 403));
    vi.stubGlobal("fetch", f);
    const { container } = render(<WeeklyRoutine />);
    await vi.waitFor(() => expect(f).toHaveBeenCalledTimes(4));
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });
});
