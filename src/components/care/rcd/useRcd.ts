"use client";

/**
 * useRcd — shared data layer for the RCD (Raw Conversation Data) surfaces (web RcdPanel + mobile
 * RcdMobileSheet). Both render the same data differently (light panel vs dark console sheet), so the
 * TYPES + labels + fetch + the stale-response race guard live here ONCE — A16: multiple surfaces on the
 * same data must stay consistent, and duplicating this logic already caused the same race bug in both.
 *
 * The hook owns: the conversation list (loaded on mount), the selected conversation's messages (with a
 * latest-request-id guard so a slow response for a superseded selection never renders under the new one),
 * and back-navigation. Surface-specific state (panel open/collapsed, auto-reveal) stays in each component.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type RcdConversationSummary = {
  id: string;
  channel: string;
  source_url: string | null;
  message_count: number;
  captured_at: string;
  preview?: string | null; // first-message snippet, to tell same-channel captures apart
};

export type RcdMedia = {
  id: string;
  type: "image" | "file" | "video" | "audio";
  filename: string | null;
  alt: string | null;
  url: string | null;
};

export type RcdMessage = {
  id: string;
  seq: number;
  role: "agent" | "customer" | "unknown";
  sender: string | null;
  body: string;
  media: RcdMedia[];
};

const CHANNEL_LABELS: Record<string, string> = {
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

export function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel] ?? channel;
}

export function roleLabel(role: RcdMessage["role"]): string {
  return role === "agent" ? "Agent" : role === "customer" ? "Customer" : "—";
}

export function useRcd() {
  const [conversations, setConversations] = useState<RcdConversationSummary[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<RcdMessage[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  // Distinguish a FETCH FAILURE (auth 401/403, 5xx, network) from a genuine empty result. Without this,
  // a failure collapsed into `conversations: []` / `messages: []`, and both surfaces rendered the cheerful
  // "no captures yet — use the extension" / "no readable content" empty state — telling an agent whose
  // session just expired that their 12 captured threads are GONE. The sibling panels (analytics, patterns,
  // ConversationsApp) all distinguish error-from-empty with a retry; RCD was the only one that didn't. (The
  // list ROUTE deliberately degrades a DB error to 200 + [] by design — that stays an honest empty; only the
  // client-detectable non-2xx / thrown failures become an error here.)
  const [listError, setListError] = useState(false);
  const [detailError, setDetailError] = useState(false);

  const loadList = useCallback(async () => {
    setListError(false);
    try {
      const res = await fetch("/api/care/rcd");
      if (res.ok) setConversations((await res.json()).conversations ?? []);
      else setListError(true); // 401/403/5xx — an error, NOT "no captures yet"
    } catch {
      setListError(true); // network — an error, NOT "no captures yet"
    } finally {
      setListLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  // Stale-response guard: clicking A then B quickly can resolve A's fetch after B's, rendering A's
  // messages under B (context-switch state-bleed). Only the latest requested id may write state.
  const latestReqId = useRef<string | null>(null);
  const openConversation = useCallback(async (id: string) => {
    latestReqId.current = id;
    setSelectedId(id);
    setMessages(null);
    setDetailError(false);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/care/rcd/${id}`);
      if (latestReqId.current !== id) return; // superseded by a newer selection
      if (res.ok) {
        const data = await res.json();
        if (latestReqId.current !== id) return;
        setMessages(data.messages ?? []);
      } else {
        setDetailError(true); // an error, NOT "this capture has no readable content"
      }
    } catch {
      if (latestReqId.current === id) setDetailError(true);
    } finally {
      if (latestReqId.current === id) setDetailLoading(false);
    }
  }, []);

  const back = useCallback(() => {
    setSelectedId(null);
    setMessages(null);
    setDetailError(false);
  }, []);

  return {
    conversations,
    listLoaded,
    listError,
    loadList,
    selectedId,
    messages,
    detailLoading,
    detailError,
    openConversation,
    back,
  };
}
