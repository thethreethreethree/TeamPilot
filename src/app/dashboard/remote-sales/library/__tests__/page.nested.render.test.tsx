// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Nested folders on the Library page (0353, F12.6): headed by path, a folder's subfolders after it, and a folder inside an archived one is hidden, not offered. */
vi.mock("@/components/layout/TopBar", () => ({ default: () => null }));
import LibraryPage from "../page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const item = (id: string, folderId: string, folderName: string) => ({ id, folderId, folderName, sessionId: "s1", callLabel: `Call ${id}`, channel: "phone", repName: "Rae", addedByName: null, note: null, clip: null, audioUrl: null, canOpenCall: true, canRemove: true, approved: null, pitchId: null, addedAt: "2026-11-25T10:00:00Z" });

describe("Library — nested folders", () => {
  it("groups by path with subfolders after their parent; a folder inside an archived one isn't listed as empty", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        available: true,
        isManager: false,
        items: [item("i2", "b", "Objections / Pricing"), item("i3", "z", "Zebra"), item("i1", "a", "Objections")],
        folders: [
          { id: "a", name: "Objections", parentId: null, archived: false, insideArchived: false, canArchive: true },
          { id: "b", name: "Objections / Pricing", parentId: "a", archived: false, insideArchived: false, canArchive: true },
          { id: "z", name: "Zebra", parentId: null, archived: false, insideArchived: false, canArchive: true },
          { id: "o", name: "Old", parentId: null, archived: true, insideArchived: false, canArchive: true },
          { id: "o2", name: "Old / Inner", parentId: "o", archived: false, insideArchived: true, canArchive: true },
        ],
      }),
    })));
    render(<LibraryPage />);
    await screen.findByText("Call i1");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Objections", "Objections / Pricing", "Zebra"]);
    expect(screen.queryByText(/Empty folders/)).toBeNull(); // "Old / Inner" is hidden with "Old", not an empty folder
    expect(screen.getByText(/Archived folders \(1\)/)).toBeTruthy();
  });

  it("a folder archived inside an archived folder says to restore its parent first, with no dead Restore", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        available: true, isManager: false, items: [item("i1", "a", "Objections")],
        folders: [
          { id: "a", name: "Objections", parentId: null, archived: false, insideArchived: false, canArchive: true },
          { id: "o", name: "Old", parentId: null, archived: true, insideArchived: false, canArchive: true },
          { id: "o2", name: "Old / Inner", parentId: "o", archived: true, insideArchived: true, canArchive: true },
        ],
      }),
    })));
    render(<LibraryPage />);
    await screen.findByText("Call i1");
    expect(screen.getByRole("button", { name: "Restore folder Old" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Restore folder Old / Inner" })).toBeNull();
    expect(screen.getByText("Restore the folder it's in first")).toBeTruthy();
  });

  it("F13.10: a folder of calls you can open offers Ask the coach, sending that folder's calls; one you can't doesn't", async () => {
    const posts: unknown[] = [];
    const locked = { ...item("i9", "z", "Zebra"), sessionId: "s9", canOpenCall: false };
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push({ url, body: JSON.parse(init.body ?? "{}") });
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ answer: "They all stall on price.", citations: [] }) });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          available: true, isManager: false,
          items: [item("i1", "a", "Objections"), { ...item("i2", "a", "Objections"), sessionId: "s2" }, locked],
          folders: [
            { id: "a", name: "Objections", parentId: null, archived: false, insideArchived: false, canArchive: true },
            { id: "z", name: "Zebra", parentId: null, archived: false, insideArchived: false, canArchive: true },
          ],
        }),
      });
    }));
    render(<LibraryPage />);
    await screen.findByText("Call i1");
    expect(screen.queryByRole("form", { name: "Ask about Zebra" })).toBeNull();
    const form = screen.getByRole("form", { name: "Ask about Objections" });
    fireEvent.change(form.querySelector("input")!, { target: { value: "What do these have in common?" } });
    fireEvent.submit(form);
    await waitFor(() => expect(posts).toEqual([{ url: "/api/coach/remote/ask", body: { question: "What do these have in common?", sessionIds: ["s1", "s2"] } }]));
    expect(await screen.findByText(/They all stall on price/)).toBeTruthy();
  });
});

