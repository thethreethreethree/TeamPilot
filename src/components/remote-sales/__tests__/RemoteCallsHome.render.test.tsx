// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

vi.mock("@/components/sales-coach/StartSessionPanel", () => ({ StartSessionPanel: () => null }));
vi.mock("@/components/remote-sales/RemoteMacroToggle", () => ({ RemoteMacroToggle: () => null }));
const nav = vi.hoisted(() => ({ replace: vi.fn(), macro: false as boolean | null }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: nav.replace, push: vi.fn() }) }));
vi.mock("@/lib/hooks/useRemoteMacroMode", () => ({ useRemoteMacroMode: () => ({ enabled: nav.macro }) }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import { RemoteCallsHome } from "../RemoteCallsHome";

/** Remote Sales → Calls. Pinned 2026-11-23: lists the calls; a failed OR degraded read says so, never an empty list. */
const fetchMock = vi.fn();
const ROW = { id: "s1", clientLabel: "Pat Prospect", context: "phone", status: "ended", startedAt: new Date().toISOString(), endedAt: null, audioDurationSeconds: 300, outcome: null, agentName: "Pat Rep" };

beforeEach(() => {
  vi.clearAllMocks();
  nav.macro = false;
  window.localStorage.clear();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("remote calls", () => {
  it("asks for phone/video calls and lists them", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sessions: [ROW], isManager: false }) });
    render(<RemoteCallsHome />);
    expect(await screen.findByText("Pat Prospect")).toBeTruthy();
    expect(String(fetchMock.mock.calls[0]![0])).toContain("context=remote");
  });

  it("a failed read says so", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    render(<RemoteCallsHome />);
    expect(await screen.findByText(/couldn.t load your calls/i)).toBeTruthy();
  });

  it("a degraded read (partial data) is treated as failed, not as the whole list", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sessions: [ROW], degraded: true }) });
    render(<RemoteCallsHome />);
    expect(await screen.findByText(/couldn.t load your calls/i)).toBeTruthy();
    expect(screen.queryByText("Pat Prospect")).toBeNull();
  });

  it("Macro Mode: the first visit of the day opens Today (the PDF's brain dump), later visits stay on Calls", async () => {
    nav.macro = true;
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sessions: [ROW], isManager: false }) });
    render(<RemoteCallsHome />);
    expect(nav.replace).toHaveBeenCalledWith("/dashboard/remote-sales/today");
    cleanup();
    nav.replace.mockClear();
    render(<RemoteCallsHome />);
    expect(await screen.findByText("Pat Prospect")).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Remote calls at a glance")).toBeNull();
  });

  it("Macro Mode off: Calls opens as itself, with the at-a-glance tiles", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sessions: [ROW], isManager: false }) });
    render(<RemoteCallsHome />);
    expect(await screen.findByText("Pat Prospect")).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Remote calls at a glance")).toBeTruthy();
  });

  it("Macro Mode: having opened Today already today, Calls stays on Calls (review 2026-11-25)", async () => {
    nav.macro = true;
    const { markTodaySeen } = await import("@/lib/coach/remote/todayShown");
    markTodaySeen(); // what RemoteToday does on open
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ sessions: [ROW], isManager: false }) });
    render(<RemoteCallsHome />);
    expect(await screen.findByText("Pat Prospect")).toBeTruthy();
    expect(nav.replace).not.toHaveBeenCalled();
  });
});
