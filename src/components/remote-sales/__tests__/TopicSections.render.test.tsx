// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TopicSections } from "../TopicSections";

/** Topic sections on the call page: nothing runs until asked; each section plays the call from where it starts. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const SECTIONS = [{ label: "Introductions", fromSeq: 1, toSeq: 4, startMs: 0, endMs: 30_000, share: 0.4 }, { label: "Pricing", fromSeq: 5, toSeq: 10, startMs: 95_000, endMs: 200_000, share: 0.6 }];

describe("TopicSections", () => {
  it("asks before the AI read, then shows the sections; a section seeks the call", async () => {
    const posts: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        posts.push("run");
        return new Response(JSON.stringify({ sections: SECTIONS, lines: 10, of: 10 }));
      }
      return new Response(JSON.stringify({ sections: null, hasTranscript: true }));
    }));
    const onSeek = vi.fn();
    render(<TopicSections sessionId="s1" onSeek={onSeek} />);
    fireEvent.click(await screen.findByRole("button", { name: /Show topic sections/ }));
    expect(posts).toEqual(["run"]);
    fireEvent.click(await screen.findByRole("button", { name: /Pricing/ }));
    expect(onSeek).toHaveBeenCalledWith(95);
    expect(screen.getByText("60%")).toBeTruthy();
  });
  it("no transcript yet: nothing shown", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ sections: null, hasTranscript: false }))));
    const { container } = render(<TopicSections sessionId="s1" />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
  });
});
