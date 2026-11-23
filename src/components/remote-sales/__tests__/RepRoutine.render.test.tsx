// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RepRoutine } from "../RepRoutine";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RepRoutine", () => {
  it("shows the rep's practice, answers and notes, linking the answered call", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => {
      if (url.includes("assignments")) return json({ available: true, assignments: [{ state: "due" }, { state: "passed" }, { state: "overdue" }] });
      return json({ answers: { answered: 1, waiting: 0, newestSessionId: "s9" }, notes: { without: 0, newestSessionId: null } });
    }));
    render(<RepRoutine />);
    expect(await screen.findByText("2 practices are still due.")).toBeTruthy();
    expect(screen.getByText("1 request was answered this week.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Read the feedback you asked for" }).getAttribute("href")).toBe("/dashboard/remote-sales/calls/s9");
    expect(screen.getByText("Every call this week has a note.")).toBeTruthy();
    expect(screen.getByText("1 of 3 clear")).toBeTruthy();
  });
  it("a failed source reads 'couldn't check', not clear", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.includes("assignments") ? json({ error: "x" }, 500) : json({ answers: null, notes: { without: 2, newestSessionId: "c1" } }))));
    render(<RepRoutine />);
    expect(await screen.findByText("2 calls this week have no note from you.")).toBeTruthy();
    expect(screen.getAllByText("Couldn't check right now.")).toHaveLength(2);
    expect(screen.getByText("0 of 1 clear")).toBeTruthy();
  });
});
