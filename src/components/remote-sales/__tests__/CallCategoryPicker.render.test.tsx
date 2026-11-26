// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** The call's category on its page (F10.10): the rep picks from the list; others see it; nothing when no list. */
import { CallCategoryPicker } from "../CallCategoryPicker";
const ok = (body: unknown) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const LIST = { available: true, categories: [{ id: "c1", name: "Discovery" }, { id: "c2", name: "Demo" }] };

describe("CallCategoryPicker", () => {
  it("the rep picks; the pick is saved", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return ok({ ok: true });
      }
      return ok(u.includes("call-categories") ? LIST : { available: true, category: null, canPick: true });
    }));
    render(<CallCategoryPicker sessionId="s1" />);
    fireEvent.change(await screen.findByLabelText("Call category", { selector: "select" }), { target: { value: "c2" } });
    await waitFor(() => expect(posts).toEqual([{ categoryId: "c2" }]));
  });
  it("a manager sees the category; with no list and no pick it renders nothing", async () => {
    vi.stubGlobal("fetch", vi.fn((u: string) => ok(u.includes("call-categories") ? LIST : { available: true, category: { id: "c1", name: "Discovery" }, canPick: false })));
    render(<CallCategoryPicker sessionId="s1" />);
    expect(await screen.findByText("Discovery")).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    cleanup();
    vi.stubGlobal("fetch", vi.fn((u: string) => ok(u.includes("call-categories") ? { available: true, categories: [] } : { available: true, category: null, canPick: true })));
    const { container } = render(<CallCategoryPicker sessionId="s1" />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
});
