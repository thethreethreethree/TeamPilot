"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Remote Sales Macro Mode — the rep's own switch (0303), read once per screen and kept in sync across the shell, the
 * call page and the toggle through one window event (the pattern Sales Coach's Macro Mode uses, its own event name).
 * `enabled` is null while loading: callers render the full module until the answer arrives, never a guess.
 * The write is optimistic and corrected by what the database returns.
 */
const EVENT = "elostate:remote-macro-mode";

export function useRemoteMacroMode() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/coach/remote/macro-mode", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d: { enabled?: boolean }) => live && setEnabled(Boolean(d.enabled)))
      .catch(() => live && setEnabled(false));
    const on = (e: Event) => setEnabled(Boolean((e as CustomEvent).detail));
    window.addEventListener(EVENT, on);
    return () => {
      live = false;
      window.removeEventListener(EVENT, on);
    };
  }, []);

  const setMode = useCallback(async (next: boolean) => {
    setSaving(true);
    setError(null);
    window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    try {
      const r = await fetch("/api/coach/remote/macro-mode", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const d = (await r.json().catch(() => ({}))) as { enabled?: boolean; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Could not save Macro Mode.");
      window.dispatchEvent(new CustomEvent(EVENT, { detail: Boolean(d.enabled) }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent(EVENT, { detail: !next }));
      setError(e instanceof Error ? e.message : "Could not save Macro Mode.");
    } finally {
      setSaving(false);
    }
  }, []);

  return { enabled, saving, error, setMode };
}
