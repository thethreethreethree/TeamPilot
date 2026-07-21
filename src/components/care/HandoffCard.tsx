"use client";

import { useState } from "react";
import {
  handoverTopicsFor,
  topicIsOther,
  topicNeedsOrderNumber,
  type BusinessType,
} from "@/lib/care/handoverTopics";

/**
 * C.A.R.E handover capture card (founder 2026-07-21). Shown in the customer widget the
 * moment Jeff hands the conversation to a human. A COMPACT card — not a pre-chat gate —
 * that collects, all optional: full name · email · the specific concern (a topic dropdown
 * chosen by the tenant's business type) · a free-text box when they pick "Other" · an
 * order number for e-commerce concerns. "Connect me" submits; "Skip" dismisses. The agent
 * sees whatever was provided in their inbox header.
 *
 * Everything is optional by design (the founder was explicit: never block the customer).
 * Shared by both the direct widget (CareChatWidget) and the embedded widget so the two
 * can't drift; each passes the businessType it resolved (messages response / bootstrap).
 */

export type HandoffCardPayload = {
  name?: string;
  email?: string;
  topic?: string;
  topicDetail?: string;
  orderNumber?: string;
};

export function HandoffCard({
  businessType,
  submitting,
  error,
  onSubmit,
  onSkip,
}: {
  businessType: BusinessType;
  submitting: boolean;
  error: string | null;
  onSubmit: (payload: HandoffCardPayload) => void;
  onSkip: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState("");
  const [topicDetail, setTopicDetail] = useState("");
  const [orderNumber, setOrderNumber] = useState("");

  const topics = handoverTopicsFor(businessType);
  const showDetail = topicIsOther(businessType, topic || null);
  const showOrder =
    businessType === "ecommerce" && topicNeedsOrderNumber(businessType, topic || null);

  const submit = () => {
    if (submitting) return;
    onSubmit({
      name: name.trim() || undefined,
      email: email.trim() || undefined,
      topic: topic || undefined,
      topicDetail: showDetail ? topicDetail.trim() || undefined : undefined,
      orderNumber: showOrder ? orderNumber.trim() || undefined : undefined,
    });
  };

  return (
    <div className="mx-4 my-2 rounded-xl border border-default bg-surface/60 p-3 space-y-2">
      <p className="text-xs font-semibold text-primary">
        Before a teammate joins
      </p>
      <p className="text-[11px] text-muted leading-relaxed">
        Share a couple of details so they can pick up right where you are. All optional.
      </p>

      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        aria-label="Your name"
        className="w-full bg-base border border-default rounded-lg px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email (so we can follow up)"
        aria-label="Your email"
        autoComplete="email"
        className="w-full bg-base border border-default rounded-lg px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
      />
      <select
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        aria-label="What's this about?"
        className="w-full bg-base border border-default rounded-lg px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
      >
        <option value="">What's this about?</option>
        {topics.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      {showDetail && (
        <textarea
          value={topicDetail}
          onChange={(e) => setTopicDetail(e.target.value)}
          placeholder="Tell us in a few words…"
          aria-label="Describe your concern"
          rows={2}
          className="w-full bg-base border border-default rounded-lg px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none"
        />
      )}
      {showOrder && (
        <input
          type="text"
          value={orderNumber}
          onChange={(e) => setOrderNumber(e.target.value)}
          placeholder="Order number"
          aria-label="Order number"
          className="w-full bg-base border border-default rounded-lg px-2.5 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
        />
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="flex items-center gap-2 pt-0.5">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex-1 rounded-lg bg-ember-400 hover:bg-ember-500 disabled:opacity-50 text-[#09090B] text-sm font-medium py-1.5 transition-colors"
        >
          {submitting ? "Connecting…" : "Connect me"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={submitting}
          className="text-[11px] text-muted hover:text-primary px-2 py-1.5"
        >
          Skip
        </button>
      </div>
    </div>
  );
}
