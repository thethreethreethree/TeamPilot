"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Activity, Loader2, MessageCircle } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

type LiveVisitor = {
  visitorId: string;
  page: string | null;
  conversationId: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
};

const POLL_MS = 5000;

/** "just now" / "12s ago" / "3m ago" — presence is second-scale, so keep it tight. */
function ago(iso: string): string {
  const secs = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (secs < 5) return "just now";
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  return `${mins}m ago`;
}

/** Host page shown as a readable label: path + host, falling back to the raw string. */
function pageLabel(page: string | null): string {
  if (!page) return "Unknown page";
  try {
    const u = new URL(page);
    return `${u.host}${u.pathname}`;
  } catch {
    return page;
  }
}

export default function CareMonitorPage() {
  const [visitors, setVisitors] = useState<LiveVisitor[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Keep the latest interval callback stable without resetting the timer each render.
  const timerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/care/monitor/visitors");
      if (!res.ok) {
        setError("Couldn't load live visitors.");
        return;
      }
      const data = await res.json();
      setVisitors((data.visitors ?? []) as LiveVisitor[]);
      setError(null);
    } catch {
      setError("Couldn't reach the server.");
    }
  }, []);

  useEffect(() => {
    void load();
    timerRef.current = window.setInterval(() => void load(), POLL_MS);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [load]);

  const count = visitors?.length ?? 0;

  return (
    <>
      <LearningHint
        as="block"
        category="C.A.R.E · Monitor"
        title="Live visitor monitor"
        whatItIs="A live view of the anonymous visitors currently on your site (via the C.A.R.E widget) and the page each one is on. Updates every few seconds. If a visitor has an open conversation, you can jump straight into it from here."
        why="Support is faster when you can see demand forming before it becomes a ticket — a cluster of visitors stuck on the pricing or checkout page is a signal you can act on. Presence is ANONYMOUS by design (§3.4): a random per-session id and the page, never a name, never tracking a person across visits. It shows pressure, not people — a monitor, not surveillance."
        how="Leave it open on a second screen while you work the inbox. When someone's been sitting on a page a while, that's your cue to watch for (or invite) a conversation. Click through to any active conversation to respond."
        principle="See the pressure, not the person. The monitor surfaces where attention is needed without profiling anyone — signal for the team, anonymity for the visitor."
      >
        <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60 flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-lg font-semibold text-primary">Monitor</h1>
            <p className="text-[11px] text-muted">
              Live view of who&apos;s on the site and what they&apos;re looking at
              · anonymous presence
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span
              className={`inline-block w-2 h-2 rounded-full ${
                count > 0 ? "bg-emerald-400" : "bg-muted"
              }`}
              aria-hidden
            />
            <span className="text-secondary">
              {count} active {count === 1 ? "visitor" : "visitors"}
            </span>
          </div>
        </header>
      </LearningHint>

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-5">
        {error && (
          <div className="mb-4 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
            {error} Retrying…
          </div>
        )}

        {visitors === null ? (
          <div className="flex items-center gap-2 text-xs text-muted py-16 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Reading the room…
          </div>
        ) : visitors.length === 0 ? (
          <div className="flex-1 flex items-center justify-center px-8 text-center py-16">
            <div>
              <Activity className="w-10 h-10 text-muted mx-auto mb-3" aria-hidden />
              <p className="text-sm text-primary font-medium mb-1">
                No active visitors right now
              </p>
              <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                When someone opens your site with the C.A.R.E widget installed,
                they&apos;ll appear here — anonymously — with the page
                they&apos;re on. This view updates every few seconds.
              </p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2 max-w-3xl">
            {visitors.map((v) => (
              <li
                key={v.visitorId}
                className="flex items-center justify-between gap-3 bg-base border border-default rounded-lg px-3.5 py-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"
                      aria-hidden
                    />
                    <span className="text-sm text-primary truncate">
                      {pageLabel(v.page)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted mt-0.5 pl-4">
                    Anonymous visitor · active {ago(v.lastSeenAt)}
                  </p>
                </div>
                {v.conversationId ? (
                  <Link
                    href={`/dashboard/care/conversations/${v.conversationId}`}
                    className="inline-flex items-center gap-1.5 text-xs text-brand border border-ember-400/40 hover:border-ember-400/70 px-2.5 py-1.5 rounded-md flex-shrink-0"
                  >
                    <MessageCircle className="w-3.5 h-3.5" aria-hidden />
                    Open chat
                  </Link>
                ) : (
                  <span className="text-[11px] text-muted flex-shrink-0">
                    Browsing
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
