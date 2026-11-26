// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

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

describe("RemoteCallPanel — saving to a folder (F12.6 / F9.16)", () => {
  it("Listen later saves to your 'Listen later' folder; Save call sends the folder and note typed", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST" && url === "/api/coach/remote/library") {
        posts.push(JSON.parse(init.body!));
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ item: { id: "i1" } }) });
      }
      if (url.startsWith("/api/coach/remote/library?")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ folders: [{ name: "Objections" }] }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(url.endsWith("/stats") ? WIRE : { trims: [] }) });
    }));
    render(<RemoteCallPanel sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Listen later" }));
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0]).toMatchObject({ action: "add", scope: "mine", sessionId: "s1", folderName: "Listen later" });
    expect(await screen.findByText(/Added to “Listen later”/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Folder"), { target: { value: "Objections" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "great reframe at 3:10" } });
    fireEvent.click(screen.getByRole("button", { name: /Save call to Mine/ }));
    await waitFor(() => expect(posts).toHaveLength(2));
    expect(posts[1]).toMatchObject({ scope: "mine", folderName: "Objections", note: "great reframe at 3:10" });
  });
});

describe("RemoteCallPanel — questions asked (F9.6)", () => {
  it("lists the rep's questions with their times on the full page, and not in Macro Mode", async () => {
    const withQ = { ...WIRE, questions: [{ atMs: 65_000, text: "What's driving the change this quarter?" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: () => Promise.resolve(url.endsWith("/stats") ? withQ : { trims: [] }) })));
    render(<RemoteCallPanel sessionId="s1" />);
    expect(await screen.findByText("Questions asked by the rep (1)")).toBeTruthy();
    const q = screen.getByRole("button", { name: /What's driving the change this quarter\?/ });
    expect(q.textContent).toContain("1:05");
    cleanup();
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: () => Promise.resolve(url.endsWith("/stats") ? withQ : { trims: [] }) })));
    render(<RemoteCallPanel sessionId="s1" simple />);
    await screen.findByRole("button", { name: "Back 15 seconds" });
    expect(screen.queryByText(/Questions asked by the rep/)).toBeNull();
  });
  it("with no recording, the questions read as text and say why they can't play — no dead buttons", async () => {
    const noAudio = { ...WIRE, audioUrl: null, questions: [{ atMs: 65_000, text: "What's driving the change this quarter?" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve({ ok: true, json: () => Promise.resolve(url.endsWith("/stats") ? noAudio : { trims: [] }) })));
    render(<RemoteCallPanel sessionId="s1" />);
    expect(await screen.findByText("Questions asked by the rep (1)")).toBeTruthy();
    expect(screen.getByText(/What's driving the change this quarter\?/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /What's driving the change/ })).toBeNull();
    expect(screen.getByText("This call has no recording, so these can't be played.")).toBeTruthy();
  });
});
