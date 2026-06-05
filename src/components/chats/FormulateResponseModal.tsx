"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle, Loader2, Send, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { useSseStream } from "@/lib/hooks/useSseStream";
import type { ChatMessage, ChatTopic } from "@/lib/data/chats";

/**
 * FormulateResponseModal — three-question structured compose, then
 * stream a §3.3 draft via /api/chat/formulate.
 *
 * The questions force the user to ground the model in THEIR read.
 * The model returns a draft in the user's voice that they edit before
 * sending. The constitution forbids letting the model assert its own
 * extraction over the user's (§3.3).
 *
 * Extracted from the chat detail page during the B2 refactor.
 */
export function FormulateResponseModal({
  topic,
  recent,
  onClose,
  onCompose,
}: {
  topic: ChatTopic;
  recent: ChatMessage[];
  onClose: () => void;
  onCompose: (composed: string) => void;
}) {
  const QUESTIONS = [
    "What is your read of what the conversation is actually about?",
    "What outcome would you consider a success here?",
    "What concern or risk is not yet being named?",
  ];
  const [answers, setAnswers] = useState<string[]>(["", "", ""]);
  const { status, run, abort, reset } = useSseStream();
  const recentPayload = useMemo(
    () =>
      recent.slice(-6).map((m) => ({
        author: m.authorName,
        content: m.body ?? "",
      })),
    [recent]
  );

  const ready = answers.every((a) => a.trim().length >= 10);
  const streaming = status.state === "streaming";
  const suppressed = status.state === "suppressed";
  const errored = status.state === "error";
  const haveDraft =
    (status.state === "done" || status.state === "streaming") &&
    status.text.trim().length > 0;
  const composedReady = status.state === "done" && status.text.trim().length > 0;

  const compose = () =>
    run("/api/chat/formulate", {
      answers,
      topic: { title: topic.title, description: topic.description },
      recent: recentPayload,
    });

  // Abort any in-flight stream when the modal unmounts.
  useEffect(() => () => abort(), [abort]);

  return (
    <Modal open onClose={onClose} title="Formulate a fuller response" size="xl">
      <div className="space-y-3">
        <p className="text-xs text-muted leading-relaxed">
          Three short prompts. Your answers ground the System&apos;s draft in
          YOUR read of the conversation. The draft that comes back is a
          starting point — edit it before sending.
        </p>
        {QUESTIONS.map((q, i) => (
          <Field key={i} label={`${i + 1}. ${q}`} required>
            <Textarea
              value={answers[i]}
              onChange={(e) => {
                const next = [...answers];
                next[i] = e.target.value;
                setAnswers(next);
              }}
              rows={3}
              placeholder="Plain language — what you actually think."
              disabled={streaming}
            />
          </Field>
        ))}

        {haveDraft && (
          <div>
            <p className="text-[10px] uppercase tracking-widest text-arc-300 mb-1.5 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" aria-hidden="true" />
              Draft built from your answers
              {streaming && (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
              )}
            </p>
            <div className="bg-arc-400/5 border border-arc-400/30 rounded-lg px-3 py-2 text-sm text-primary whitespace-pre-wrap min-h-[3rem]">
              {status.text}
              {streaming && (
                <span className="cursor-blink ml-0.5" aria-hidden="true" />
              )}
            </div>
          </div>
        )}
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
          <p className="text-[10px] text-secondary italic flex items-center gap-1.5">
            <HelpCircle className="w-3 h-3" aria-hidden="true" />
            Streamed via DeepSeek through the brain layer.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-muted hover:text-primary px-3 py-2"
            >
              Cancel
            </button>
            {composedReady ? (
              <>
                <button
                  onClick={reset}
                  className="text-xs text-muted hover:text-primary px-3 py-2"
                >
                  Re-compose
                </button>
                <button
                  onClick={() => onCompose(status.text.trim())}
                  className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  Use this draft
                </button>
              </>
            ) : (
              <button
                onClick={compose}
                disabled={!ready || streaming}
                className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
              >
                {streaming ? (
                  <>
                    <Loader2
                      className="w-3.5 h-3.5 animate-spin"
                      aria-hidden="true"
                    />
                    Composing…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" aria-hidden="true" />
                    Compose draft
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
