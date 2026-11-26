// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/** The accounts list: near-duplicate names are suggested to a person (never merged); no suggestion when none collide. */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => false }));
import { RemoteAccounts } from "../RemoteAccounts";

const row = (id: string, name: string) => ({ id, name, openDeals: 1, openAmount: 0, wonDeals: 0, lostDeals: 0, lastCallAt: null, contacts: 0 });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RemoteAccounts", () => {
  it("names accounts that may be the same company", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ accounts: [row("1", "Acme"), row("2", "Acme, Inc."), row("3", "Globex")], capped: false }))));
    render(<RemoteAccounts />);
    const box = await screen.findByLabelText("Possible duplicates");
    expect(box.textContent).toMatch(/Acme · Acme, Inc\./);
    expect(box.textContent).not.toMatch(/Globex/);
  });
  it("no box when no names collide", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ accounts: [row("1", "Acme"), row("3", "Globex")], capped: false }))));
    render(<RemoteAccounts />);
    await screen.findByText("Globex");
    expect(screen.queryByLabelText("Possible duplicates")).toBeNull();
  });
});
