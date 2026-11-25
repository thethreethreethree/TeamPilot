// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { SpeakerNamesForm } from "../SpeakerNamesForm";

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 403, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SpeakerNamesForm (0343)", () => {
  it("saves only the names that changed and reports the result", async () => {
    const bodies: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((_u: string, init: { body: string }) => (bodies.push(JSON.parse(init.body)), json({ ok: true, name: JSON.parse(init.body).name || null }))));
    const onSaved = vi.fn();
    render(<SpeakerNamesForm sessionId="s1" names={{ rep: "Alex" }} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Name the speakers" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Dana Lee"), { target: { value: "Dana Lee" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith({ rep: "Alex", customer: "Dana Lee" }));
    expect(bodies).toEqual([{ speaker: "customer", name: "Dana Lee" }]);
  });
  it("a refusal is shown and nothing is claimed saved", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ error: "Only the call's rep or a manager can name its speakers." }, false)));
    const onSaved = vi.fn();
    render(<SpeakerNamesForm sessionId="s1" names={{}} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole("button", { name: "Name the speakers" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Alex"), { target: { value: "Alex" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Only the call's rep or a manager can name its speakers.")).toBeTruthy();
    expect(onSaved).toHaveBeenCalledWith({});
  });
});
