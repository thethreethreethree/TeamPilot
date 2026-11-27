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
      if (u.includes("/on-demand-agents")) return new Response(JSON.stringify({ agents: [] }));
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
  it("a template (E8) fills the editor and saves nothing until Save; what's saved is what was shown", async () => {
    const posts: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: "a1" }));
      }
      const u = String(url);
      if (u.includes("/on-demand-agents")) return new Response(JSON.stringify({ agents: [] }));
      if (u.includes("/agents")) return new Response(JSON.stringify({ agents: [{ id: "q1", name: "Quiet", trigger: { kind: "deal_gone_quiet" }, actions: [{ kind: "notify", to: "rep" }], enabled: true }], runs: [] }));
      if (u.includes("/trackers")) return new Response(JSON.stringify({ trackers: [] }));
      if (u.includes("/prospects")) return new Response(JSON.stringify({ prospects: [] }));
      return new Response(JSON.stringify({ items: [], outcomes: [], flows: [], viewerId: "me" }));
    }));
    render(<RemoteEngage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Agents" }));
    expect(await screen.findByText(/When an open deal goes quiet — no call in 21 days/)).toBeTruthy();
    fireEvent.click(await screen.findByRole("button", { name: "Gone quiet" }));
    expect((screen.getByLabelText("Agent name") as HTMLInputElement).value).toBe("Gone quiet");
    expect(screen.getByRole("button", { name: "A deal goes quiet" }).getAttribute("aria-pressed")).toBe("true");
    expect(posts).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Save agent" }));
    await waitFor(() => expect(posts.at(-1)).toMatchObject({ name: "Gone quiet", trigger: { kind: "deal_gone_quiet" }, actions: [{ kind: "notify", to: "rep" }, { kind: "todo", due_days: 1 }] }));
  });
  it("on-demand agents (E9): a manager adds one; retiring asks first", async () => {
    const posts: Array<Record<string, unknown>> = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify({ id: "n1", ok: true }));
      }
      const u = String(url);
      if (u.includes("/on-demand-agents")) return new Response(JSON.stringify({ agents: [{ id: "o1", name: "Risks raised", instruction: "List every risk the customer raised." }] }));
      if (u.includes("/agents")) return new Response(JSON.stringify({ agents: [], runs: [] }));
      if (u.includes("/trackers")) return new Response(JSON.stringify({ trackers: [] }));
      if (u.includes("/prospects")) return new Response(JSON.stringify({ prospects: [] }));
      return new Response(JSON.stringify({ items: [], outcomes: [], flows: [], viewerId: "me" }));
    }));
    render(<RemoteEngage />);
    fireEvent.click(await screen.findByRole("tab", { name: "Agents" }));
    expect(await screen.findByText("Risks raised")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("On-demand agent name"), { target: { value: "Next steps" } });
    fireEvent.change(screen.getByLabelText("Instruction"), { target: { value: "List what each side agreed to do next." } });
    fireEvent.click(screen.getByRole("button", { name: "Add on-demand agent" }));
    await waitFor(() => expect(posts.at(-1)).toEqual({ name: "Next steps", instruction: "List what each side agreed to do next." }));
    fireEvent.click(screen.getByRole("button", { name: "Retire…" }));
    const n = posts.length;
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(posts.length).toBe(n);
    fireEvent.click(screen.getByRole("button", { name: "Retire…" }));
    fireEvent.click(screen.getByRole("button", { name: "Retire" }));
    await waitFor(() => expect(posts.at(-1)).toEqual({ retire: "o1" }));
  });
});
