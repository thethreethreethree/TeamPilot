"use client";

import { useEffect, useMemo } from "react";
import { Loader2, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { LearningHint } from "@/components/learning/LearningHint";
import { useSseStream } from "@/lib/hooks/useSseStream";
import { detectAll, type CoachCitation } from "@/lib/coach/heuristics";
import type { ChatMessage, ChatTopic } from "@/lib/data/chats";

/**
 * GuideMyResponseModal — streams a §3.3 "guide, don't overtake"
 * sharpening of the user's draft via /api/chat/guide.
 *
 * The model produces a tighter version in the user's voice. The user
 * accepts or discards; the System never asserts the rewrite as correct.
 *
 * Extracted from the chat detail page during the B2 refactor.
 */
export function GuideMyResponseModal({
  draft,
  topic,
  recent,
  onClose,
  onAccept,
}: {
  draft: string;
  topic: ChatTopic;
  recent: ChatMessage[];
  onClose: () => void;
  onAccept: (revised: string) => void;
}) {
  const { status, run, abort } = useSseStream();
  const recentPayload = useMemo(
    () =>
      recent.slice(-6).map((m) => ({
        author: m.authorName,
        content: m.body ?? "",
      })),
    [recent]
  );

  // v3.9 (2026-06-12): Sharpen runs the same regex Coach uses against
  // the draft, so the route can know what was flagged and apply each
  // heuristic's principle during the rewrite. Without this, Sharpen
  // optimized for clarity ONLY — meaning an attack like "could you
  // not act stupid" would be returned essentially unchanged because
  // it's already direct. With it, Sharpen also strips the identity
  // attack while preserving the user's intent. Holistic (§1.5) — the
  // two tools now compose instead of working at cross-purposes.
  const citationsPayload = useMemo(() => {
    const cs = detectAll(draft) as CoachCitation[];
    return cs.map((c) => ({
      id: c.id,
      label: c.label,
      principle: c.principle,
      trigger_excerpt: c.triggerExcerpt,
    }));
  }, [draft]);

  // Auto-start on mount — the user opened this expecting an answer; an
  // extra "Generate" button would be friction with no purpose.
  useEffect(() => {
    if (draft.trim().length === 0) return;
    run("/api/chat/guide", {
      draft,
      topic: { title: topic.title, description: topic.description },
      recent: recentPayload,
      coachCitations: citationsPayload,
    });
    return () => abort();
    // Intentionally only on mount — re-running on draft change would
    // surprise the user mid-stream.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // v3.9: strip surrounding double-quotes from the streamed suggestion.
  // The system prompt says "no quotation marks" but the LLM occasionally
  // wraps the response anyway (most recently on "could you not act
  // stupid" — returned as `"Could you not act stupid"`). Post-process
  // is defense-in-depth: even if the LLM ignores the rule, the user
  // sees the cleaned text and the Accept button substitutes cleaned
  // text into their composer.
  const rawSuggestion = status.text;
  const suggestion = useMemo(() => {
    let s = rawSuggestion.trim();
    // Strip a single pair of surrounding straight or curly quotes.
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("“") && s.endsWith("”")) ||
      (s.startsWith("'") && s.endsWith("'") && s.length > 2)
    ) {
      s = s.slice(1, -1).trim();
    }
    return s;
  }, [rawSuggestion]);
  const streaming = status.state === "streaming";
  const suppressed = status.state === "suppressed";
  const errored = status.state === "error";
  const ready = status.state === "done" && suggestion.trim().length > 0;

  return (
    <Modal open onClose={onClose} title="Sharpen your response" size="lg">
      <div className="space-y-3">
        <p className="text-xs text-muted leading-relaxed">
          The System offers a sharper version of your draft. Accept, edit, or
          close and send your original — the discipline (§3.3): the System
          never decides for you. It surfaces a refinement; you decide.
        </p>
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted mb-1.5">
            Your draft
          </p>
          <div className="bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary whitespace-pre-wrap">
            {draft || "(empty)"}
          </div>
        </div>
        <LearningHint
          as="block"
          category="Chat · Sharpen"
          title="A sharper version of your draft"
          whatItIs="A tighter rewrite of your message in your own voice — clearer, and with any identity attack or noise stripped while your intent is kept."
          why="Sharpen refines; it never decides. It runs the same Coach checks against your draft so it can fix what was flagged, not just shorten — but it hands the choice back to you every time."
          how="Read it beside your draft above. If it says what you meant, better, use it. If it flattened something you needed, send your original."
          principle="Clearer isn't the same as truer — you're the judge of which is yours."
        >
        <div>
          <p className="text-[10px] uppercase tracking-widest text-arc-300 mb-1.5 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3" aria-hidden="true" />
            System&apos;s suggestion
            {streaming && (
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
            )}
          </p>
          <div className="bg-arc-400/5 border border-arc-400/30 rounded-lg px-3 py-2 text-sm text-primary whitespace-pre-wrap min-h-[3rem]">
            {suggestion || (streaming ? "…" : "(waiting)")}
            {streaming && (
              <span className="cursor-blink ml-0.5" aria-hidden="true" />
            )}
          </div>
          {suppressed && (
            <p className="text-[10px] text-accent-text mt-1.5">
              Guidance suppressed (§3.4 control window): {"reason" in status ? status.reason : ""}
            </p>
          )}
          {errored && (
            <p className="text-[10px] text-red-400 mt-1.5">
              {"error" in status ? status.error : "Stream failed."}
            </p>
          )}
        </div>
        </LearningHint>
        <div className="flex items-center justify-between pt-2">
          <p className="text-[10px] text-secondary italic">
            Streamed via DeepSeek through the brain layer.
          </p>
          <LearningHint
            as="block"
            category="Chat · Sharpen"
            title="Use the suggestion, or send your original"
            whatItIs="Two paths: accept the sharpened version into your composer, or discard it and send exactly what you wrote."
            why="'Send my original' is a real, equal option — the System surfaces a refinement and stops there. A rewrite you can't refuse would be the System deciding for you, which the constitution forbids."
            how="'Use the suggestion' drops the sharpened text into your composer to edit further. 'Send my original' keeps your words untouched."
            principle="Guidance you can decline is help; guidance you can't is takeover."
          >
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-xs text-muted hover:text-primary px-3 py-2"
            >
              Send my original
            </button>
            <button
              onClick={() => onAccept(suggestion)}
              disabled={!ready}
              className="flex items-center gap-2 bg-arc-400 hover:bg-arc-500 disabled:opacity-40 disabled:cursor-not-allowed text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
            >
              Use the suggestion
            </button>
          </div>
          </LearningHint>
        </div>
      </div>
    </Modal>
  );
}
