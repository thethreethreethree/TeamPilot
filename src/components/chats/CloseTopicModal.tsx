"use client";

import { useMemo, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Field, Textarea } from "@/components/ui/Field";
import { closeTopic, type ChatTopic } from "@/lib/data/chats";
import { CoachPanel } from "@/components/chats/CoachPanel";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";
import type { CoachContextPayload } from "@/lib/coach/v5/types";

const CLOSE_COACH_V5_ENABLED = true;

/**
 * CloseTopicModal — admin-only action to mark a topic resolved.
 *
 * The 20-char minimum on the summary is intentional: closing a topic
 * without a written reason would create a §3.5 measurement hole
 * (resolution_held vs reopened depends on a coherent close summary
 * the team can later judge against). The constitution treats the
 * close summary as the load-bearing argument for what was decided.
 *
 * Extracted from the chat detail page during the B2 refactor.
 */
export function CloseTopicModal({
  topic,
  onClose,
  onClosed,
}: {
  topic: ChatTopic;
  onClose: () => void;
  onClosed: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { enabled: coachEnabled } = useCoachEnabled();
  const [askCoachToken, setAskCoachToken] = useState(0);
  // The close summary is a reflection — what was decided. Frame it as
  // chat_message context with the topic as context. The Coach will
  // help the writer make the summary clearer (Zinsser layer) without
  // attempting interpersonal moves (no recipient).
  const coachV5Payload = useMemo<CoachContextPayload>(
    () => ({
      topic: {
        title: topic.title,
        description: topic.description ?? undefined,
      },
    }),
    [topic.title, topic.description]
  );

  const submit = async () => {
    if (summary.trim().length < 20) return;
    setSubmitting(true);
    try {
      const ok = await closeTopic({
        topicId: topic.id,
        summary: summary.trim(),
      });
      if (ok) onClosed();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={`Close topic: ${topic.title}`} size="lg">
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-gold-400/5 border border-gold-400/20">
          <ShieldCheck
            className="w-4 h-4 text-accent-text mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <p className="text-xs text-primary leading-relaxed">
            Closing a topic creates a permanent resolution record. The
            conversation history stays accessible, and the System uses it to
            help with similar topics later. If this is linked to a problem,
            closing here also marks the problem resolved.
          </p>
        </div>
        <Field label="What was decided / resolved? (≥20 chars)" required>
          {coachEnabled && (
            CLOSE_COACH_V5_ENABLED ? (
              <>
                <CoachPanelV5
                  draft={summary}
                  contextType="chat_message"
                  contextPayload={coachV5Payload}
                  askCoachToken={askCoachToken}
                  onAcceptRevision={(revised) => setSummary(revised)}
                />
                <div className="mb-2 flex justify-end">
                  <AskCoachButton
                    disabled={!summary.trim()}
                    onAsk={() => setAskCoachToken((t) => t + 1)}
                  />
                </div>
              </>
            ) : (
              <CoachPanel
                subject={`chat_topic:${topic.id}:close_summary`}
                draft={summary}
              />
            )
          )}
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="Plain language. What was actually concluded? What was the call?"
            autoFocus
          />
        </Field>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="text-xs text-muted hover:text-primary px-3 py-2"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={submitting || summary.trim().length < 20}
            className="flex items-center gap-2 bg-gold-400 hover:bg-gold-500 disabled:opacity-40 text-navy-900 font-semibold px-4 py-2 rounded-lg transition-colors text-xs"
          >
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            {submitting ? "Closing…" : "Close topic"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
