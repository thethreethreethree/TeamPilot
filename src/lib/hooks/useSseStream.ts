"use client";

import { useCallback, useRef, useState } from "react";

/**
 * useSseStream — minimal SSE consumer for chat AI features.
 *
 * One responsibility: POST a JSON body to an SSE route, accumulate
 * `delta` events into a single `text` buffer, surface `gate` (§3.4
 * control window) and `error` events as discrete states. No partial
 * JSON parsing — that lives in callers that expect JSON. Keeps the
 * three chat AI surfaces (guide / formulate / summarize) free of
 * SSE plumbing duplication.
 *
 * State machine:
 *   idle      — nothing started
 *   streaming — at least one delta has arrived (or request in flight)
 *   suppressed — backend returned a `gate` event with suppressed:true
 *   done      — stream completed normally
 *   error     — stream failed (network, provider, parse)
 *
 * abort() — cancels the in-flight fetch (used by modal-close).
 */

export type SseState =
  | { state: "idle"; text: "" }
  | { state: "streaming"; text: string }
  | {
      state: "suppressed";
      text: string;
      reason: string;
    }
  | { state: "done"; text: string }
  | {
      state: "error";
      text: string;
      error: string;
      kind?: string;
      provider?: string;
    };

export function useSseStream() {
  const [status, setStatus] = useState<SseState>({ state: "idle", text: "" });
  const abortRef = useRef<AbortController | null>(null);

  const abort = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const reset = useCallback(() => {
    abort();
    setStatus({ state: "idle", text: "" });
  }, [abort]);

  const run = useCallback(
    async (url: string, body: unknown) => {
      abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setStatus({ state: "streaming", text: "" });
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          let msg = `HTTP ${res.status}`;
          try {
            const j = await res.json();
            if (j?.error) msg = j.error;
          } catch {
            /* ignore */
          }
          setStatus({ state: "error", text: "", error: msg });
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";
        let suppressedReason: string | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          // Split into SSE events on the double-newline boundary.
          let idx;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            let evt = "message";
            let dataLine = "";
            for (const line of raw.split("\n")) {
              const t = line.trim();
              if (t.startsWith("event:")) evt = t.slice(6).trim();
              else if (t.startsWith("data:")) dataLine += t.slice(5).trim();
            }
            if (!dataLine) continue;
            let payload: Record<string, unknown> = {};
            try {
              payload = JSON.parse(dataLine);
            } catch {
              continue;
            }
            if (evt === "delta") {
              const t = (payload.text as string) ?? "";
              accumulated += t;
              setStatus({ state: "streaming", text: accumulated });
            } else if (evt === "gate") {
              suppressedReason =
                (payload.reason as string) ?? "Guidance is suppressed.";
            } else if (evt === "done") {
              if (suppressedReason) {
                setStatus({
                  state: "suppressed",
                  text: accumulated,
                  reason: suppressedReason,
                });
              } else {
                setStatus({ state: "done", text: accumulated });
              }
              return;
            } else if (evt === "error") {
              setStatus({
                state: "error",
                text: accumulated,
                error: (payload.error as string) ?? "Stream error",
                kind: payload.kind as string | undefined,
                provider: payload.provider as string | undefined,
              });
              return;
            }
          }
        }
        // Stream ended without an explicit `done` — treat what we have.
        setStatus(
          suppressedReason
            ? { state: "suppressed", text: accumulated, reason: suppressedReason }
            : { state: "done", text: accumulated }
        );
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          // User-initiated cancel — go back to idle, don't surface as error.
          setStatus({ state: "idle", text: "" });
          return;
        }
        setStatus({
          state: "error",
          text: "",
          error: err instanceof Error ? err.message : "Network error",
        });
      } finally {
        abortRef.current = null;
      }
    },
    [abort]
  );

  return { status, run, abort, reset };
}
