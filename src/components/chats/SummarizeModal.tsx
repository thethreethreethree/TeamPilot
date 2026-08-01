"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { useSseStream } from "@/lib/hooks/useSseStream";
import type { ChatMessage, ChatTopic } from "@/lib/data/chats";

/**
 * SummarizeModal — streams the System's read of a chat topic via
 * /api/chat/summarize, then offers the user the choice to post it
 * back into the conversation (as a `kind="summary"` message that the
 * MessageRow renders distinctly).
 *
 * Per §3.3, the summary is explicitly framed in the prompt as "the
 * System's read — confirm or correct." The post-back is opt-in, never
 * automatic — the System doesn't get to commit its own reading to the
 * record without a human deciding.
 *
 * Extracted from the chat detail page during the B2 refactor.
 */
export function SummarizeModal({
  topic,
  messages,
  onClose,
  onPost,
}: {
  topic: ChatTopic;
  messages: ChatMessage[];
  onClose: () => void;
  onPost: (text: string) => void | Promise<void>;
}) {
  const { status, run, abort } = useSseStream();
  // The Post button disables only on !ready (content-based), which does not
  // flip on click — so without a latch a double-click posts TWO summary
  // messages. Gate synchronously; keep a `posting` state for the button.
  const [posting, setPosting] = useState(false);
  const postingRef = useRef(false);
  const handlePost = async () => {
    if (postingRef.current) return;
    postingRef.current = true;
    setPosting(true);
    try {
      // The parent handles its own success/error (closes on success, keeps
      // the modal open + toasts on failure); awaiting lets us re-enable for
      // a retry if it stayed open.
      await onPost(status.text.trim());
    } finally {
      postingRef.current = false;
      setPosting(false);
    }
  };
  const payload = useMemo(
    () => ({
      topic: { title: topic.title, description: topic.description },
      messages: messages
        .filter((m) => m.kind === "message" && m.body)
        .map((m) => ({
          author: m.authorName,
          content: m.body ?? "",
          createdAt: m.createdAt,
        })),
    }),
    [topic, messages]
  );

  useEffect(() => {
    run("/api/chat/summarize", payload);
    return () => abort();
    // Intentionally only on mount — the user opened this expecting an
    // immediate read; re-running would surprise mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streaming = status.state === "streaming";
  const suppressed = status.state === "suppressed";
  const errored = status.state === "error";
  const ready = status.state === "done" && status.text.trim().length > 0;

  return (
    <Modal open onClose={onClose} title="Summarize the conversation" size="xl">
      <div className="space-y-3">
        <p className="text-xs text-muted leading-relaxed">
          What follows is the System&apos;s read — confirm, correct, or
          replace it. Posting it back to the conversation puts it on the
          record as the team&apos;s current understanding (§3.3).
        </p>
        <div className="bg-arc-400/5 border border-arc-400/30 rounded-lg px-3 py-2 text-sm text-primary whitespace-pre-wrap min-h-[6rem]">
          {status.text || (streaming ? "…" : "(waiting)")}
          {streaming && (
            <span className="cursor-blink ml-0.5" aria-hidden="true" />
          )}
        </div>
        {suppressed && (
          <p className="text-[10px] text-accent-text">
            Guidance suppressed (§3.4 control window): {"reason" in status ? status.reason : ""}
          </p>
        )}
        {errored && (
          <p className="text-[10px] text-red-400">
            {"error" in status ? status.error : "Stream failed."}
          </p>
        )}
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-secondary italic">
            Streamed via DeepSeek through the brain layer.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-muted hover:text-primary px-3 py-2"
            >
              Discard
            </button>
            <button
              onClick={() => void handlePost()}
              disabled={!ready || posting}
              className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
            >
              <Send className="w-3.5 h-3.5" aria-hidden="true" />
              Post to conversation
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
