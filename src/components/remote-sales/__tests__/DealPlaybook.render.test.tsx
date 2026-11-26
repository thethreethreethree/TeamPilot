// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { DealPlaybook } from "../DealPlaybook";

/** A deal's playbook letters (revenue Phase 3b): state in words, evidence linked to the line, Validate only on a written note. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const els = [{ letter: "B", name: "Budget", question: "Money?" }, { letter: "A", name: "Authority", question: "Who?" }];
const serve = (notes: unknown[], canValidate = true) =>
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ available: true, playbook: { name: "BANT", elements: els }, notes, canValidate }))));

describe("DealPlaybook", () => {
  it("each letter says its state; evidence links to the call at its line", async () => {
    serve([
      { element: 0, state: "ai_found", note: null, ai: { answer: "Budget is 10k.", cites: [{ sessionId: "s1", seq: 4, atMs: 65000 }] }, validatedBy: null, at: null },
      { element: 1, state: "validated", note: "The CFO", ai: null, validatedBy: "m", at: null },
    ]);
    render(<DealPlaybook dealId="d1" />);
    expect(await screen.findByLabelText("Budget: evidence found")).toBeTruthy();
    expect(screen.getByLabelText("Authority: validated")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Budget: evidence found"));
    expect(screen.getByText("line 4 · 1:05").closest("a")!.getAttribute("href")).toBe("/dashboard/remote-sales/calls/s1?t=65");
    expect(screen.queryByText("Validate")).toBeNull(); // evidence isn't a note yet
  });
  it("Validate shows only on a written note, and only for the rep or a manager", async () => {
    serve([{ element: 0, state: "noted", note: "10k", ai: null, validatedBy: null, at: null }, { element: 1, state: "empty", note: null, ai: null, validatedBy: null, at: null }]);
    render(<DealPlaybook dealId="d1" />);
    fireEvent.click(await screen.findByLabelText("Budget: noted"));
    expect(screen.getByText("Validate")).toBeTruthy();
    cleanup();
    serve([{ element: 0, state: "noted", note: "10k", ai: null, validatedBy: null, at: null }, { element: 1, state: "empty", note: null, ai: null, validatedBy: null, at: null }], false);
    render(<DealPlaybook dealId="d1" />);
    fireEvent.click(await screen.findByLabelText("Budget: noted"));
    expect(screen.queryByText("Validate")).toBeNull();
  });
});
