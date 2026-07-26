"use client";

/**
 * RcdPanel — Raw Conversation Data at the bottom of the C.A.R.E app (founder build 2026-07-26).
 * Spec: docs/feature-specs/RCD-RAW-CONVERSATION-DATA.md.
 *
 * A collapsible bottom drawer that lists the conversations the C.A.R.E extension captured from
 * third-party channels (WhatsApp, Gmail, …) and, on open, shows the FULL raw content: every
 * message with its sender/role (attribution carried from the source — A39) and its media
 * (images as thumbnails, files/audio/video as links). Media is streamed from the private bucket
 * via short-lived signed URLs the detail route returns — never a public URL (PII).
 *
 * Renders in BOTH Standard and Expert mode (not gated) — the founder's requirement. Self-contained:
 * fetches its own data, so it can be mounted at the bottom of the web console or the mobile surface.
 * Degrades to an empty state when 0194 isn't applied yet (the read routes return []).
 */

import { useCallback, useEffect, useRef, useState } from "react";

type RcdConversationSummary = {
  id: string;
  channel: string;
  source_url: string | null;
  message_count: number;
  captured_at: string;
};

type RcdMedia = {
  id: string;
  type: "image" | "file" | "video" | "audio";
  filename: string | null;
  alt: string | null;
  url: string | null;
};

type RcdMessage = {
  id: string;
  seq: number;
  role: "agent" | "customer" | "unknown";
  sender: string | null;
  body: string;
  media: RcdMedia[];
};

function channelLabel(channel: string): string {
  const map: Record<string, string> = {
    whatsapp: "WhatsApp",
    gmail: "Gmail",
    outlook: "Outlook",
    slack: "Slack",
    gorgias: "Gorgias",
    zendesk: "Zendesk",
    intercom: "Intercom",
    front: "Front",
    instagram: "Instagram",
    messenger: "Messenger",
    linkedin: "LinkedIn",
  };
  return map[channel] ?? channel;
}

function roleLabel(role: RcdMessage["role"]): string {
  if (role === "agent") return "Agent";
  if (role === "customer") return "Customer";
  return "—";
}

export default function RcdPanel() {
  const [open, setOpen] = useState(false);
  const [conversations, setConversations] = useState<RcdConversationSummary[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RcdMessage[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/care/rcd");
      if (res.ok) {
        const data = await res.json();
        setConversations(data.conversations ?? []);
      }
    } finally {
      setListLoaded(true);
    }
  }, []);

  // Load on mount (not only when opened) so the bar shows the count immediately — otherwise there's no
  // visible signal that captures exist, which is exactly the "I don't see where to view it" gap.
  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Auto-reveal when captures exist so they're visible without hunting — but only ONCE PER SESSION, not
  // on every care-section entry (CareShell remounts each time), which would be intrusive for regular use.
  // The prominent count badge carries discoverability after that.
  const autoRevealed = useRef(false);
  useEffect(() => {
    if (listLoaded && !autoRevealed.current && conversations.length > 0) {
      autoRevealed.current = true;
      try {
        if (sessionStorage.getItem("rcd-revealed") !== "1") {
          sessionStorage.setItem("rcd-revealed", "1");
          setOpen(true);
        }
      } catch {
        setOpen(true); // sessionStorage unavailable → still reveal
      }
    }
  }, [listLoaded, conversations.length]);

  // Guard against the stale-response race: clicking capture A then B quickly can resolve A's fetch
  // AFTER B's, rendering A's messages under B (the context-switch state-bleed class). Only the LATEST
  // requested id may write state.
  const latestReqId = useRef<string | null>(null);
  const openConversation = useCallback(async (id: string) => {
    latestReqId.current = id;
    setSelectedId(id);
    setMessages(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/care/rcd/${id}`);
      const data = res.ok ? await res.json() : { messages: [] };
      if (latestReqId.current !== id) return; // superseded by a newer selection — drop this response
      setMessages(data.messages ?? []);
    } catch {
      if (latestReqId.current === id) setMessages([]);
    } finally {
      if (latestReqId.current === id) setDetailLoading(false);
    }
  }, []);

  const hasData = listLoaded && conversations.length > 0;

  return (
    <div className={`border-t bg-base ${hasData ? "border-strong" : "border-default"}`}>
      {/* Collapsed bar — the "bottom part" handle. Prominent when captures exist so it's unmissable. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-surface focus:outline-none"
        aria-expanded={open}
      >
        <span
          className={`text-[11px] uppercase tracking-widest font-semibold ${
            hasData ? "text-primary" : "text-secondary"
          }`}
        >
          Raw Conversation Data
          {hasData ? (
            <span className="ml-2 inline-flex items-center justify-center rounded-full border border-strong px-1.5 text-[10px] normal-case tracking-normal text-primary">
              {conversations.length}
            </span>
          ) : null}
        </span>
        <span className={`text-xs ${hasData ? "text-primary" : "text-muted"}`} aria-hidden>
          {open ? "▾" : "▴"}
        </span>
      </button>

      {open && (
        <div className="max-h-[45vh] overflow-y-auto border-t border-default">
          <div className="flex justify-end px-3 py-1.5 border-b border-default">
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setMessages(null);
                void loadList(); // re-fetch directly (the mount effect only runs once)
              }}
              className="text-[11px] text-secondary hover:text-primary"
            >
              ↻ Refresh
            </button>
          </div>
          {!listLoaded ? (
            <p className="px-4 py-6 text-sm text-muted">Loading captured conversations…</p>
          ) : conversations.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">
              No captured conversations yet. Use the C.A.R.E browser extension on a supported channel
              (WhatsApp, Gmail, …) and choose “Capture conversation” to bring the full thread —
              text and media — here.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[minmax(0,15rem)_1fr]">
              {/* Capture list */}
              <ul className="border-b md:border-b-0 md:border-r border-default divide-y divide-default">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => openConversation(c.id)}
                      className={`w-full text-left px-4 py-2.5 hover:bg-surface focus:outline-none ${
                        selectedId === c.id ? "bg-surface" : ""
                      }`}
                    >
                      <span className="block text-sm text-primary font-medium">
                        {channelLabel(c.channel)}
                      </span>
                      <span className="block text-[11px] text-muted">
                        {c.message_count} message{c.message_count === 1 ? "" : "s"} ·{" "}
                        {new Date(c.captured_at).toLocaleString()}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>

              {/* Selected conversation detail */}
              <div className="min-w-0 px-4 py-3">
                {!selectedId ? (
                  <p className="text-sm text-muted">Select a capture to see its raw content.</p>
                ) : detailLoading ? (
                  <p className="text-sm text-muted">Loading…</p>
                ) : messages && messages.length > 0 ? (
                  <ol className="space-y-3">
                    {messages.map((m) => (
                      <li key={m.id} className="min-w-0">
                        <div className="text-[10px] uppercase tracking-widest text-muted mb-0.5">
                          {roleLabel(m.role)}
                          {m.sender ? <span className="normal-case tracking-normal text-secondary"> · {m.sender}</span> : null}
                        </div>
                        {m.body ? (
                          <p className="text-sm text-primary whitespace-pre-wrap break-words">{m.body}</p>
                        ) : null}
                        {m.media.length > 0 ? (
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {m.media.map((media) =>
                              media.type === "image" && media.url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  key={media.id}
                                  src={media.url}
                                  alt={media.alt ?? media.filename ?? "captured image"}
                                  className="max-h-40 max-w-full rounded border border-default object-contain"
                                />
                              ) : media.url ? (
                                <a
                                  key={media.id}
                                  href={media.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded border border-default bg-surface px-2 py-1 text-xs text-secondary hover:text-primary"
                                >
                                  {media.type === "video" ? "🎬" : media.type === "audio" ? "🎧" : "📎"}{" "}
                                  {media.filename ?? media.type}
                                </a>
                              ) : (
                                <span
                                  key={media.id}
                                  className="inline-flex items-center gap-1 rounded border border-default px-2 py-1 text-xs text-muted"
                                  title="Media couldn't be loaded"
                                >
                                  📎 {media.filename ?? media.type}
                                </span>
                              )
                            )}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted">This capture has no readable content.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
