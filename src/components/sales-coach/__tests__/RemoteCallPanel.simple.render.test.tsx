// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

/**
 * The player in Macro Mode (General Sales Interface PDF; founder 2026-11-25 "the macro system did not follow the PDF"):
 * the picture's player — play, 15-second skips, speed, talk lanes — and nothing else. The full page keeps downloads,
 * clips and the stat tiles.
 */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({ useIsSalesCoachManager: () => true }));
vi.mock("@/lib/hooks/useCallMediaSession", () => ({ useCallMediaSession: () => {} }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));
import { RemoteCallPanel } from "../RemoteCallPanel";

const WIRE = {
  remote: true,
  measurable: true,
  estimated: false,
  untimed: 0,
  stats: { talkRatioTime: 0.5, longestRepMonologueMs: 30_000, longestCustomerStoryMs: 20_000, interactivity: 5, patienceMs: 800, repQuestionsPerHour: 20 },
  lanes: { rep: [[0, 10_000]], customer: [[10_000, 20_000]], unknown: [] },
  averages: null,
  audioUrl: "https://example.test/a.mp3",
};
const stub = () =>
  vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: () => Promise.resolve(url.endsWith("/stats") ? WIRE : { trims: [] }) })));
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("RemoteCallPanel", () => {
  it("simple: play, 15-second skips, speed and talk lanes — no downloads, clips or stat tiles (even for a manager)", async () => {
    stub();
    render(<RemoteCallPanel sessionId="s1" simple />);
    expect(await screen.findByRole("button", { name: "Back 15 seconds" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Forward 15 seconds" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Speed" })).toBeTruthy();
    expect(screen.getByLabelText("Talk-time lanes")).toBeTruthy();
    expect(screen.queryByText(/Download transcript/)).toBeNull();
    expect(screen.queryByText(/Start a clip/)).toBeNull();
    expect(screen.queryByText(/Save call/)).toBeNull();
    expect(screen.queryByText("Longest monologue")).toBeNull();
  });

  it("full page: everything stays", async () => {
    stub();
    render(<RemoteCallPanel sessionId="s1" />);
    expect(await screen.findByRole("button", { name: "Back 10 seconds" })).toBeTruthy();
    expect(screen.getByText(/Download transcript/)).toBeTruthy();
    expect(screen.getByText(/Start a clip/)).toBeTruthy();
    expect(screen.getByText("Longest monologue")).toBeTruthy();
  });
});
