// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** 0333: the author edits or removes their own comment; others' comments show no controls; edited is marked. */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => true, useCurrentUserRole: () => "Member", isCompanyAdminRole: () => false }));
import { RemoteCallComments } from "../RemoteCallComments";

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
const MOMENTS = [
  { id: "c1", kind: "comment", atSeconds: 5, label: "Comment · 11/25", detail: "Ask about the budget", points: null, authorId: "mgr" },
  { id: "c2", kind: "comment", atSeconds: 9, label: "Comment · 11/25", detail: "Nice close", points: null, authorId: "other", edited: true },
];
function stub() {
  const patches: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
    if (init?.method === "PATCH") {
      patches.push(JSON.parse(init.body!));
      return json({ ok: true, changed: true });
    }
    if (url.startsWith("/api/coach/sales-session/pitch-score?")) return json({ pitch: { id: "p1", repId: "rep1" } });
    if (url.startsWith("/api/coach/sales-session/pitch-recordings?")) return json({ moments: MOMENTS, viewerId: "mgr" });
    if (url === "/api/team") return json({ members: [] });
    return json({}, false);
  }));
  return patches;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RemoteCallComments — edit and remove (0333)", () => {
  it("only my comment has Edit / Remove; an edited one says so", async () => {
    stub();
    render(<RemoteCallComments sessionId="s1" />);
    expect(await screen.findByText("Ask about the budget")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Edit" })).toHaveLength(1);
    expect(screen.getByText(/· edited/)).toBeTruthy();
  });
  it("editing sends the new text for that comment", async () => {
    const patches = stub();
    render(<RemoteCallComments sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Edit comment"), { target: { value: "Ask about the budget first" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(patches).toEqual([{ commentId: "c1", body: "Ask about the budget first" }]));
  });
  it("removing asks first, then sends the removal", async () => {
    const patches = stub();
    render(<RemoteCallComments sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
    expect(screen.getByText(/The rep may already have read it/)).toBeTruthy();
    expect(patches).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(patches).toEqual([{ commentId: "c1", remove: true }]));
  });
});
