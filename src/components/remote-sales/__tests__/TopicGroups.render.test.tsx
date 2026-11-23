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

  it("Make a group: pick topics from the server's list and save as the manager's own", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return json({ group: { id: "g9" } });
      }
      if (url.includes("candidates=1")) return json({ canManage: true, groups: [], candidates: [{ name: "pricing", calls: 54 }, { name: "monthly bill", calls: 13 }, { name: "hbo", calls: 21 }] });
      return json({ canManage: true, groups: [] });
    }));
    const changed = vi.fn();
    render(<TopicGroups module="remote_sales" onChanged={changed} />);
    fireEvent.click(await screen.findByRole("button", { name: /Make a group/ }));
    fireEvent.change(screen.getByLabelText("Group name"), { target: { value: "What they pay" } });
    fireEvent.click(await screen.findByRole("checkbox", { name: /pricing/ }));
    expect((screen.getByRole("button", { name: "Save group" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: /monthly bill/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save group" }));
    await waitFor(() => expect(changed).toHaveBeenCalled());
    expect(posts).toEqual([{ module: "remote_sales", name: "What they pay", members: ["pricing", "monthly bill"], source: "manager" }]);
  });
  it("Edit opens the group with its topics ticked and saves as a replacement", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return json({ group: { id: "g2" } });
      }
      if (url.includes("candidates=1")) return json({ candidates: [{ name: "Pricing", calls: 54 }, { name: "monthly price", calls: 10 }, { name: "hbo", calls: 21 }] });
      return json({ canManage: true, groups: [{ id: "g1", name: "Price", members: ["pricing", "monthly prices"], source: "ai_suggested" }] });
    }));
    render(<TopicGroups module="remote_sales" onChanged={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Price" }));
    expect(((await screen.findByRole("checkbox", { name: /Pricing/ })) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /monthly price/ }) as HTMLInputElement).checked).toBe(true); // matched by wording
    expect((screen.getByRole("checkbox", { name: /hbo/ }) as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByRole("checkbox", { name: /hbo/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save group" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toEqual({ module: "remote_sales", name: "Price", members: ["Pricing", "monthly price", "hbo"], source: "manager", replaces: "g1" });
  });
});
