"use client";

import { useEffect, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { createClient, supabaseEnabled } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import {
  AVATAR_PALETTE,
  avatarColorFor,
  avatarInitialsFor,
  avatarTextColorFor,
  isValidAvatarColor,
  isValidAvatarInitials,
} from "@/lib/brand/avatar";

/**
 * AvatarCustomizationPanel — Settings → Avatar.
 *
 * Users pick a background color (from the brand palette or any custom
 * hex) and override their displayed initials (1-3 chars). Defaults
 * resolve to deterministic per-user values when nothing is set, so the
 * avatar is always stable even without explicit configuration.
 *
 * Writes profiles.avatar_color + profiles.avatar_initials directly via
 * the existing RLS policies on profiles (every user can update their
 * own row). No new API route needed.
 */
export function AvatarCustomizationPanel() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [color, setColor] = useState("");
  const [initials, setInitials] = useState("");
  const [savedAtIso, setSavedAtIso] = useState<string | null>(null);
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
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_color, avatar_initials")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (profile) {
        setFullName(profile.full_name ?? "");
        setColor(profile.avatar_color ?? "");
        setInitials(profile.avatar_initials ?? "");
      }
      setLoading(false);
    })();
  }, []);

  const effectiveColor = color || avatarColorFor(userId, fullName);
  const effectiveInitials = initials || avatarInitialsFor(fullName);
  const fg = avatarTextColorFor(effectiveColor);

  const save = async () => {
    setError("");
    if (!supabaseEnabled || !userId) return;
    if (color && !isValidAvatarColor(color)) {
      setError("Color must be a 6-digit hex like #FACC15.");
      return;
    }
    if (initials && !isValidAvatarInitials(initials)) {
      setError("Initials must be 1–3 characters.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          avatar_color: color || null,
          avatar_initials: initials || null,
        })
        .eq("id", userId);
      if (updateErr) throw new Error(updateErr.message);
      toast.success(
        "Avatar updated",
        "Your new avatar will show up on the next message refresh."
      );
      setSavedAtIso(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setColor("");
    setInitials("");
  };

  if (!supabaseEnabled) {
    return (
      <div className="glass-card p-6">
        <h2 className="text-sm font-semibold text-primary mb-2">Avatar</h2>
        <p className="text-xs text-muted">
          Avatar customization requires live mode (Supabase configured).
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="glass-card p-6 flex items-center gap-2 text-xs text-muted">
        <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading
        avatar settings…
      </div>
    );
  }

  return (
    <div className="glass-card p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" aria-hidden /> Avatar
          </h2>
          <p className="text-xs text-muted leading-relaxed max-w-md">
            Pick the color + initials shown on your messages across chat,
            tasks, and notifications. Leave either blank to fall back to
            the brand-derived default.
          </p>
        </div>
        {/* Live preview */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
          <div
            className="w-12 h-12 rounded-lg flex items-center justify-center text-base font-bold border border-default/40 shadow-card"
            style={{ backgroundColor: effectiveColor, color: fg }}
          >
            {effectiveInitials}
          </div>
          <p className="text-[10px] text-muted font-mono">Preview</p>
        </div>
      </div>

      {/* Initials */}
      <div className="space-y-1.5 mb-4">
        <label className="block text-xs font-medium text-secondary">
          Initials (1–3 characters)
        </label>
        <input
          type="text"
          value={initials}
          onChange={(e) => setInitials(e.target.value.slice(0, 3))}
          placeholder={avatarInitialsFor(fullName)}
          maxLength={3}
          className="w-32 bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors"
        />
        <p className="text-[11px] text-muted">
          Default: <span className="font-mono">{avatarInitialsFor(fullName)}</span>
          {" "}— derived from your name.
        </p>
      </div>

      {/* Color — palette swatches + custom hex */}
      <div className="space-y-2 mb-4">
        <label className="block text-xs font-medium text-secondary">
          Background color
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {AVATAR_PALETTE.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => setColor(hex)}
              aria-label={`Pick ${hex}`}
              title={hex}
              className={`w-8 h-8 rounded-lg border-2 transition-transform ${
                color === hex
                  ? "border-primary scale-110"
                  : "border-default/40 hover:scale-105"
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder={avatarColorFor(userId, fullName)}
            className="w-32 bg-surface border border-default rounded-lg px-3 py-1.5 text-xs font-mono text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
          />
          <p className="text-[11px] text-muted">
            Custom hex (e.g. <span className="font-mono">#FACC15</span>) — or
            leave blank for the brand-derived default.
          </p>
        </div>
      </div>

      {error && (
        <p className="text-[11px] text-red-400 mb-3" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={reset}
          className="text-xs text-muted hover:text-secondary"
        >
          Reset to defaults
        </button>
        <div className="flex items-center gap-3">
          {savedAtIso && (
            <span className="text-[11px] text-emerald-400">
              Saved at {new Date(savedAtIso).toLocaleTimeString()}
            </span>
          )}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold text-xs px-3 py-2 rounded-lg transition-colors"
          >
            <Save className="w-3.5 h-3.5" aria-hidden />
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
