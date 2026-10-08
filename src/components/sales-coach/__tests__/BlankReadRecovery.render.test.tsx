// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/components/sales-coach/SessionRecordingUpload", () => ({ SessionRecordingUpload: () => null }));

import { BlankReadRecovery } from "../BlankReadRecovery";

/**
 * "Whose voice is on this recording?" (2026-10-08). On a call recovery saved as all 'unknown' with TWO voices, the
 * card must ask which voice is the rep — one line from each — and send { agentCluster }. The old card asked "is
 * this you?" once and "That's me" made the customer's lines the rep's.
 */
const twoVoices = [
  { speaker: "unknown", text: "Hi, I'm with Elostate.", seq: 0, source: null, speaker_cluster: "speaker_0" },
  { speaker: "unknown", text: "What does it cost?", seq: 1, source: null, speaker_cluster: "speaker_1" },
  { speaker: "unknown", text: "Fifty a month.", seq: 2, source: null, speaker_cluster: "speaker_0" },
];
const oneVoice = [{ speaker: "unknown", text: "Hi, I'm with Elostate.", seq: 0, source: null, speaker_cluster: null }];

let posted: unknown[];
function serve(segments: unknown[]) {
  posted = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === "POST") {
        posted.push(JSON.parse(init.body ?? "{}"));
        return new Response(JSON.stringify({ status: "attributed" }), { status: 200 });
      }
      return new Response(JSON.stringify({ segments }), { status: 200 });
    })
  );
}
const props = {
  sessionId: "sess1",
  gap: "agent-missing" as const,
  hasSavedRecording: true,
  autoRecovering: false,
  autoRecoverResolved: true,
  autoRecoverOutcome: null,
  onRecovered: vi.fn(),
};

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("BlankReadRecovery — whose voice", () => {
  it("two voices: shows a line from each and sends the picked voice", async () => {
    serve(twoVoices);
    render(<BlankReadRecovery {...props} />);
    expect(await screen.findByText("Which of these voices is you?")).toBeTruthy();
    expect(screen.getByText(/Hi, I'm with Elostate\./)).toBeTruthy();
    expect(screen.getByText(/What does it cost\?/)).toBeTruthy();
    expect(screen.queryByText("That’s me")).toBeNull(); // never the one-voice answer for every line
    const second = screen.getAllByRole("button", { name: "This one is me" })[1];
    expect(second).toBeTruthy();
    fireEvent.click(second as HTMLElement);
    await waitFor(() => expect(posted).toEqual([{ agentCluster: "speaker_1" }]));
  });

  it("two voices: 'None of these is me' marks the call customer-only", async () => {
    serve(twoVoices);
    render(<BlankReadRecovery {...props} />);
    fireEvent.click(await screen.findByRole("button", { name: "None of these is me" }));
    await waitFor(() => expect(posted).toEqual([{ mine: false }]));
  });

  it("one voice: the one-voice question, answered with mine", async () => {
    serve(oneVoice);
    render(<BlankReadRecovery {...props} />);
    expect(await screen.findByText("Whose voice is on this recording?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "That’s me" }));
    await waitFor(() => expect(posted).toEqual([{ mine: true }]));
  });
});
