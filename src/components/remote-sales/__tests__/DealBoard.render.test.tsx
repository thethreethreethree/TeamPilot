// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DealBoard } from "../DealBoard";

/** Pipeline → Board (revenue Phase 2): groups in the company's stage order, counts unpriced deals apart, filters by risk. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const T = "2026-11-27";
const deal = (o: Record<string, unknown>) => ({
  id: "d", repId: "r", name: "Deal", status: "open" as const, stageLabel: null, amount: 100, closeDate: null, nextCallDate: "2026-11-30",
  lastCallAt: "2026-11-25T10:00:00Z", createdAt: "2026-11-01T00:00:00Z", nextTodo: null, ...o,
});

describe("DealBoard", () => {
  it("groups by the company's stages, totals each, and counts a deal with no amount apart", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ views: [] }))));
    render(
      <DealBoard
        deals={[deal({ id: "a", name: "Alpha", stageLabel: "Demo", amount: 500 }), deal({ id: "b", name: "Beta", stageLabel: "Demo", amount: null }), deal({ id: "c", name: "Gamma", stageLabel: "Discovery", amount: 300 })]}
        stages={[{ name: "Discovery", kind: "open" }, { name: "Demo", kind: "open" }]}
        canEditStages={false} onStagesSaved={() => {}} onOpen={() => {}} repName={null} today={T}
      />,
    );
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent ?? "").filter((t) => /Discovery|Demo/.test(t));
    expect(heads[0]).toMatch(/^Discovery/);
    expect(heads[1]).toMatch(/^Demo.*2 · 500.*1 unpriced/);
    expect(screen.getByText(/1 with no amount \(not counted\)/)).toBeTruthy();
  });
  it("the risk filter keeps only at-risk deals", () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ views: [] }))));
    render(
      <DealBoard
        deals={[deal({ id: "a", name: "Healthy" }), deal({ id: "b", name: "Slipping", nextCallDate: null, lastCallAt: null, createdAt: "2026-10-01T00:00:00Z" })]}
        stages={null} canEditStages={false} onStagesSaved={() => {}} onOpen={() => {}} repName={null} today={T}
      />,
    );
    fireEvent.change(screen.getByLabelText("Risk"), { target: { value: "at_risk" } });
    expect(screen.getByText("Slipping")).toBeTruthy();
    expect(screen.queryByText("Healthy")).toBeNull();
  });
});
