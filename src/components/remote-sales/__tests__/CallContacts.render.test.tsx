// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { CallContacts } from "../CallContacts";

/** Who was on this call (0370). Pinned: people shown; taking one off posts linked:false; a 404 shows nothing; a failure says so. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function serve(status = 200) {
  const posts: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ ok: true }));
    }
    return new Response(JSON.stringify({ contacts: [{ id: "c1", name: "Dana Smith", title: "VP" }], accountId: "a1" }), { status });
  }));
  return posts;
}

describe("CallContacts", () => {
  it("shows who was on the call; taking someone off posts linked:false", async () => {
    const posts = serve();
    render(<CallContacts sessionId="s1" />);
    expect(await screen.findByText("Dana Smith")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Dana Smith wasn't on this call"));
    await waitFor(() => expect(posts).toEqual([{ contactId: "c1", linked: false }]));
  });
  it("a call this person can't open (404) shows nothing; a failed read says so", async () => {
    serve(404);
    const { container } = render(<CallContacts sessionId="s1" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
    cleanup();
    serve(500);
    render(<CallContacts sessionId="s1" />);
    expect(await screen.findByText(/Couldn.t load who was on this call/)).toBeTruthy();
  });
});
