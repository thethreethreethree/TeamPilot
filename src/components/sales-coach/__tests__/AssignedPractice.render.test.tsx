// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { AssignedPractice } from "../AssignedPractice";

/**
 * "Assigned to you" (Remote Sales → Training). Pinned 2026-11-23: lists assignments with their state; nothing assigned →
 * no panel; a failed read SAYS so — it used to hide the panel exactly like "nothing assigned", overdue practice included.
 */
const fetchMock = vi.fn();
const ITEM = { id: "a1", dueAt: "2026-11-20T00:00:00Z", state: "overdue", best: null, assignedByName: "Max", scenario: { title: "Price pushback", channel: "phone", difficulty: "intermediate", pass_score: 70 } };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("assigned practice", () => {
  it("lists what is assigned, overdue included", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ available: true, assignments: [ITEM] }) });
    render(<AssignedPractice />);
    expect(await screen.findByText("Price pushback")).toBeTruthy();
    expect(screen.getByText(/overdue/i)).toBeTruthy();
  });

  it("nothing assigned → no panel", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ available: true, assignments: [] }) });
    const { container } = render(<AssignedPractice />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
  });

  it("a failed read says so — never hidden like 'nothing assigned'", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<AssignedPractice />);
    expect(await screen.findByText(/couldn.t load the practice assigned to you/i)).toBeTruthy();
  });
});
