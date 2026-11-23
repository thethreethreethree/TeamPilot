// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { TopicGroups } from "../TopicGroups";

const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TopicGroups", () => {
  it("renders nothing for someone who can't manage groups", async () => {
    const f = vi.fn(() => json({ canManage: false, groups: [] }));
    vi.stubGlobal("fetch", f);
    const { container } = render(<TopicGroups module="remote_sales" onChanged={() => {}} />);
    await waitFor(() => expect(f).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.innerHTML).toBe("");
  });
  it("suggest → untick a topic → accept saves only the kept topics, keeps the other suggestion, and recounts", async () => {
    const posts: Array<{ url: string; body: unknown }> = [];
    let groups: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (url.endsWith("/suggest")) return json({ offered: 5, suggestions: [{ name: "Price", members: ["pricing", "monthly price", "price increase"], counts: [54, 10, 14] }, { name: "TV", members: ["hbo", "hbo add-on"], counts: [21, 13] }] });
      if (init?.method === "POST") {
        posts.push({ url, body: JSON.parse(init.body!) });
        groups = [{ id: "g1", name: "Price", members: ["pricing", "monthly price"], source: "ai_suggested" }];
        return json({ group: { id: "g1" } });
      }
      return json({ canManage: true, groups });
    }));
    const changed = vi.fn();
    render(<TopicGroups module="remote_sales" onChanged={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: /Suggest groups/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /price increase/ }));
    fireEvent.click(screen.getAllByRole("button", { name: "Accept" })[0]!);
    await waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    expect(posts).toEqual([{ url: "/api/coach/remote/market/topic-groups", body: { module: "remote_sales", name: "Price", members: ["pricing", "monthly price"], source: "ai_suggested" } }]);
    expect(await screen.findByText("= pricing, monthly price")).toBeTruthy();
    expect(screen.getByDisplayValue("TV")).toBeTruthy(); // the other suggestion is still there
  });
  it("accept is off until at least two topics are kept", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => (url.endsWith("/suggest") ? json({ suggestions: [{ name: "TV", members: ["hbo", "hbo add-on"], counts: [21, 13] }] }) : json({ canManage: true, groups: [] }))));
    render(<TopicGroups module="remote_sales" onChanged={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /Suggest groups/ }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /hbo add-on/ }));
    expect((screen.getByRole("button", { name: "Accept" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Keep at least two topics.")).toBeTruthy();
  });
});
