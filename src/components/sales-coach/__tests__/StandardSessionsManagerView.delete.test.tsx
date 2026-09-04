// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { StandardSessionsManagerView } from "../StandardSessionsManagerView";

/**
 * Deleting a recording, from the manager's side.
 *
 * This is the only destructive control in the Sales Coach area, and destructive controls fail in a way the rest of
 * this screen does not: being briefly wrong about a Save costs nothing, but telling a manager a customer's audio
 * has been deleted when it has NOT is something they might repeat to the customer.
 *
 * So two properties are pinned here and neither is cosmetic:
 *   1. the row changes only AFTER the server confirms — no optimistic delete;
 *   2. the confirmation says what survives, because the usual hesitation is not about the audio at all.
 */

const MEMBERS = [{ id: "rep-a", fullName: "Knute Knudtson", companyRole: "staff", salesCoachRole: "staff" }];
const SESSION = {
  id: "s1",
  clientLabel: "Mrs Patel, 14 Oak Road",
  startedAt: "2026-09-01T10:00:00.000Z",
  status: "reviewed",
  hasAudio: true,
  saved: false,
};

function mockFetch(deleteResponse: { ok: boolean; status?: number; body?: unknown }) {
  const calls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string }) => {
      const u = String(url);
      calls.push(`${init?.method ?? "GET"} ${u}`);
      if (u.includes("delete-recording")) {
        return {
          ok: deleteResponse.ok,
          status: deleteResponse.status ?? (deleteResponse.ok ? 200 : 500),
          json: async () => deleteResponse.body ?? { deleted: true },
        };
      }
      if (u.includes("rep-activity")) {
        return { ok: true, status: 200, json: async () => ({ sessions: [SESSION], savingAvailable: true, windowDays: 30 }) };
      }
      if (u.includes("team-activity")) {
        return { ok: true, status: 200, json: async () => ({ byAgent: {}, windowDays: 30 }) };
      }
      return { ok: true, status: 200, json: async () => ({ members: MEMBERS, isManager: true }) };
    }),
  );
  return calls;
}

async function openTheRep() {
  render(<StandardSessionsManagerView fallback={<div>rep self-view</div>} />);
  const rep = await waitFor(() => screen.getByText(/Knute Knudtson/));
  fireEvent.click(rep);
  return await waitFor(() => screen.getByText(/Mrs Patel/));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("deleting a recording", () => {
  it("asks first, and the question says what SURVIVES — not just what is lost", async () => {
    mockFetch({ ok: true });
    await openTheRep();
    fireEvent.click(screen.getByLabelText(/Delete the recording of Mrs Patel/i));

    expect(screen.getByText(/Delete this recording\?/i)).toBeTruthy();
    // The hesitation this answers is "does deleting the audio wipe the rep's scores?" It does not, and a bare
    // "Are you sure?" could never say so.
    expect(screen.getByText(/transcript and the scores stay/i)).toBeTruthy();
  });

  it("does NOT delete on the first click — one click is a mis-tap, not an instruction", async () => {
    const calls = mockFetch({ ok: true });
    await openTheRep();
    fireEvent.click(screen.getByLabelText(/Delete the recording of Mrs Patel/i));
    expect(calls.some((c) => c.includes("delete-recording"))).toBe(false);
  });

  it("removes the recording from the row only after the server confirms", async () => {
    mockFetch({ ok: true });
    await openTheRep();
    fireEvent.click(screen.getByLabelText(/Delete the recording of Mrs Patel/i));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => expect(screen.getByText(/no recording/i)).toBeTruthy());
  });

  it("keeps the recording on screen when the delete FAILS, and says the server changed nothing", async () => {
    // The property that matters most: a manager must never be told a customer's audio is gone when it is not.
    mockFetch({ ok: false, status: 500, body: { error: "Couldn't delete the recording. Nothing was changed." } });
    await openTheRep();
    fireEvent.click(screen.getByLabelText(/Delete the recording of Mrs Patel/i));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
    expect(screen.getByRole("alert").textContent).toMatch(/Nothing was changed/i);
    expect(screen.getByText(/🎙 recording/)).toBeTruthy();
  });

  it("carries the server's OWN sentence through — a 409 is not 'try again'", async () => {
    // A 409 means the stored pointer could not be interpreted and a person has to look at it. Collapsing that
    // into a generic retry message would send a manager round a loop that cannot succeed.
    mockFetch({
      ok: false,
      status: 409,
      body: { error: "This recording is stored in a way we cannot delete automatically. It has been flagged." },
    });
    await openTheRep();
    fireEvent.click(screen.getByLabelText(/Delete the recording of Mrs Patel/i));
    fireEvent.click(screen.getByText("Delete"));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/cannot delete automatically/i));
  });

  it("can be backed out of", async () => {
    const calls = mockFetch({ ok: true });
    await openTheRep();
    fireEvent.click(screen.getByLabelText(/Delete the recording of Mrs Patel/i));
    fireEvent.click(screen.getByRole("button", { name: /Keep it/i }));

    await waitFor(() => expect(screen.queryByText(/Delete this recording\?/i)).toBeNull());
    expect(calls.some((c) => c.includes("delete-recording"))).toBe(false);
  });
});
