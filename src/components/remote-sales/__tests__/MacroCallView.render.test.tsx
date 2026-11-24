// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

/**
 * Macro Mode's call view (MACRO-MODE-SPEC: "3 tabs … nothing else"). The ways it could fail a rep while rendering:
 * a call outside the pipeline with no way in, a checklist that saves what the rep unticked, a Coaching tab with no
 * manager comments (the inbox sends managers here), and no way back to the full page.
 */
vi.mock("@/lib/hooks/useCurrentUserRole", () => ({
  useIsSalesCoachManager: () => false,
  useCurrentUserRole: () => "Member",
  isCompanyAdminRole: () => false,
}));

import { MacroCallView } from "../MacroCallView";

const BRIEF = {
  available: true,
  brief: {
    id: "b1",
    keyPoints: [{ text: "Needs it live before March", seq: 2 }],
    nextSteps: [{ text: "Send the quote Thursday", seq: 3 }],
    nextMeeting: {
      agenda: [{ text: "Walk through the quote" }],
      bringUp: [{ text: "The March deadline", seq: 2 }],
      checklist: [{ text: "Send quote", due: "2026-11-26" }, { text: "Ask about budget", due: null }],
    },
  },
  review: null,
  prospect: null,
  label: "Betty – Acme",
  isOwner: true,
};
let brief: typeof BRIEF = BRIEF;
/** Endpoints that answer with a server error in a test (2026-11-23). */
let failing: string[] = [];

const fetchMock = vi.fn();
const json = (body: unknown, ok = true) => Promise.resolve({ ok, status: ok ? 200 : 500, json: () => Promise.resolve(body) });

beforeEach(() => {
  brief = BRIEF;
  failing = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
    if (failing.some((f) => url.includes(f))) return json({ error: "boom" }, false);
    if (url.endsWith("/brief/review") && init?.method === "POST") return json({ kept: [], failed: 0 });
    if (url.includes("/pipeline-link")) return json({ remote: true, live: false, isOwner: brief.isOwner, label: brief.label, prospect: null, options: [] });
    if (url.includes("/brief")) return json(brief);
    if (url.includes("/summarize")) return json({ summary: "Betty wants Acme live before March." });
    if (url.includes("/followup")) return json({ drafts: [] });
    if (url.includes("pitch-score")) return json({ pitch: { id: "p1", repId: "rep1", base: 82.4, bonus: 5, total: 87.4 } });
    if (url.includes("/review?")) return json({ review: null });
    if (url.includes("pitch-recordings?")) return json({ moments: [{ id: "c1", kind: "comment", atSeconds: 5, label: "Max", detail: "Great opener", points: null }], viewerId: "rep1" });
    return json({}, false);
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("MacroCallView", () => {
  it("Highlights: the brief, key points and next steps, and a way into the pipeline", async () => {
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    expect(await screen.findByText("Betty wants Acme live before March.")).toBeTruthy();
    expect(screen.getByText("Needs it live before March")).toBeTruthy();
    expect(screen.getByText("Send the quote Thursday")).toBeTruthy();
    expect(await screen.findByRole("option", { name: "New prospect: Betty – Acme" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add to pipeline/ })).toBeTruthy();
  });

  it("Coaching: the score out of 100 and the manager's comment", async () => {
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    await screen.findByText("Needs it live before March");
    fireEvent.click(screen.getByRole("tab", { name: "Coaching" }));
    expect(await screen.findByText("/ 100")).toBeTruthy();
    expect(screen.getByLabelText("Score 82 out of 100")).toBeTruthy();
    expect(await screen.findByText("Great opener")).toBeTruthy();
  });

  it("Next Meeting: the checklist saves only what the rep kept, as they edited it", async () => {
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    await screen.findByText("Needs it live before March");
    fireEvent.click(screen.getByRole("tab", { name: "Next Meeting" }));
    fireEvent.click(await screen.findByText("Skip to the coach's suggestions"));
    expect(await screen.findByText("Walk through the quote")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Keep: Ask about budget"));
    fireEvent.change(screen.getByDisplayValue("Send quote"), { target: { value: "Send the quote to Betty" } });
    fireEvent.click(screen.getByText("Save checklist to Tasks"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith("/brief/review") && i?.method === "POST")).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/brief/review") && i?.method === "POST")!;
    expect(JSON.parse(init.body)).toEqual({ briefId: "b1", items: [{ text: "Send the quote to Betty", due: "2026-11-26" }] });
  });

  it("Next Meeting ASKS the rep first (§3.3): the coach's agenda is hidden until they answer, and their items lead", async () => {
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    await screen.findByText("Needs it live before March");
    fireEvent.click(screen.getByRole("tab", { name: "Next Meeting" }));
    expect(await screen.findByText(/What do you want to cover with Betty – Acme next time\?/)).toBeTruthy();
    expect(screen.queryByText("Walk through the quote")).toBeNull();
    fireEvent.change(screen.getByLabelText(/What do you want to cover/), { target: { value: "Confirm the go-live date\n\nBring two pricing options" } });
    fireEvent.click(screen.getByText("Add my plan, then show the coach's"));
    expect(await screen.findByText("Walk through the quote")).toBeTruthy();
    expect(screen.getByText("The coach's agenda")).toBeTruthy();
    fireEvent.click(screen.getByText("Save checklist to Tasks"));
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith("/brief/review") && i?.method === "POST")).toBe(true));
    const [, init] = fetchMock.mock.calls.find(([u, i]) => String(u).endsWith("/brief/review") && i?.method === "POST")!;
    expect(JSON.parse(init.body).items.map((x: { text: string }) => x.text)).toEqual([
      "Confirm the go-live date",
      "Bring two pricing options",
      "Send quote",
      "Ask about budget",
    ]);
  });

  it("a manager viewing a rep's call reads it but does not act for the rep (0304)", async () => {
    brief = { ...BRIEF, isOwner: false };
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    expect(await screen.findByText(/the rep adds it from their side/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Add to pipeline/ })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Next Meeting" }));
    expect(await screen.findByText("Walk through the quote")).toBeTruthy(); // no ask-first for a non-owner
    expect(screen.getByText(/Waiting for the rep to review it/)).toBeTruthy();
    expect(screen.queryByText("Save checklist to Tasks")).toBeNull();
  });

  it("always offers the full call page — Macro Mode is never a one-way door", async () => {
    const full = vi.fn();
    render(<MacroCallView sessionId="s1" onFullView={full} />);
    fireEvent.click(await screen.findByText("Show the full call page"));
    expect(full).toHaveBeenCalled();
  });

  // 2026-11-23: a failed read is never shown as "not ready yet" — and never offers a paid re-run.
  it("Coaching: a failed review read says so — no 'Prepare my coaching' (a paid AI run the call may not need)", async () => {
    failing = ["/review?"];
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    await screen.findByText("Needs it live before March");
    fireEvent.click(screen.getByRole("tab", { name: "Coaching" }));
    expect(await screen.findByText(/couldn.t load your coaching/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /prepare my coaching/i })).toBeNull();
  });

  it("Coaching: a failed score read is not 'appears once the call is scored'", async () => {
    failing = ["pitch-score"];
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    await screen.findByText("Needs it live before March");
    fireEvent.click(screen.getByRole("tab", { name: "Coaching" }));
    expect(await screen.findByText(/couldn.t load the score/i)).toBeTruthy();
    expect(screen.queryByText(/appears once the call is scored/i)).toBeNull();
  });

  it("Highlights: a failed call-brief read is not 'appears once the call is transcribed'", async () => {
    failing = ["/summarize"];
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    expect(await screen.findByText(/couldn.t load the call brief/i)).toBeTruthy();
    expect(screen.queryByText(/appears once the call is transcribed/i)).toBeNull();
  });

  it("Coaching: with no review yet (a real 'none'), the rep can prepare it", async () => {
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    await screen.findByText("Needs it live before March");
    fireEvent.click(screen.getByRole("tab", { name: "Coaching" }));
    expect(await screen.findByRole("button", { name: /prepare my coaching/i })).toBeTruthy();
  });
});


describe("Send to CRM (0330 — the PDF's CRM integration, via the company's webhook)", () => {
  const withCrm = (status: number, body: unknown) => {
    const base = fetchMock.getMockImplementation()!;
    const posts: string[] = [];
    fetchMock.mockImplementation((url: string, init?: { method?: string }) => {
      if (url.includes("/send-to-crm")) {
        posts.push(url);
        return Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) });
      }
      return base(url, init);
    });
    return posts;
  };
  it("sends the call once and says where it went; the button can't send it twice", async () => {
    const posts = withCrm(200, { queued: 1 });
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    await screen.findByText("Needs it live before March");
    fireEvent.click(screen.getByRole("button", { name: "Send to CRM" }));
    expect(await screen.findByText(/Sent to your CRM/)).toBeTruthy();
    const sent = screen.getByRole("button", { name: "Sent to CRM" }) as HTMLButtonElement;
    expect(sent.disabled).toBe(true);
    expect(posts).toEqual(["/api/coach/remote/s1/send-to-crm"]);
  });
  it("no CRM connected: the rep reads the server's plain reason and can try again", async () => {
    withCrm(409, { error: "Your company hasn't connected a CRM yet." });
    render(<MacroCallView sessionId="s1" onFullView={() => {}} />);
    await screen.findByText("Needs it live before March");
    fireEvent.click(screen.getByRole("button", { name: "Send to CRM" }));
    expect(await screen.findByText("Your company hasn't connected a CRM yet.")).toBeTruthy();
    await waitFor(() => expect((screen.getByRole("button", { name: "Send to CRM" }) as HTMLButtonElement).disabled).toBe(false));
  });
});
