// auth-context.tsx — app-wide auth state + the sign-in/out actions, driven by Supabase's own session events.
//
// WHY a context (not per-screen getSession): one subscription to onAuthStateChange is the single source of the
// "am I signed in, and as whom" truth; every screen reads it, and the root layout uses `status` to gate the app
// (see _layout auth gate). We do NOT poll — Supabase pushes SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED events.
//
// Existing Elostate users sign in here with the credentials they already have. There is deliberately NO sign-up:
// Sales Coach accounts are provisioned in the Elostate admin (an admin assigns the sales-coach role) — the app
// mirrors the web login's "sign-in only" rule.

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthStatus = "loading" | "signedIn" | "signedOut";

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Returns null on success, or a human-readable message to show under the form. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    // Hydrate from persisted (encrypted) storage, then subscribe to every future change.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? "signedIn" : "signedOut");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? "signedIn" : "signedOut");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (!error) return null;
        // One message for auth failures — never reveal whether the email exists (§7 fail-closed, no oracle).
        if (error.message.toLowerCase().includes("invalid")) {
          return "That email and password don't match an Elostate account.";
        }
        return error.message;
      },
      async signOut() {
        await supabase.auth.signOut();
      },
    }),
    [status, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
