"use client";

import { useEffect, useState } from "react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { demoUserId } from "@/lib/data/chats";

/**
 * useCurrentUserId — returns the id that identifies "me" everywhere in
 * the UI. In live mode that's the authenticated auth.users.id. In demo
 * mode it's the localStorage demo user. Returns `null` while the auth
 * session is still loading, so callers can render a non-admin/non-mine
 * default rather than briefly mis-flagging a message as someone else's.
 *
 * Why this exists: the chat detail page checks `iAmAdmin` and `isMine`
 * by comparing message author / participant rows to a current-user id.
 * Before this hook, the comparison used `demoUserId()` unconditionally,
 * which never matches a real auth UUID — admin controls stayed hidden
 * and own-message styling didn't apply in live mode.
 */
export function useCurrentUserId(): string | null {
  const [id, setId] = useState<string | null>(
    supabaseEnabled ? null : demoUserId()
  );

  useEffect(() => {
    if (!supabaseEnabled) return;
    const supabase = createClient();
    let cancelled = false;
    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) setId(data.user?.id ?? null);
    });
    // React to sign-in / sign-out within the same page session so the
    // chat surface flips between admin / non-admin cleanly.
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!cancelled) setId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return id;
}
