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

import { X, Loader2, ChevronLeft } from "lucide-react";
import { channelLabel, roleLabel, useRcd } from "@/components/care/rcd/useRcd";

export default function RcdMobileSheet({ onClose }: { onClose: () => void }) {
  const { conversations, listLoaded, selectedId, messages, detailLoading, openConversation, back } = useRcd();

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-end" onClick={onClose}>
      <div
        className="w-full max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-white/10 bg-[#111119] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-amber-300">
            {selectedId ? (
              <button type="button" onClick={back} className="flex items-center gap-1 text-amber-300">
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
                  <button type="button" onClick={() => openConversation(c.id)} className="w-full text-left py-2.5">
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
