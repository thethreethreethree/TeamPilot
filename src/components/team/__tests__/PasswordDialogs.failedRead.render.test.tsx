// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TeamPasswordsDialog } from "../TeamPasswordsDialog";
import { AddAgentDialog } from "../AddAgentDialog";

/**
 * 2026-11-23 sweep: a failed read of the team passwords was shown as "No team password yet — create one", which
 * invites a duplicate. A failure now says so; a real empty list still reads as empty.
 */
const res = (ok: boolean, body: unknown) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("team password dialogs on a failed read", () => {
  it("Team passwords: a failure is not 'no passwords yet'; an empty answer is", async () => {
    vi.stubGlobal("fetch", vi.fn(() => res(false, {})));
    render(<TeamPasswordsDialog open onClose={() => {}} />);
    expect(await screen.findByText(/Couldn.t load the team passwords/)).toBeTruthy();
    expect(screen.queryByText(/No team passwords yet/)).toBeNull();
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => res(true, { passwords: [] })));
    render(<TeamPasswordsDialog open onClose={() => {}} />);
    expect(await screen.findByText(/No team passwords yet/)).toBeTruthy();
  });
  it("Add user → new user: a failure is not 'create one first'", async () => {
    vi.stubGlobal("fetch", vi.fn(() => res(false, {})));
    render(<AddAgentDialog open onClose={() => {}} onAdded={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: /new/i }));
    expect(await screen.findByText(/Couldn.t load the team passwords/)).toBeTruthy();
    expect(screen.queryByText(/No team password yet/)).toBeNull();
  });
});
