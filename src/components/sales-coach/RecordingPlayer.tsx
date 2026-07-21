"use client";

import { useCallback, useState } from "react";
import { Play, RotateCw } from "lucide-react";

/**
 * RecordingPlayer — plays a session's call recording (founder decision 2026-07-21: playback was the
 * missing piece; audio was stored + purged but nothing could play it).
 *
 * Lazy by design: it does NOT sign a URL until the user taps Play, so opening a session never mints a
 * signed URL for audio nobody listens to. §3.4 honest states: "no audio" (transcript-only or purged) is
 * distinct from a load error. The route (/recording-url) enforces owner-or-manager access.
 */
export function RecordingPlayer({ sessionId }: { sessionId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "ready" | "none" | "error"
  >("idle");

  const load = useCallback(async () => {
    setState("loading");
    try {
      const r = await fetch(
        `/api/coach/sales-session/${sessionId}/recording-url`
      );
      if (r.status === 404) {
        setState("none");
        return;
      }
      if (!r.ok) {
        setState("error");
        return;
      }
      const d = await r.json();
      if (d?.url) {
        setUrl(d.url as string);
        setState("ready");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  }, [sessionId]);

  if (state === "ready" && url) {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption -- a live sales call recording has no caption track.
      <audio controls src={url} preload="none" className="w-full mt-2" />
    );
  }

  if (state === "none") {
    return (
      <p className="text-[11px] text-muted mt-2">
        No audio for this call — it was transcript-only, or the recording was cleared after 2 days.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void load()}
      disabled={state === "loading"}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary hover:bg-white/[0.03] disabled:opacity-50 transition-colors"
    >
      {state === "error" ? (
        <>
          <RotateCw className="w-3.5 h-3.5" aria-hidden /> Couldn&apos;t load — retry
        </>
      ) : (
        <>
          <Play className="w-3.5 h-3.5" aria-hidden />
          {state === "loading" ? "Loading…" : "Play recording"}
        </>
      )}
    </button>
  );
}
