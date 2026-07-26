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

  // Stale-response guard: clicking A then B quickly can resolve A's fetch after B's, rendering A's
  // messages under B (context-switch state-bleed). Only the latest requested id may write state.
  const latestReqId = useRef<string | null>(null);
  const openConversation = useCallback(async (id: string) => {
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

  const back = useCallback(() => {
    setSelectedId(null);
    setMessages(null);
  }, []);

  return {
    conversations,
    listLoaded,
    loadList,
    selectedId,
    messages,
    detailLoading,
    openConversation,
    back,
  };
}
