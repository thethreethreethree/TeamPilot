// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { RemoteToday } from "../RemoteToday";

/**
 * Remote Sales → Today (Macro Mode). Pinned 2026-11-23: a rep with a plan sees it; the blank "Plan my day" form shows
 * ONLY once the day has loaded with no plan — never while loading or after a failed load, where saving it would replace
 * a plan the rep already made.
 */
const DAY = (plan: unknown) => ({
  plan,
  yesterday: { calls: 2, scored: 1, averageScore: 64, outcomes: {} },
  today: { calls: [], todos: [] },
});
const PLAN = { dump: "Call John at 9", items: [{ time: "9:00", what: "Call John" }], needleMovers: ["Close Michelle"], createdAt: "2026-11-23T01:00:00Z" };

const fetchMock = vi.fn();
const respond = (day: unknown) =>
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/api/coach/remote/day")) return day === "FAIL" ? { ok: false, json: async () => ({}) } : day === "HANG" ? new Promise(() => {}) : { ok: true, json: async () => day };
    return { ok: true, json: async () => ({ fullName: "Pat Rep" }) };
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

const form = () => screen.queryByRole("button", { name: /plan my day/i });

describe("Today", () => {
  it("shows the rep's plan, with their needle movers", async () => {
    respond(DAY(PLAN));
    render(<RemoteToday />);
    expect(await screen.findByText("Close Michelle")).toBeTruthy();
    expect(screen.getByText("Call John")).toBeTruthy();
    expect(form()).toBeNull();
  });

  it("offers the form once the day has loaded with no plan", async () => {
    respond(DAY(null));
    render(<RemoteToday />);
    expect(await screen.findByRole("button", { name: /plan my day/i })).toBeTruthy();
  });

  it("while loading, no blank form", async () => {
    respond("HANG");
    render(<RemoteToday />);
    expect(await screen.findByText(/loading your day/i)).toBeTruthy();
    expect(form()).toBeNull();
  });

  it("after a failed load, says so — no blank form that would replace an existing plan", async () => {
    respond("FAIL");
    render(<RemoteToday />);
    expect(await screen.findByText(/couldn.t load your plan for today/i)).toBeTruthy();
    expect(form()).toBeNull();
  });
});
