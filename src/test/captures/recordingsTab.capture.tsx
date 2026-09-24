// @vitest-environment jsdom
import { describe, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import { capture, stubBrowserApis } from "@/test/visual";
import RecordingsTab from "@/components/sales-coach/RecordingsTab";

/**
 * The manager's Recordings panel — the surface a partner asked about.
 *
 * Rendered ad hoc on 2026-09-24 in DARK only, and that render found a crash: `MARKER[m.kind].dot`
 * threw on `rejected_bonus`, a value the database has allowed since migration 0254, and the whole
 * tab rendered nothing. Five thousand tests passed through that.
 *
 * It has never been seen in LIGHT. The fixture below deliberately includes a rejected bonus, so
 * this capture also stands as the visual half of that fix.
 */

const fetchMock = vi.fn();

const row = (over: Record<string, unknown> = {}) => ({
  pitchId: "p1",
  repId: "rep1",
  recordedAt: "2026-09-19T15:52:00.000Z",
  durationS: 480,
  outcome: "sold",
  total: 61.5,
  band: "Solid",
  qualifying: true,
  notQualifyingReason: null,
  patternMoments: 3,
  hasAudio: true,
  ...over,
});

const detail = {
  pitchId: "p1",
  repId: "rep1",
  recordedAt: "2026-09-19T15:52:00.000Z",
  durationS: 480,
  audioUrl: null,
  total: 61.5,
  base: 58.5,
  bonus: 5,
  violations: 2,
  band: "Solid",
  outcome: "sold",
  moments: [
    { id: "m1", kind: "missed", atSeconds: 442, label: "Trucks in the area", detail: "Never mentioned", points: -3 },
    { id: "m2", kind: "bonus", atSeconds: 96, label: "Named the neighbour", detail: null, points: 5 },
    { id: "m3", kind: "rejected_bonus", atSeconds: 130, label: "Gets inside the house or backyard", detail: "Heard at 0.62 confidence, under the 0.80 floor.", points: 0 },
  ],
  coverage: { total: 4, placeable: 3, unplaced: 1 },
  lines: [{ atSeconds: 442, speaker: "agent", text: "So anyway, that's the offer." }],
  linesApproximate: true,
  share: { shareable: false, status: "none", requestedAt: null, answeredAt: null, note: null },
  viewerId: "mgr1",
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});

describe("capture", () => {
  it("recordings tab, manager view", async () => {
    stubBrowserApis();
    fetchMock.mockImplementation(async (input: unknown) => {
      if (String(input).includes("pitchId=")) return { ok: true, json: async () => detail };
      return {
        ok: true,
        json: async () => ({
          rows: [
            row(),
            row({ pitchId: "p2", total: 44, qualifying: false, notQualifyingReason: "base_under_40", outcome: "no_sale", patternMoments: 1 }),
            row({ pitchId: "p3", total: 82.5, band: "Strong", outcome: "follow_up", hasAudio: false, patternMoments: 0 }),
          ],
          capped: true,
          total: 412,
        }),
      };
    });

    const { container } = render(<RecordingsTab repId="rep1" isManager />);
    await screen.findByText(/Recent recordings/i);
    await waitFor(() => screen.getByText(/click to jump/i));

    // 1180px — the desktop width this panel's two-column grid is designed around.
    capture("recordings-tab", container.firstElementChild as HTMLElement, { width: 1180, height: 1000 });
  });
});
