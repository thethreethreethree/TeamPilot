// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Course editor autosave (F17.1, 2026-11-26): an unsaved draft survives a reload in this browser; saving clears it. */
import { CourseManager } from "../CourseManager";

const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
const stub = () =>
  vi.stubGlobal("fetch", vi.fn((u: string, init?: { method?: string }) => {
    if (init?.method === "POST") return ok({ id: "k1", version: 1 });
    if (u.startsWith("/api/coach/remote/course-assignments")) return ok({ assignments: [] });
    if (u === "/api/coach/remote/assignable-reps") return ok({ members: [] });
    if (u.startsWith("/api/coach/remote/scenarios") || u.startsWith("/api/coach/remote/library")) return ok({ scenarios: [], items: [] });
    return ok({ available: true, courses: [] });
  }));
beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("CourseManager — autosave", () => {
  it("a half-written course comes back after a reload; Start over drops it; saving clears it", async () => {
    stub();
    render(<CourseManager />);
    fireEvent.click(await screen.findByRole("button", { name: "New course" }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Objection handling" } });
    await waitFor(() => expect(window.localStorage.getItem("teampilot:course-draft:new")).toContain("Objection handling"), { timeout: 2000 });
    cleanup();

    stub();
    render(<CourseManager />);
    fireEvent.click(await screen.findByRole("button", { name: "New course" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Objection handling");
    expect(screen.getByText(/Picked up your unsaved changes/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Start over" }));
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("");

    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Discovery" } });
    fireEvent.change(screen.getByLabelText("Lesson 1 title"), { target: { value: "Open" } });
    fireEvent.change(screen.getByLabelText("Lesson 1 text"), { target: { value: "Ask first" } });
    fireEvent.click(screen.getByRole("button", { name: "Save course" }));
    await waitFor(() => expect(window.localStorage.getItem("teampilot:course-draft:new")).toBeNull(), { timeout: 2000 });
  });
});
