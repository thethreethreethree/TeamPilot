"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, UserRound } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

/**
 * ProfilePanel — Settings → Your profile.
 *
 * Lets a user edit their own display name (profiles.full_name) and see their
 * sign-in email. Until now full_name was set ONCE at onboarding with no later
 * edit surface anywhere in the app (settings/account gap, 2026-07-28).
 *
 * Writes profiles.full_name directly via the existing "own profile - update"
 * RLS policy — full_name is a NON-privileged column, explicitly exempted by the
 * privileged-column guard (migration 0090), so a direct authenticated update of
 * only full_name succeeds. No new API route needed (same pattern as the Avatar
 * panel). Email is read-only: an email-change flow does not exist yet.
 */
export function ProfilePanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [savedName, setSavedName] = useState(""); // last-persisted value
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabaseEnabled) {
      setLoading(false);
      return;
    }
    void (async () => {
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) {
        setLoading(false);
        return;
      }
      setUserId(auth.user.id);
      setEmail(auth.user.email ?? "");
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", auth.user.id)
        .maybeSingle();
      const name = profile?.full_name ?? "";
      setFullName(name);
      setSavedName(name);
      setLoading(false);
    })();
  }, []);

  const dirty = fullName.trim() !== savedName.trim();

  const save = async () => {
    setError("");
    if (!supabaseEnabled || !userId) return;
    const name = fullName.trim();
    if (!name) {
      setError("Your name can't be empty.");
      return;
    }
    if (name.length > 80) {
      setError("Please keep your name under 80 characters.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", userId);
      if (updateErr) throw new Error(updateErr.message);
      setSavedName(name);
      setFullName(name);
      toast.success("Name updated", "Your name updates across the app on the next refresh.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (!supabaseEnabled) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-primary mb-2">Your profile</h2>
        <p className="text-xs text-muted">Editing your profile requires live mode (Supabase configured).</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center gap-2 text-xs text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading your profile…
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <h2 className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
        <UserRound className="w-4 h-4 text-brand" aria-hidden /> Your profile
      </h2>
      <p className="text-xs text-muted leading-relaxed max-w-md mb-4">
        Your name appears on your messages, tasks, and coaching insights across the product.
      </p>

      <div className="space-y-1.5 mb-4">
        <label htmlFor="profile-name" className="block text-xs font-medium text-secondary">
          Name
        </label>
        <input
          id="profile-name"
          type="text"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={80}
          placeholder="Your name"
          className="w-full max-w-sm bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors"
        />
      </div>

      <div className="space-y-1.5 mb-4">
        <label htmlFor="profile-email" className="block text-xs font-medium text-secondary">
          Sign-in email
        </label>
        <input
          id="profile-email"
          type="email"
          value={email}
          disabled
          readOnly
          className="w-full max-w-sm bg-surface/60 border border-default rounded-lg px-3 py-2 text-sm text-muted cursor-not-allowed"
        />
        <p className="text-[11px] text-muted">
          Changing your email isn&apos;t available here yet — it&apos;s the anchor your whole
          history hangs on, so it stays fixed for now.
        </p>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 mb-3" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || !dirty}
          className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] font-semibold text-xs px-3 py-2 rounded-lg transition-colors"
        >
          <Save className="w-3.5 h-3.5" aria-hidden />
          {saving ? "Saving…" : "Save name"}
        </button>
        {!dirty && savedName && (
          <span className="text-[11px] text-muted">Saved.</span>
        )}
      </div>
    </div>
  );
}
