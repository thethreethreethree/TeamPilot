// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

/**
 * A course lesson's library call (0359): /library?scope=company&item=<id>&from=training opens the COMPANY tab, marks the
 * item, offers the way back to Training, and says plainly when the item isn't one this person may hear — or is older than
 * the newest shown. Only the newest load writes, so the "mine" answer can't land on the company tab.
 */
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
import LibraryPage from "../page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});
const item = (id: string) => ({ id, folderId: "f", folderName: "Best calls", sessionId: "s1", callLabel: `Call ${id}`, channel: "phone", repName: "Rae", addedByName: null, note: null, clip: null, audioUrl: null, canOpenCall: false, canRemove: false, approved: true, pitchId: null, addedAt: "2026-11-25T10:00:00Z" });
const stub = (byScope: Record<string, unknown>, delayMine = 0) => {
  const urls: string[] = [];
  vi.stubGlobal("fetch", vi.fn((u: string) => {
    urls.push(u);
    const scope = u.includes("scope=company") ? "company" : "mine";
    const body = byScope[scope];
    return new Promise((res) => setTimeout(() => res({ ok: true, json: () => Promise.resolve(body) }), scope === "mine" ? delayMine : 0));
  }));
  return urls;
};

describe("Library — opened from a course lesson", () => {
  it("opens the company tab on the item, with Back to Training; a late 'mine' answer doesn't replace it", async () => {
    window.history.replaceState(null, "", "/x?scope=company&item=i1&from=training");
    stub({ company: { available: true, isManager: false, items: [item("i1")], folders: [] }, mine: { available: true, isManager: false, items: [item("m9")], folders: [] } }, 30);
    render(<LibraryPage />);
    await screen.findByText("Call i1");
    expect(document.getElementById("library-item-i1")?.className).toContain("border-strong");
    expect(screen.getByRole("link", { name: "Back to Training" }).getAttribute("href")).toBe("/dashboard/remote-sales/training");
    await new Promise((r) => setTimeout(r, 60));
    expect(screen.queryByText("Call m9")).toBeNull();
    expect(screen.getByText("Call i1")).toBeTruthy();
  });
  it("says so when the item isn't there for this person, or is older than the newest shown", async () => {
    window.history.replaceState(null, "", "/x?scope=company&item=gone");
    stub({ company: { available: true, isManager: false, items: [item("i1")], folders: [] }, mine: { available: true, isManager: false, items: [], folders: [] } });
    render(<LibraryPage />);
    await screen.findByText(/isn't in the library for you/);
    cleanup();
    window.history.replaceState(null, "", "/x?scope=company&item=gone");
    stub({ company: { available: true, isManager: false, items: [item("i1")], folders: [], truncated: true }, mine: { available: true, isManager: false, items: [], folders: [] } });
    render(<LibraryPage />);
    await waitFor(() => expect(screen.getByText(/older than the newest ones shown/)).toBeTruthy());
  });
});
