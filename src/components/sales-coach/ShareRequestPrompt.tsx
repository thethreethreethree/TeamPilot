"use client";

import { useCallback, useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import type { ShareState } from "@/lib/coach/recordings/shareState";

/**
 * The rep's answer to "may the team hear this one?" — guide Step 4, item 7, from the other side.
 *
 * SHIPPED ONE COMMIT AFTER THE ASK, DELIBERATELY NAMED IN BETWEEN. The previous commit built the
 * consent log, the policies and the notification, and its closure.md said plainly what was
 * missing: *"there is no rep-side UI to press Grant or Decline yet… the permission is currently a
 * block, not a dialogue."* A permission a rep cannot grant is not a permission, it is a refusal
 * with extra steps — and a manager who asks and never hears back learns to stop asking rather
 * than to ask better.
 *
 * THE ANSWER GOES THROUGH THE REP'S OWN CLIENT, not a service-role route. 0260's insert policy is
 * `actor_id = auth.uid() AND the pitch is theirs`, so the database is what makes this the rep's
 * yes. The button is a convenience on top of that, never the thing enforcing it.
 *
 * REVOCATION IS ALWAYS AVAILABLE once granted. A consent that cannot be withdrawn is a transfer,
 * and A10's reading is that the subject keeps standing over what the system holds about them.
 */
export function ShareRequestPrompt({ pitchId }: { pitchId: string }) {
  const [share, setShare] = useState<ShareState | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/coach/sales-session/pitch-recordings?pitchId=${encodeURIComponent(pitchId)}`
      );
      if (!res.ok) return;
      const d = (await res.json()) as { share?: ShareState };
      if (d.share) setShare(d.share);
    } catch {
      // Silent. A rep opening their own pitch should not meet an error about a request that in
      // all likelihood does not exist.
    }
  }, [pitchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const answer = async (kind: "granted" | "declined" | "revoked") => {
    if (busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/coach/sales-session/pitch-recordings/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pitchId, kind }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setSaid(d.error ?? "That did not go through.");
      } else {
        // Re-read rather than guess. `shareState` is the authority on what the log now means, and
        // a client that patches its own copy is the second place the verdict gets decided (2.2).
        await load();
        setSaid(
          kind === "granted"
            ? "Thanks — the team can hear this one now. You can take it back any time."
            : kind === "declined"
              ? "Noted. Nobody else will hear it."
              : "Taken back. Nobody else can hear it from now on."
        );
      }
    } catch {
      setSaid("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  // Nothing to say when nobody has asked. Most pitches are in this state and a standing panel
  // would be noise on all of them.
  if (!share || share.status === "none") return null;
  if (share.status === "declined" && !share.requestedAt) return null;

  return (
    <section className="rounded-xl border border-subtle bg-surface p-3">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <Share2 className="h-3.5 w-3.5" aria-hidden />
        Team example
      </h3>

      {share.status === "pending" ? (
        <>
          <p className="mt-1 text-sm text-strong">
            Your manager asked to play this pitch to the team.
            {share.shareable && " It is currently shared while you decide."}
          </p>
          {share.note && <p className="mt-1 text-xs italic text-muted">“{share.note}”</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer("granted")}
              className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-medium text-ink-950 disabled:opacity-50"
            >
              Yes, they can hear it
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer("declined")}
              className="rounded-lg border border-subtle px-3 py-1.5 text-xs text-muted hover:text-strong disabled:opacity-50"
            >
              No thanks
            </button>
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Saying no changes nothing about your score, and your manager is not told why.
          </p>
        </>
      ) : share.shareable ? (
        <>
          <p className="mt-1 text-sm text-strong">The team can hear this pitch.</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void answer("revoked")}
            className="mt-2 rounded-lg border border-subtle px-3 py-1.5 text-xs text-muted hover:text-strong disabled:opacity-50"
          >
            Take it back
          </button>
        </>
      ) : (
        <p className="mt-1 text-sm text-muted">
          {share.status === "revoked"
            ? "You took this one back. Nobody else can hear it."
            : "You said no to this one. Nobody else can hear it."}
        </p>
      )}

      {said && <p className="mt-2 text-xs text-muted">{said}</p>}
    </section>
  );
}
