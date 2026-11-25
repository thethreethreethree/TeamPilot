"use client";

import { useCallback, useEffect, useState } from "react";
import { EyeOff } from "lucide-react";

/**
 * On a call's page (0337, F33.8): if a company phrase hides this call, say so. Someone it's hidden from reads why
 * ("the reason shown") — the call itself the database won't give them. The rep and admins read that others can't see
 * it; an admin can unhide. Renders nothing for a call that isn't hidden, or if the check fails.
 */
type R = { hidden: boolean; phrases: string[]; canSee: boolean; hides: Array<{ id: string; phrase: string }> };

export function HiddenCallNotice({ sessionId }: { sessionId: string }) {
  const [r, setR] = useState<R | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const url = `/api/coach/remote/${encodeURIComponent(sessionId)}/hidden`;
  const load = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) setR((await res.json()) as R);
    } catch {
      /* the notice is information; the database still enforces the hide */
    }
  }, [url]);
  useEffect(() => {
    void load();
  }, [load]);
  if (!r?.hidden) return null;
  const said = r.phrases.map((p) => `“${p}”`).join(", ");
  if (!r.canSee)
    return (
      <p role="status" className="flex items-center gap-2 rounded-xl border border-default bg-surface p-4 text-sm text-secondary">
        <EyeOff className="h-4 w-4" aria-hidden /> This call is hidden by a company rule (it contains {said}). Only its rep and company admins can open it.
      </p>
    );
  return (
    <div role="status" className="rounded-xl border border-amber-500/50 bg-surface p-3 text-xs text-secondary">
      <p className="flex items-center gap-2">
        <EyeOff className="h-4 w-4 text-amber-700 dark:text-amber-300" aria-hidden />
        Hidden from managers and teammates — it contains {said}. Only you{r.hides.length ? ", the rep" : ""} and company admins can open it.
      </p>
      {r.hides.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {r.hides.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={async () => {
                const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ hideId: h.id }) });
                setMsg(res.ok ? `Unhidden for “${h.phrase}”.` : "Couldn't unhide it.");
                await load();
              }}
              className="rounded-lg border border-default px-2 py-1 text-primary hover:border-brand"
            >
              Unhide (“{h.phrase}”)
            </button>
          ))}
        </div>
      )}
      {msg && <p className="mt-1">{msg}</p>}
    </div>
  );
}
