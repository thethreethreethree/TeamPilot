"use client";

/**
 * RcdMobileSheet — Raw Conversation Data on the mobile C.A.R.E surface (founder build 2026-07-26).
 * The dark-console counterpart of RcdPanel (web): same read routes, styled to match CareRadialHome's
 * fixed-dark bottom sheets rather than the app's light theme (which is why it uses the console's hex
 * palette — allowlisted in theme-audit alongside CareRadialHome, same single-theme discipline).
 *
 * Renders regardless of Standard/Expert (the mobile surface is mode-agnostic today) — satisfying the
 * founder's "both modes" requirement on mobile. Media streams from the private bucket via the
 * short-lived signed URLs the detail route returns (never a public URL).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { X, Loader2, ChevronLeft } from "lucide-react";

type Summary = { id: string; channel: string; message_count: number; captured_at: string };
type Media = { id: string; type: "image" | "file" | "video" | "audio"; filename: string | null; alt: string | null; url: string | null };
type Message = { id: string; seq: number; role: "agent" | "customer" | "unknown"; sender: string | null; body: string; media: Media[] };

function channelLabel(c: string): string {
  const map: Record<string, string> = {
    whatsapp: "WhatsApp", gmail: "Gmail", outlook: "Outlook", slack: "Slack", gorgias: "Gorgias",
    zendesk: "Zendesk", intercom: "Intercom", front: "Front", instagram: "Instagram", messenger: "Messenger", linkedin: "LinkedIn",
  };
  return map[c] ?? c;
}
function roleLabel(r: Message["role"]): string {
  return r === "agent" ? "Agent" : r === "customer" ? "Customer" : "—";
}

export default function RcdMobileSheet({ onClose }: { onClose: () => void }) {
  const [conversations, setConversations] = useState<Summary[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/care/rcd");
      if (res.ok) setConversations((await res.json()).conversations ?? []);
    } finally {
      setListLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Stale-response guard (context-switch state-bleed class): only the latest requested id writes state.
  const latestReqId = useRef<string | null>(null);
  const open = useCallback(async (id: string) => {
    latestReqId.current = id;
    setSelectedId(id);
    setMessages(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/care/rcd/${id}`);
      const data = res.ok ? await res.json() : { messages: [] };
      if (latestReqId.current !== id) return; // superseded by a newer selection
      setMessages(data.messages ?? []);
    } catch {
      if (latestReqId.current === id) setMessages([]);
    } finally {
      if (latestReqId.current === id) setDetailLoading(false);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end" onClick={onClose}>
      <div
        className="w-full max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#111119] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-amber-300">
            {selectedId ? (
              <button type="button" onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-amber-300">
                <ChevronLeft className="w-4 h-4" /> Raw Conversation Data
              </button>
            ) : (
              "Raw Conversation Data"
            )}
          </p>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-white/50 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        {!selectedId ? (
          !listLoaded ? (
            <p className="text-xs text-white/50 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
            </p>
          ) : conversations.length === 0 ? (
            <p className="text-xs text-white/50 leading-relaxed">
              No captured conversations yet. Capture a thread with the C.A.R.E browser extension on a
              supported channel and it appears here.
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {conversations.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => open(c.id)} className="w-full text-left py-2.5">
                    <span className="block text-sm text-white/90 font-medium">{channelLabel(c.channel)}</span>
                    <span className="block text-[11px] text-white/40">
                      {c.message_count} message{c.message_count === 1 ? "" : "s"} · {new Date(c.captured_at).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : detailLoading ? (
          <p className="text-xs text-white/50 flex items-center gap-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
          </p>
        ) : messages && messages.length > 0 ? (
          <ol className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="min-w-0">
                <div className="text-[10px] uppercase tracking-widest text-white/40 mb-0.5">
                  {roleLabel(m.role)}
                  {m.sender ? <span className="normal-case tracking-normal text-white/60"> · {m.sender}</span> : null}
                </div>
                {m.body ? <p className="text-sm text-white/85 whitespace-pre-wrap break-words">{m.body}</p> : null}
                {m.media.length > 0 ? (
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {m.media.map((media) =>
                      media.type === "image" && media.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={media.id}
                          src={media.url}
                          alt={media.alt ?? media.filename ?? "captured image"}
                          className="max-h-40 max-w-full rounded border border-white/10 object-contain"
                        />
                      ) : media.url ? (
                        <a
                          key={media.id}
                          href={media.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-white/70"
                        >
                          {media.type === "video" ? "🎬" : media.type === "audio" ? "🎧" : "📎"} {media.filename ?? media.type}
                        </a>
                      ) : (
                        <span key={media.id} className="inline-flex items-center gap-1 rounded border border-white/10 px-2 py-1 text-xs text-white/40">
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
          <p className="text-xs text-white/50">This capture has no readable content.</p>
        )}
      </div>
    </div>
  );
}
