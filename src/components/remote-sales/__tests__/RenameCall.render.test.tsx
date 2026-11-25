// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { RenameCall } from "../RenameCall";

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 403, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RenameCall (F6.3)", () => {
  it("sends only the new name and reports it", async () => {
    const calls: Array<{ url: string; init: { method: string; body: string } }> = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init: { method: string; body: string }) => (calls.push({ url, init }), json({ session: {} }))));
    const onRenamed = vi.fn();
    render(<RenameCall sessionId="s1" label="Upload 3" onRenamed={onRenamed} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename call" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Call name" }), { target: { value: "  Acme renewal " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(onRenamed).toHaveBeenCalledWith("Acme renewal"));
    expect(calls[0]!.url).toBe("/api/coach/sales-session/s1");
    expect(calls[0]!.init.method).toBe("PATCH");
    expect(JSON.parse(calls[0]!.init.body)).toEqual({ clientLabel: "Acme renewal" }); // never a status change
  });
  it("an empty name isn't sent; a refusal is shown", async () => {
    const fetchMock = vi.fn(() => json({ error: "Only the rep who ran this session can rename it." }, false));
    vi.stubGlobal("fetch", fetchMock);
    render(<RenameCall sessionId="s1" label="" onRenamed={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Rename call" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Give the call a name.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Call name" }), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toBeTruthy();
  });
});
