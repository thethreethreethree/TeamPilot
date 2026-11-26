// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { RemoteAccount } from "../RemoteAccount";

/** One account (revenue Phase 1): totals, a timeline that links where each item lives, and a not-found that says so. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RemoteAccount", () => {
  it("shows totals and a timeline whose items open the call or the deal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      account: { id: "a1", name: "Acme" },
      deals: [{ id: "d1", name: "Renewal", status: "open", stage_label: "Demo", amount: 1200, close_date: null, last_call_at: null, next_call_date: null }],
      contacts: [{ id: "c1", name: "Dana", title: "VP Sales", rank: "vp" }],
      timeline: [
        { kind: "call", at: "2026-11-20T10:00:00Z", sessionId: "s1", label: "Discovery", channel: "phone", dealId: "d1" },
        { kind: "deal", at: "2026-11-19T10:00:00Z", dealId: "d1", what: "stage", value: { status: "open", label: "Demo" } },
      ],
    }))));
    render(<RemoteAccount id="a1" />);
    expect(await screen.findByText("Acme")).toBeTruthy();
    expect(screen.getByText(/Phone call · Discovery · Renewal/).closest("a")!.getAttribute("href")).toBe("/dashboard/remote-sales/calls/s1");
    expect(screen.getByText(/Renewal: stage Open · Demo/).closest("a")!.getAttribute("href")).toBe("/dashboard/remote-sales/pipeline?p=d1");
    expect(screen.getByText("VP")).toBeTruthy();
  });
  it("an account the person can't open says so, without confirming it exists", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "Account not found." }), { status: 404 })));
    render(<RemoteAccount id="zz" />);
    expect(await screen.findByText(/doesn.t exist or isn.t one you can open/)).toBeTruthy();
  });
});
