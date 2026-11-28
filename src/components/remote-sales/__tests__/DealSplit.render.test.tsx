// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { DealSplit } from "../DealSplit";

/** A deal's split (0394): shown, changed only to a total of 100, back to one owner; a failed read is said. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const team = () => vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ members: [{ id: "a", full_name: "Ana" }, { id: "b", full_name: "Ben" }] }))));

describe("DealSplit", () => {
  it("shows a split; a new one saves only at 100%", async () => {
    team();
    const post = vi.fn(async () => true);
    render(<DealSplit repId="a" split={null} busy={false} post={post} />);
    expect(await screen.findByText(/Ana owns all of it/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Split this deal" }));
    fireEvent.click(screen.getByRole("button", { name: /Add an owner/ }));
    fireEvent.change(screen.getByLabelText("Owner 2"), { target: { value: "b" } });
    fireEvent.change(screen.getByLabelText("Share 2 (%)"), { target: { value: "40" } });
    expect((screen.getByRole("button", { name: "Save split" }) as HTMLButtonElement).disabled).toBe(true); // 140%
    expect(screen.getByText(/Total 140% — must be 100/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Share 1 (%)"), { target: { value: "60" } });
    fireEvent.click(screen.getByRole("button", { name: "Save split" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith({ action: "split", shares: [{ userId: "a", pct: 60 }, { userId: "b", pct: 40 }] }));
  });
  it("an existing split shows each share and can go back to one owner", async () => {
    team();
    const post = vi.fn(async () => true);
    render(<DealSplit repId="a" split={[{ userId: "a", pct: 70 }, { userId: "b", pct: 30 }]} busy={false} post={post} />);
    expect(await screen.findByText("Ben · 30%")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to one owner" }));
    await waitFor(() => expect(post).toHaveBeenCalledWith({ action: "split", shares: [{ userId: "a", pct: 100 }] }));
  });
  it("a split that couldn't be read says so", () => {
    team();
    render(<DealSplit repId="a" split={undefined} busy={false} post={vi.fn()} />);
    expect(screen.getByText(/Couldn.t read this deal.s split/)).toBeTruthy();
  });
  it("a team that couldn't be loaded is said, and no owner can be added", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 500 })));
    render(<DealSplit repId="a" split={null} busy={false} post={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Split this deal" }));
    expect(await screen.findByText(/Couldn.t load your team/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /Add an owner/ }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("read only for a co-owner: the split shows, nothing to change; a former teammate is still named", async () => {
    team();
    render(<DealSplit repId="a" split={[{ userId: "a", pct: 50 }, { userId: "gone", pct: 50 }]} busy={false} post={vi.fn()} readOnly />);
    expect(await screen.findByText("A former teammate · 50%")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Change" })).toBeNull();
  });
});
