// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/** Brief templates (F13.2, 0364): run a template on a call; cited answers play from their moment; managers write templates. */
import { CustomBriefs } from "../CustomBriefs";
import { BriefTemplatesManager } from "../BriefTemplatesManager";

const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const T = { id: "22222222-2222-4222-8222-222222222222", name: "Discovery", sections: [{ question: "Budget?", instructions: "" }, { question: "Start date?", instructions: "" }] };

describe("CustomBriefs", () => {
  it("runs a template; a cited answer plays from its moment; an uncited one says not discussed", async () => {
    const seek = vi.fn();
    vi.stubGlobal("fetch", vi.fn((u: string, init?: { method?: string }) => {
      if (u === "/api/coach/remote/brief-templates") return ok({ available: true, templates: [T] });
      if (init?.method === "POST")
        return ok({ brief: { answers: [{ question: "Budget?", answer: "About ten thousand.", seqs: [3], atMs: [65_000] }, { question: "Start date?", answer: "Not discussed on this call.", seqs: [] }] } });
      return ok({ available: true, brief: null });
    }));
    render(<CustomBriefs sessionId="s1" onSeek={seek} />);
    fireEvent.click(await screen.findByRole("button", { name: "Answer from this call" }));
    expect(await screen.findByText("About ten thousand.")).toBeTruthy();
    expect(screen.getByText("Not discussed on this call.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1:05" }));
    expect(seek).toHaveBeenCalledWith(65);
  });
  it("no templates renders nothing", async () => {
    vi.stubGlobal("fetch", vi.fn(() => ok({ available: true, templates: [] })));
    const { container } = render(<CustomBriefs sessionId="s1" />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
});

describe("BriefTemplatesManager", () => {
  it("a manager writes a template; a rep sees nothing", async () => {
    const posts: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn((_u: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posts.push(JSON.parse(init.body!));
        return ok({ id: "t-new" });
      }
      return ok({ available: true, canManage: true, templates: [] });
    }));
    render(<BriefTemplatesManager />);
    fireEvent.click(await screen.findByRole("button", { name: "New template" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Discovery" } });
    fireEvent.change(screen.getByLabelText("Question 1"), { target: { value: "Budget?" } });
    fireEvent.click(screen.getByRole("button", { name: "Save template" }));
    await waitFor(() => expect(posts).toEqual([{ name: "Discovery", sections: [{ question: "Budget?", instructions: "" }] }]));
    cleanup();
    vi.stubGlobal("fetch", vi.fn(() => ok({ available: true, canManage: false, templates: [T] })));
    const { container } = render(<BriefTemplatesManager />);
    await waitFor(() => expect(container.innerHTML).toBe(""));
  });
});
