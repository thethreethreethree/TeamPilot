// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { PatternActions } from "../PatternActions";
import type { PatternRow } from "@/lib/coach/patterns/readPatterns";

/**
 * The four manager actions, the rep's reply, and the notes they share.
 *
 * What these pin is the set of states in which a correct-looking panel would break a promise the
 * product makes in its own banner — *"Reps see their own Pattern Interrupt page, clips and your
 * notes included, so nothing here is a surprise."*
 *
 *   · a manager writing a note with no warning that the rep will read it
 *   · a rep able to mark their own pattern coached, which makes Stalled unfalsifiable
 *   · a rep asked to acknowledge coaching nobody gave them ("1 of 0")
 *   · a button that looks live and does nothing
 *   · a client that patches its own copy of the log instead of re-reading it
 */

const fetchMock = vi.fn();

const ev = (kind: string, at: string, body: string | null, actorId: string | null = "mgr-1") => ({
  kind,
  at,
  actorId,
  body,
});

const pattern = (over: Partial<PatternRow> = {}): PatternRow =>
  ({
    id: "p1",
    repId: "rep-1",
    itemId: "intro.trucks",
    itemKind: "element",
    label: "Opens with a question instead of the neighborhood notice",
    section: "INTRODUCTION · TRUCKS / NEIGHBORHOOD NOTICE",
    firstSeen: "2026-09-14T10:00:00Z",
    missesAtDetection: 5,
    applicableAtDetection: 7,
    costPerPitch: 2.1,
    strip: [],
    coachedAt: null,
    fixedAt: null,
    repReviewed: false,
    events: [],
    verdict: { status: "new", open: true, reason: "Detected, not coached yet", streak: 0, comparison: null },
    daysOpen: 5,
    ...over,
  }) as PatternRow;

const onWritten = vi.fn();

const view = (over: Partial<PatternRow> = {}, opts: { isManager?: boolean; viewerId?: string | null } = {}) =>
  render(
    <PatternActions
      pattern={pattern(over)}
      isManager={opts.isManager ?? true}
      viewerId={opts.viewerId === undefined ? "mgr-1" : opts.viewerId}
      nameByActor={{ "mgr-1": "Dana Reyes", "rep-1": "Humza Khan" }}
      onWritten={onWritten}
    />
  );

beforeEach(() => {
  vi.clearAllMocks();
  fetchMock.mockImplementation(async () => ({ ok: true, json: async () => ({ event: {}, closed: false }) }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("coaching notes", () => {
  it("shows a manager's note and the rep's reply as peer entries, as the board draws them", () => {
    view({
      events: [
        ev("coached", "2026-09-18T10:00:00Z", "Say the opener out loud 10 times before your first door tomorrow."),
        ev("rep_reviewed", "2026-09-18T15:00:00Z", "Reviewed. Running it before shifts this week.", "rep-1"),
      ],
    });
    expect(screen.getByText(/Say the opener out loud 10 times/)).toBeTruthy();
    expect(screen.getByText(/Running it before shifts this week/)).toBeTruthy();
    expect(screen.getByText(/Dana Reyes · Sep 18/)).toBeTruthy();
    expect(screen.getByText(/Humza Khan · Sep 18/)).toBeTruthy();
  });

  it("shows an event WITHOUT a body nowhere in the notes", () => {
    // A note is an event with a body. "Mark as coached" pressed with nothing typed is a marker
    // on the timeline and not a blank entry in a list of things people said.
    view({ events: [ev("coached", "2026-09-18T10:00:00Z", null)] });
    expect(screen.getByText(/Nothing written down yet/i)).toBeTruthy();
  });

  it("tells a manager an empty list means the rep has been told nothing", () => {
    view();
    expect(screen.getByText(/A note here is shown to the rep/i)).toBeTruthy();
  });

  it("tells a rep the same fact from their side", () => {
    view({}, { isManager: false, viewerId: "rep-1" });
    expect(screen.getByText(/has not written anything about this one yet/i)).toBeTruthy();
  });
});

describe("what a manager can do", () => {
  it("offers the board's four buttons", () => {
    view();
    for (const name of [/Assign Role Play drill/i, /Add note/i, /Mark as coached/i, /Schedule check-in/i]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("warns BEFORE the write that the rep will read it", () => {
    // The banner on this page already promises it. Repeating it at the point of writing is the
    // difference between a promise and a warning (A10).
    view();
    expect(screen.getByText(/visible to the rep on their own Pattern Interrupt page/i)).toBeTruthy();
  });

  it("posts 'coached' and then RE-READS rather than patching its own copy", async () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: /Mark as coached/i }));
    await waitFor(() => {
      const [, init] = fetchMock.mock.calls[0]!;
      expect(JSON.parse(String(init.body))).toMatchObject({ patternId: "p1", kind: "coached" });
      // The status changes as a result of this write, and the server owns that derivation.
      expect(onWritten).toHaveBeenCalled();
    });
  });

  it("will not send an empty note", () => {
    view();
    expect(screen.getByRole("button", { name: /Add note/i })).toHaveProperty("disabled", true);
  });

  it("sends the typed body with the note", async () => {
    view();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Notice first, question second." } });
    fireEvent.click(screen.getByRole("button", { name: /Add note/i }));
    await waitFor(() => {
      const [, init] = fetchMock.mock.calls[0]!;
      expect(JSON.parse(String(init.body))).toMatchObject({ kind: "note", body: "Notice first, question second." });
    });
  });

  it("disables Schedule check-in and says why, rather than doing nothing quietly", () => {
    view();
    const btn = screen.getByRole("button", { name: /Schedule check-in/i });
    expect(btn).toHaveProperty("disabled", true);
    expect(btn.getAttribute("title")).toMatch(/creates no calendar event/i);
  });

  it("surfaces a refusal from the server instead of pretending it worked", async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, json: async () => ({ error: "That is not yours to record." }) }));
    view();
    fireEvent.click(screen.getByRole("button", { name: /Mark as coached/i }));
    expect(await screen.findByText(/That is not yours to record/i)).toBeTruthy();
    expect(onWritten).not.toHaveBeenCalled();
  });
});

describe("what a rep can do on their own pattern", () => {
  const AS_REP = { isManager: false, viewerId: "rep-1" } as const;

  it("gets no manager actions at all", () => {
    view({}, AS_REP);
    expect(screen.queryByRole("button", { name: /Mark as coached/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /Assign Role Play drill/i })).toBeNull();
  });

  it("can reply and can flag a clip", () => {
    view({}, AS_REP);
    expect(screen.getByRole("button", { name: /Reply/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /This looks wrong/i })).toBeTruthy();
  });

  it("is NOT asked to acknowledge coaching nobody gave them", () => {
    // The Rep reviewed tile counts against COACHED patterns. Acknowledging an uncoached one
    // would produce "1 of 0".
    view({ coachedAt: null }, AS_REP);
    expect(screen.queryByRole("button", { name: /^Reviewed$/i })).toBeNull();
  });

  it("is asked once coaching has happened", async () => {
    view({ coachedAt: "2026-09-18T10:00:00Z" }, AS_REP);
    const btn = screen.getByRole("button", { name: /^Reviewed$/i });
    fireEvent.click(btn);
    await waitFor(() => {
      const [, init] = fetchMock.mock.calls[0]!;
      expect(JSON.parse(String(init.body))).toMatchObject({ kind: "rep_reviewed" });
    });
  });

  it("is not asked twice", () => {
    view({ coachedAt: "2026-09-18T10:00:00Z", repReviewed: true }, AS_REP);
    expect(screen.queryByRole("button", { name: /^Reviewed$/i })).toBeNull();
  });

  it("names their own entry rather than showing them a uuid", () => {
    view({ events: [ev("note", "2026-09-18T10:00:00Z", "Got it.", "rep-1")] }, AS_REP);
    expect(screen.getByText(/Humza Khan · Sep 18/)).toBeTruthy();
  });
});

describe("somebody else's pattern", () => {
  it("shows the notes and offers no composer", () => {
    // A manager viewing a rep's pattern gets the manager actions; a rep who somehow reaches
    // another rep's pattern gets neither set. RLS makes this unreachable in practice — the panel
    // not offering a box the server would refuse is the surface agreeing with the rule.
    view({ events: [ev("note", "2026-09-18T10:00:00Z", "A note.")] }, { isManager: false, viewerId: "someone-else" });
    expect(screen.getByText("A note.")).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

describe("from the tape", () => {
  it("links a manager to the recordings, which now exist", () => {
    view();
    const link = screen.getByRole("link", { name: /Open the recordings/i });
    expect(link.getAttribute("href")).toBe("/dashboard/sales-coach/coach-assessment");
  });

  it("sends a rep to their own", () => {
    view({}, { isManager: false, viewerId: "rep-1" });
    expect(screen.getByRole("link", { name: /Open your recordings/i })).toBeTruthy();
  });
});
