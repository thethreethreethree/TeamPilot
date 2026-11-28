// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { ApiKeysPanel } from "../ApiKeysPanel";

/**
 * Protection → API keys (0378). Pinned: a new key is shown once, with the scopes asked for; revoking asks first (it
 * can't be undone); a non-admin (403) sees no panel; a failed read says so.
 */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const KEY = { id: "k1", name: "Warehouse", prefix: "els_abc123", scopes: ["read"], createdAt: "2026-11-27T00:00:00Z", revokedAt: null, requests24h: 3, lastUsedAt: null };
function serve(status = 200, usage: unknown = { days: 7, lines: [], partial: false }) {
  const posts: Array<Record<string, unknown>> = [];
  vi.stubGlobal("fetch", vi.fn(async (u: string, init?: RequestInit) => {
    if (String(u).endsWith("/usage")) return usage === "fail" ? new Response("{}", { status: 500 }) : new Response(JSON.stringify(usage));
    if (init?.method === "POST") {
      const b = JSON.parse(String(init.body)) as Record<string, unknown>;
      posts.push(b);
      return new Response(JSON.stringify(b.revoke ? { ok: true } : { key: "els_THE_SECRET_KEY_SHOWN_ONCE" }));
    }
    return new Response(JSON.stringify({ keys: [KEY] }), { status });
  }));
  return posts;
}

describe("ApiKeysPanel", () => {
  it("a new key is shown once, with MCP when asked", async () => {
    const posts = serve();
    render(<ApiKeysPanel />);
    fireEvent.change(await screen.findByLabelText("Key name"), { target: { value: "Claude" } });
    fireEvent.click(screen.getByLabelText(/Also for AI assistants/));
    fireEvent.click(screen.getByRole("button", { name: "Make a key" }));
    expect(await screen.findByText("els_THE_SECRET_KEY_SHOWN_ONCE")).toBeTruthy();
    expect(posts[0]).toEqual({ name: "Claude", scopes: ["read", "mcp"] });
    fireEvent.click(screen.getByRole("button", { name: /saved it/ }));
    expect(screen.queryByText("els_THE_SECRET_KEY_SHOWN_ONCE")).toBeNull();
  });
  it("revoking asks first; 'Keep it' sends nothing", async () => {
    const posts = serve();
    render(<ApiKeysPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Revoke…" }));
    expect(screen.getByText(/stops working now/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep it" }));
    expect(posts).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Revoke…" }));
    fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
    await waitFor(() => expect(posts).toEqual([{ revoke: "k1" }]));
  });
  it("not an admin: no panel; a failed read says so", async () => {
    serve(403);
    const { container } = render(<ApiKeysPanel />);
    await waitFor(() => expect(container.textContent).toBe(""));
    cleanup();
    serve(500);
    render(<ApiKeysPanel />);
    expect(await screen.findByText(/Couldn.t load API keys/)).toBeTruthy();
  });
  it("usage (E7): the week by key and route, partial said aloud; a failed read says so", async () => {
    serve(200, { days: 7, lines: [{ keyId: "k1", route: "/api/v1/deals", requests: 1200, errors: 4, limited: 2 }], partial: true });
    render(<ApiKeysPanel />);
    expect(await screen.findByText("Usage, last 7 days")).toBeTruthy();
    expect(screen.getByText("/api/v1/deals")).toBeTruthy();
    expect(screen.getByText((1200).toLocaleString())).toBeTruthy();
    expect(screen.getByText(/newest 50,000 requests only/)).toBeTruthy();
    cleanup();
    serve(200, "fail");
    render(<ApiKeysPanel />);
    expect(await screen.findByText(/Couldn.t load API usage/)).toBeTruthy();
  });
  it("trusted addresses (E15) are sent with a new key and shown on it", async () => {
    const posts = serve();
    render(<ApiKeysPanel />);
    fireEvent.change(await screen.findByLabelText("Key name"), { target: { value: "Warehouse" } });
    fireEvent.change(screen.getByLabelText("Trusted addresses"), { target: { value: "203.0.113.7, 198.51.100.0/24" } });
    fireEvent.click(screen.getByRole("button", { name: "Make a key" }));
    await waitFor(() => expect(posts[0]).toEqual({ name: "Warehouse", scopes: ["read"], allowedIps: ["203.0.113.7", "198.51.100.0/24"] }));
  });
  it("says when to use a key and when to download (E17; F34.3)", async () => {
    serve();
    render(<ApiKeysPanel />);
    expect((await screen.findByText(/API or download\?/)).closest("p")?.textContent).toMatch(/data warehouse.*Sources view/);
  });
});
