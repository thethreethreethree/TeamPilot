// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

import { ConsentCheck, ConsentStatus, confirmRecordingConsent, CONSENT_LINE } from "../RecordingConsent";

/**
 * Recording consent on phone/video calls (founder 2026-11-22: "Rep confirms at Start"). Pinned 2026-11-23: the check
 * says what the rep is confirming and gives a line to say; the confirmation is stored per call with how it was given,
 * and a failed save throws (the caller must not treat it as stored); the call page says whether consent is on record.
 */
const fetchMock = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(cleanup);

describe("the consent check", () => {
  it("before a live call: present tense, with a line to say", () => {
    render(<ConsentCheck checked={false} onChange={() => {}} />);
    expect(screen.getByText(/the prospect knows this call is recorded/i)).toBeTruthy();
    expect(screen.getByText(new RegExp(CONSENT_LINE.slice(0, 30)))).toBeTruthy();
  });

  it("for an upload: past tense, no script", () => {
    render(<ConsentCheck checked={false} onChange={() => {}} past />);
    expect(screen.getByText(/the prospect knew this call was recorded/i)).toBeTruthy();
    expect(screen.queryByText(/say something like/i)).toBeNull();
  });

  it("ticking it reports true", () => {
    const onChange = vi.fn();
    render(<ConsentCheck checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe("storing the confirmation", () => {
  it("posts it for this call, with how it was given", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await confirmRecordingConsent("s 1", "upload");
    expect(fetchMock).toHaveBeenCalledWith("/api/coach/remote/s%201/consent", expect.objectContaining({ method: "POST", body: JSON.stringify({ how: "upload" }) }));
  });

  it("a failed save throws, with the server's reason", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ error: "Only the rep who took this call can confirm." }) });
    await expect(confirmRecordingConsent("s1", "live")).rejects.toThrow(/only the rep/i);
  });
});

describe("consent on the call page", () => {
  it("says when the rep confirmed it, and how", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ confirmed: { at: "2026-11-22T10:00:00Z", how: "live" } }) });
    render(<ConsentStatus sessionId="s1" />);
    expect(await screen.findByText(/confirmed by the rep at the start/i)).toBeTruthy();
  });

  it("says plainly when there is no confirmation on record", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ confirmed: null }) });
    render(<ConsentStatus sessionId="s1" />);
    expect(await screen.findByText(/no recording-consent confirmation on record/i)).toBeTruthy();
  });

  it("a failed read claims nothing either way", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    const { container } = render(<ConsentStatus sessionId="s1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 0));
    expect(container.textContent).toBe("");
  });
});
