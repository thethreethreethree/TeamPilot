// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PickYourVoice } from "../PickYourVoice";

/** Pick your voice (Engage plan E6/E10): only while every line is unknown; consent first; then which voice is the rep. */
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const seg = (cluster: string, text: string, speaker = "unknown") => ({ speaker, text, source: null, speaker_cluster: cluster });
function serve(segments: unknown[]) {
  const posts: Array<{ url: string; body: unknown }> = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posts.push({ url: String(url), body: JSON.parse(String(init.body)) });
      return new Response(JSON.stringify({ ok: true }));
    }
    return new Response(JSON.stringify({ segments }));
  }));
  return posts;
}

describe("PickYourVoice", () => {
  it("two voices: consent first, then 'This is me' sends that voice", async () => {
    const posts = serve([seg("speaker_0", "Hi, this is Sam from Acme"), seg("speaker_1", "Oh hello"), seg("speaker_0", "Do you have a minute?")]);
    const onDone = vi.fn();
    render(<PickYourVoice sessionId="s1" onDone={onDone} />);
    const mine = await screen.findAllByRole("button", { name: "This is me" });
    expect((mine[0] as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getAllByRole("button", { name: "This is me" })[0]!);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(posts[0]!.url).toContain("/consent");
    expect(posts[1]).toMatchObject({ url: expect.stringContaining("/attribute-unlabelled"), body: { agentCluster: expect.any(String) } });
  });
  it("a call that already has an answer shows nothing", async () => {
    serve([seg("speaker_0", "Hi", "agent"), seg("speaker_1", "Hello", "customer")]);
    const { container } = render(<PickYourVoice sessionId="s1" onDone={vi.fn()} />);
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
  });
});
