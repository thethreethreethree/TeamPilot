// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { SessionTranscript } from "../SessionTranscript";

/** 0343 (F8.5): a phone/video call's transcript shows the speakers' given names; in-person transcripts don't ask. */
const json = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const SEGS = [
  { speaker: "agent", text: "Thanks for taking the call", seq: 1, spoken_at: null },
  { speaker: "customer", text: "Happy to", seq: 2, spoken_at: null },
];
const stub = (urls: string[], canEdit = true) =>
  vi.stubGlobal("fetch", vi.fn((u: string) => {
    urls.push(u);
    if (u.includes("speaker-names")) return json({ names: { customer: "Dana Lee" } });
    if (u.includes("transcript-edit")) return json({ canEdit, edits: [] });
    return json({ segments: SEGS });
  }));

describe("SessionTranscript — speaker names", () => {
  it("shows the customer's name and the plain rep label; an editor gets 'Name the speakers'", async () => {
    const urls: string[] = [];
    stub(urls);
    render(<SessionTranscript sessionId="s1" speakerNames />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    expect(await screen.findByText("Dana Lee")).toBeTruthy();
    expect(screen.getByText("Rep")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Name the speakers" })).toBeTruthy();
  });
  it("without the flag (in person): no names asked for, no control", async () => {
    const urls: string[] = [];
    stub(urls);
    render(<SessionTranscript sessionId="s1" />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    expect(await screen.findByText("Customer")).toBeTruthy();
    expect(urls.some((u) => u.includes("speaker-names"))).toBe(false);
    expect(screen.queryByRole("button", { name: "Name the speakers" })).toBeNull();
  });
  it("someone who can't edit sees the names but not the control", async () => {
    stub([], false);
    render(<SessionTranscript sessionId="s1" speakerNames />);
    fireEvent.click(screen.getByRole("button", { name: /Full transcript/ }));
    expect(await screen.findByText("Dana Lee")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Name the speakers" })).toBeNull();
  });
});
