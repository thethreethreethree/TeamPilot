// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/**
 * Engage → Today (plan E1). Pinned: due steps show with their filled text; an email step opens the rep's own mail app
 * (a mailto link, nothing sent from here) and says so when the contact has no address; a call step can't be logged
 * without an outcome, and logging sends that outcome.
 */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false }));
import { RemoteEngage } from "../RemoteEngage";

const past = new Date(Date.now() - 3_600_000).toISOString();
const item = (o: Record<string, unknown>) => ({
  enrolmentId: "e1", flowName: "After the call", prospectId: "d1", dealName: "Acme renewal", contactName: "Dana Smith", contactTitle: "VP",
  contactEmail: "dana@example.com", contactPhone: "+1 555 010 0123", state: "active", stepIndex: 0, stepCount: 2,
  step: { kind: "email", delay: { amount: 0, unit: "business_days" }, title: "Hi", subject: "Following up, Dana", text: "Hi Dana,\nthanks" },
  dueAt: past, overdue: true, ...o,
});
const outcomes = [{ key: "follow_up", label: "Follow up", connected: true, sentiment: "positive" }];
function serve(items: unknown[]) {
  const posts: unknown[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push(JSON.parse(String(init.body)));
      return new Response(JSON.stringify({ ok: true }));
    }
    return new Response(JSON.stringify(String(url).includes("/enrolments") ? { items, outcomes, viewerId: "me" } : { flows: [] }));
  }));
  return posts;
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Engage → Today", () => {
  it("an email step opens the rep's own mail app with the filled subject and text", async () => {
    serve([item({})]);
    render(<RemoteEngage />);
    expect(await screen.findByText("Following up, Dana")).toBeTruthy();
    const link = screen.getByText("Open in email").closest("a")!;
    expect(link.getAttribute("href")).toBe(`mailto:${encodeURIComponent("dana@example.com")}?subject=${encodeURIComponent("Following up, Dana")}&body=${encodeURIComponent("Hi Dana,\nthanks")}`);
  });
  it("no email address: says so instead of a link", async () => {
    serve([item({ contactEmail: null })]);
    render(<RemoteEngage />);
    expect(await screen.findByText(/No email address on this contact/)).toBeTruthy();
    expect(screen.queryByText("Open in email")).toBeNull();
  });
  it("a call can't be logged without an outcome; logging sends it", async () => {
    const posts = serve([item({ step: { kind: "call", delay: { amount: 0, unit: "hours" }, title: "Call", subject: "Call Dana", text: "" } })]);
    render(<RemoteEngage />);
    const log = (await screen.findByText("Log the call")) as HTMLButtonElement;
    expect(log.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("How the call went"), { target: { value: "follow_up" } });
    expect(log.disabled).toBe(false);
    fireEvent.click(log);
    await waitFor(() => expect(posts).toContainEqual({ action: "step", enrolmentId: "e1", kind: "complete_step", outcome: "follow_up" }));
  });
  it("nothing to do: says how to start", async () => {
    serve([]);
    render(<RemoteEngage />);
    expect(await screen.findByText(/Nothing to do yet/)).toBeTruthy();
  });
});
