// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { TeamPicker } from "../TeamPicker";

const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 403, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("TeamPicker (F10.9 / F16.6)", () => {
  it("lists everyone first, then the teams; picking one reports its id", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ teams: [{ id: "m1", name: "My team", size: 3, mine: true }, { id: "m3", name: "Theo's team", size: 2, mine: false }] })));
    const onChange = vi.fn();
    render(<TeamPicker value="" onChange={onChange} />);
    const select = (await screen.findByRole("combobox", { name: "Team" })) as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["Everyone you can see", "My team (3)", "Theo's team (2)"]);
    fireEvent.change(select, { target: { value: "m3" } });
    expect(onChange).toHaveBeenCalledWith("m3");
  });
  it("no teams, or a rep (403): nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(() => json({ teams: [] })));
    const { container } = render(<TeamPicker value="" onChange={vi.fn()} />);
    await waitFor(() => expect(container.textContent).toBe(""));
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => json({}, false)));
    const r = render(<TeamPicker value="" onChange={vi.fn()} />);
    await waitFor(() => expect(r.container.textContent).toBe(""));
  });
});
