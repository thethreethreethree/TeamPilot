"use client";

import { useEffect, useMemo, useState } from "react";
import { HelpCircle, Loader2, Send, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { LearningHint } from "@/components/learning/LearningHint";
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
        <LearningHint
          as="block"
          category="Chat · Formulate"
          title="Three questions that ground the draft"
          whatItIs="Three short prompts — your read of the conversation, what success looks like, and the risk no one's named. Your answers are what the System writes from."
          why="The System is forbidden from asserting its own read over yours. These questions force YOUR understanding into the draft first, so what comes back is your position sharpened — not the model's guess about your situation."
          how="Answer in plain language, at least a sentence each. The more honestly you name the real concern, the more the draft sounds like you actually mean it."
          principle="The System writes from your understanding, never instead of it."
        >
        <p className="text-xs text-muted leading-relaxed">
          Three short prompts. Your answers ground the System&apos;s draft in
          YOUR read of the conversation. The draft that comes back is a
          starting point — edit it before sending.
        </p>
        </LearningHint>
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
          <LearningHint
            as="block"
            category="Chat · Formulate"
            title="The draft built from your answers"
            whatItIs="A response the System composed from your three answers, streamed in as it writes. A starting point, not a final send."
            why="This is a scaffold, not a verdict. It exists to save you the blank-page tax, not to decide your message — which is why the next step is edit, not send."
            how="Read it against what you actually meant. Edit freely once it's done, or re-compose if it missed. Nothing sends until you choose to."
            principle="A draft is a starting point you own, not an answer you accept."
          >
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
          </LearningHint>
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
                <LearningHint
                  as="inline-block"
                  category="Chat · Formulate"
                  title="Use this draft"
                  whatItIs="Drops the composed draft into your composer, where you finish editing and send it yourself. Re-compose regenerates instead if it missed."
                  why="The draft never sends on its own — it lands in your composer first. That last step is where you reclaim authorship, so what goes out is yours, not the model's."
                  how="Use this draft to carry it into the composer, then edit and send. Or Re-compose to try again from the same answers."
                  principle="A draft is a starting point you own, not an answer you accept."
                >
                <button
                  onClick={() => onCompose(status.text.trim())}
                  className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  Use this draft
                </button>
                </LearningHint>
              </>
            ) : (
              <LearningHint
                as="inline-block"
                category="Chat · Formulate"
                title="Compose the draft"
                whatItIs="Builds a draft from your three answers and streams it in below."
                why="It unlocks only when all three answers are substantive — the System refuses to write from a blank read, because a draft without your grounding would be the model guessing at your situation."
                how="Fill the three prompts first, then Compose. The draft appears below for you to edit before it ever sends."
                principle="Earn the draft by doing the thinking first; the words come easier after."
              >
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
              </LearningHint>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
