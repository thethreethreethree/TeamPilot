// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { ProtectionSettings } from "../ProtectionSettings";

/** Settings → Protection, the retention panel after D14 (decided 2026-11-23: 90 days by default). */
const fetchMock = vi.fn();
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const BASE = { isDefault: true, defaultKeep: 20, defaultDays: 90, min: 1, max: 1000, canManage: true };

function serve(retention: Record<string, unknown>) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes("/settings/retention")) return json(retention);
    if (String(url).includes("/audit")) return json({ rows: [], more: false });
    if (String(url).includes("/vocabulary")) return json({ terms: [], canManage: false });
    if (String(url).includes("/erasure")) return json({ unfinished: [] });
    if (String(url).includes("/webhooks")) return json({ endpoints: [], canManage: false });
    return json({});
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("retention on the Protection screen", () => {
  it("with no setting, says audio is kept 90 days — the standard setting", async () => {
    serve({ ...BASE, keepLastPerRep: null });
    render(<ProtectionSettings />);
    expect(await screen.findByText(/audio is kept for/i)).toBeTruthy();
    expect(screen.getByText("90")).toBeTruthy();
    expect(screen.getByText(/the standard setting/i)).toBeTruthy();
  });

  it("with a company setting, says the last N per rep", async () => {
    serve({ ...BASE, isDefault: false, keepLastPerRep: 40 });
    render(<ProtectionSettings />);
    expect(await screen.findByText(/keep each rep.s last/i)).toBeTruthy();
    expect(screen.getByText("40")).toBeTruthy();
  });

  it("moving from the 90-day default to a count warns that recent audio can go — it can't be undone", async () => {
    serve({ ...BASE, keepLastPerRep: null });
    render(<ProtectionSettings />);
    const box = (await screen.findByLabelText(/keep the last/i)) as HTMLInputElement;
    expect(box.value).toBe("20"); // the box starts at 20; nothing changes until Save
    expect(screen.getByText(/can.t be undone/i)).toBeTruthy();
    fireEvent.change(box, { target: { value: "50" } });
    expect(screen.getByText(/however recent/i)).toBeTruthy();
  });
});
