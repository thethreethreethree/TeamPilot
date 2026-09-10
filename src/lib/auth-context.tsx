// auth-context.tsx — app-wide auth state + the sign-in/out actions, driven by Supabase's own session events.
//
// WHY a context (not per-screen getSession): one subscription to onAuthStateChange is the single source of the
// "am I signed in, and as whom" truth; every screen reads it, and the root layout uses `status` to gate the app
// (see _layout auth gate). We do NOT poll — Supabase pushes SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED events.
//
// Existing Elostate users sign in here with the credentials they already have. There is deliberately NO sign-up:
// Sales Coach accounts are provisioned in the Elostate admin (an admin assigns the sales-coach role) — the app
// mirrors the web login's "sign-in only" rule.

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { SecureStorageUnavailable } from "./secure-session-store";
import { signInMessage } from "./sign-in-message";

type AuthStatus = "loading" | "signedIn" | "signedOut";

type AuthValue = {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  /** Returns null on success, or a human-readable message to show under the form. */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /**
   * True when the rep was signed in and the session ENDED without them asking.
   *
   * A refresh token expires, or is revoked, and the auth gate moves them to the
   * sign-in screen. Without this flag that move is silent and indistinguishable
   * from a crash: a rep halfway through reading a transcript is suddenly looking
   * at a login form, and the reasonable conclusion is that the app broke or that
   * somebody logged them out on purpose. Both are worse than the truth.
   *
   * In memory only, and deliberately. A cold launch with an expired token is a
   * different situation — nobody was interrupted, the rep simply came back later
   * — and telling them their session "ended" then would be alarming about
   * something entirely routine.
   */
  endedUnexpectedly: boolean;
  /** Called once the message has been shown, so it does not reappear. */
  acknowledgeEnded: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [endedUnexpectedly, setEndedUnexpectedly] = useState(false);
  /**
   * Set for the moment a deliberate sign-out is in flight.
   *
   * A ref rather than state: the auth event arrives before any re-render would
   * deliver a new state value, so a state flag would still read `false` when the
   * event asks — and every deliberate sign-out would be reported as an expiry.
   */
  const deliberate = useRef(false);

  useEffect(() => {
    // Hydrate from persisted (encrypted) storage, then subscribe to every future change.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? "signedIn" : "signedOut");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession((was) => {
        // The transition that matters: there WAS a session, there is not one
        // now, and nobody pressed Sign out. Read from the previous value inside
        // the setter so this cannot race a re-render.
        if (was && !next && !deliberate.current) setEndedUnexpectedly(true);
        return next;
      });
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
        let error;
        try {
          ({ error } = await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          }));
        } catch (e) {
          // supabase-js calls storage.setItem while completing a sign-in, so a
          // keychain that cannot hold the session surfaces HERE, as a throw, not
          // as an auth error. Say what happened in words rather than letting a
          // stack trace reach the screen.
          if (e instanceof SecureStorageUnavailable) return e.message;
          throw e;
        }
        if (!error) return null;
        // Translated rather than passed through. The library's own strings are
        // written for developers, and the fallback used to hand one straight to
        // a rep — see sign-in-message.ts for why that specifically hurts on this
        // screen. Credential failures all get one wording, so the screen is never
        // an oracle for which addresses have accounts (§7, fail closed).
        return signInMessage(error.message);
      },
      async signOut() {
        deliberate.current = true;
        try {
          await supabase.auth.signOut();
        } finally {
          // Released after the event has been delivered. Left set, the NEXT
          // expiry would be reported as deliberate and go unexplained — the very
          // bug this exists to prevent, hiding behind its own fix.
          setTimeout(() => {
            deliberate.current = false;
          }, 0);
        }
      },
      endedUnexpectedly,
      acknowledgeEnded() {
        setEndedUnexpectedly(false);
      },
    }),
    [status, session, endedUnexpectedly],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
