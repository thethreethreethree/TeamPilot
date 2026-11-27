// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/**
 * Engage → Agents (0379/0380/0382). Pinned: a manager can save a "close date is near" agent (no tracker needed — the
 * Save button once required one for every non-stage trigger), and it posts the trigger with its days.
 */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => true }));
import { RemoteEngage } from "../RemoteEngage";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Engage → Agents", () => {
  it("saves a close-date agent with its days", async () => {
    const posts: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: "a1" }));
      }
      const u = String(url);
      if (u.includes("/agents")) return new Response(JSON.stringify({ agents: [], runs: [] }));
      if (u.includes("/trackers")) return new Response(JSON.stringify({ trackers: [] }));
      if (u.includes("/prospects")) return new Response(JSON.stringify({ prospects: [] }));
      return new Response(JSON.stringify({ items: [], outcomes: [], flows: [], viewerId: "me" }));
    }));
    render(<RemoteEngage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Agents" }));
    fireEvent.click(await screen.findByRole("button", { name: /New agent/ }));
    fireEvent.change(screen.getByLabelText("Agent name"), { target: { value: "Close soon" } });
    fireEvent.click(screen.getByRole("button", { name: "A close date is near" }));
    fireEvent.change(screen.getByLabelText("Days before the close date"), { target: { value: "5" } });
    const save = screen.getByRole("button", { name: "Save agent" }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(posts.at(-1)).toMatchObject({ name: "Close soon", trigger: { kind: "close_date_near", days: 5 } }));
  });
});
