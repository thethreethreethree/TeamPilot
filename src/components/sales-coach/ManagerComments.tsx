"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import type { KeyMoment } from "@/lib/coach/recordings/keyMoments";

/**
 * The rep's half of guide Step 4, item 6.
 *
 *     "Save and send to rep" notifies the rep and shows the comment in their Pitch detail.
 *
 * THIS COMPONENT IS THE CLAUSE AFTER THE COMMA. The manager's half — the textarea and the two
 * buttons — is in `RecordingsTab`, and building only that half is the A31 failure this build
 * named in its own think.md before starting: *"writing recording_comments without wiring the
 * rep's Pitch detail to read them would be a feature that exists in the database and nowhere a
 * rep can see."* A notification that links to a page which does not show the comment is worse
 * than no notification, because the rep knows something was said and cannot read it.
 *
 * IT READS THE SAME ROUTE THE MANAGER'S PLAYER READS, and that is the point rather than an
 * economy. `recording_comments`'s policy grants a rep only the comments on their own pitch that
 * were SENT; an unsent draft is invisible to them at the database. So the surface does not filter
 * — a second copy of "which comments may this person see" is exactly the duplicated condition
 * that drifts (2.2). The policy decides; this renders what came back.
 */
export function ManagerComments({ pitchId }: { pitchId: string }) {
  const [comments, setComments] = useState<KeyMoment[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    fetch(`/api/coach/sales-session/pitch-recordings?pitchId=${encodeURIComponent(pitchId)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { moments?: KeyMoment[] }) => {
        if (!live) return;
        setComments((d.moments ?? []).filter((m) => m.kind === "comment"));
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [pitchId]);

  // NOTHING WHEN THERE IS NOTHING. Most pitches have no manager comment, and an empty
  // "Your manager said" panel on every one of them would train a rep to stop looking at the one
  // that matters. A failed read is silent for the same reason: a red error where a rep expects a
  // score is alarming about the wrong thing.
  if (failed || !comments || comments.length === 0) return null;

  const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        From your manager
      </h3>
      <ul className="space-y-2">
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl border border-subtle bg-surface p-3">
            <p className="text-[11px] tabular-nums text-muted">
              {c.atSeconds !== null ? `At ${clock(c.atSeconds)}` : "On this pitch"} · {c.label}
            </p>
            <p className="mt-1 text-sm text-strong">{c.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
