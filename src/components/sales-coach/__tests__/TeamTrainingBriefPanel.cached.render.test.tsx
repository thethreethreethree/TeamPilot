// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { TeamTrainingBriefPanel } from "../TeamTrainingBriefPanel";

/** Pinned 2026-11-23: a failed read of the overnight brief is said — not shown as "no brief" (inviting a paid rebuild). */
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("team training brief — the overnight brief", () => {
  it("a failed read says so", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<TeamTrainingBriefPanel />);
    expect(await screen.findByText(/couldn.t load the brief prepared overnight/i)).toBeTruthy();
  });

  it("no brief yet (a real none) says nothing extra", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ cached: null }) });
    render(<TeamTrainingBriefPanel />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText(/couldn.t load/i)).toBeNull();
  });
});
