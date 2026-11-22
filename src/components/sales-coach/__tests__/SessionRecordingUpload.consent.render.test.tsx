// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ storage: { from: () => ({}) } }) }));
vi.mock("@/components/learning/LearningHint", () => ({ LearningHint: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
const consent = vi.hoisted(() => ({ fail: false, calls: [] as Array<[string, string]> }));
vi.mock("@/components/remote-sales/RecordingConsent", async (orig) => ({
  ...((await orig()) as object),
  confirmRecordingConsent: vi.fn(async (id: string, how: string) => {
    consent.calls.push([id, how]);
    if (consent.fail) throw new Error("Couldn't record that the prospect agreed.");
  }),
}));

import { SessionRecordingUpload } from "../SessionRecordingUpload";

/**
 * Uploading a phone/video call's recording (founder 2026-11-22: the rep confirms the prospect knew). Pinned 2026-11-23:
 * the upload button is disabled until the box is ticked; the confirmation is stored BEFORE any upload starts, and if it
 * can't be stored nothing is uploaded and the rep is told why. In-person uploads are not asked.
 */
const fetchMock = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
beforeEach(() => {
  vi.clearAllMocks();
  consent.fail = false;
  consent.calls = [];
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

const button = () => screen.getByRole("button", { name: /upload recording/i }) as HTMLButtonElement;
const pick = (container: HTMLElement) => {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "call.m4a", { type: "audio/mp4" })] } });
};

describe("uploading a remote call's recording", () => {
  it("is disabled until the rep confirms the prospect knew", () => {
    render(<SessionRecordingUpload sessionId="s1" onLabeled={() => {}} requireConsent />);
    expect(button().disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(button().disabled).toBe(false);
  });

  it("stores the confirmation for this call before anything is uploaded", async () => {
    const { container } = render(<SessionRecordingUpload sessionId="s1" onLabeled={() => {}} requireConsent />);
    fireEvent.click(screen.getByRole("checkbox"));
    pick(container);
    await waitFor(() => expect(consent.calls).toEqual([["s1", "upload"]]));
  });

  it("if the confirmation can't be stored, nothing is uploaded and the rep is told", async () => {
    consent.fail = true;
    const { container } = render(<SessionRecordingUpload sessionId="s1" onLabeled={() => {}} requireConsent />);
    fireEvent.click(screen.getByRole("checkbox"));
    pick(container);
    expect(await screen.findByText(/couldn.t record that the prospect agreed/i)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("an in-person upload asks nothing and stores no confirmation", async () => {
    const { container } = render(<SessionRecordingUpload sessionId="s1" onLabeled={() => {}} />);
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(button().disabled).toBe(false);
    pick(container);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(consent.calls).toEqual([]);
  });
});
