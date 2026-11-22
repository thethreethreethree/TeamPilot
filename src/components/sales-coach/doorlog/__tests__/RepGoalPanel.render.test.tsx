// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

import { RepGoalPanel } from "../RepGoalPanel";

/**
 * A manager's per-rep daily sales goal (door). Pinned 2026-11-23: when a rep's current goal fails to load, saving is
 * OFF — the fields would show blank, and saving with $-per-sale left blank clears the rep's saved value. A failed team
 * read says so instead of an empty list.
 */
const fetchMock = vi.fn();
const respond = (goal: unknown, team: unknown = { members: [{ id: "rep-1", full_name: "Pat Rep" }] }) =>
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/team")) return team === "FAIL" ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => team };
    if (String(url).includes("rep-goal")) return goal === "FAIL" ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => goal };
    return { ok: true, json: async () => ({}) };
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

const pickRep = async () => {
  await screen.findByRole("option", { name: "Pat Rep" });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "rep-1" } });
};
const saveBtn = () => screen.getByRole("button", { name: /save goal/i }) as HTMLButtonElement;

describe("rep goal", () => {
  it("loads the rep's saved goal and $-per-sale", async () => {
    respond({ salesGoal: 3, saleValueCents: 18500 });
    render(<RepGoalPanel />);
    await pickRep();
    expect(await screen.findByDisplayValue("3")).toBeTruthy();
    expect(screen.getByDisplayValue("185")).toBeTruthy();
    expect(saveBtn().disabled).toBe(false);
  });

  it("a failed goal read turns saving off and says why", async () => {
    respond("FAIL");
    render(<RepGoalPanel />);
    await pickRep();
    expect(await screen.findByText(/couldn.t load this rep.s goal/i)).toBeTruthy();
    expect(saveBtn().disabled).toBe(true);
  });

  it("a failed team read says so", async () => {
    respond({ salesGoal: null, saleValueCents: null }, "FAIL");
    render(<RepGoalPanel />);
    expect(await screen.findByRole("option", { name: /couldn.t load the team/i })).toBeTruthy();
  });
});
