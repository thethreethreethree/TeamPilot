"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, UserPlus, Users } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { fetchTeam, type TeamMember } from "@/lib/data/team";
import { addParticipantsToTopic } from "@/lib/data/chats";

/**
 * AddParticipantsDialog — semantically distinct from the team-
 * invitation flow. The user explicitly called this out: "invite to
 * team is for new team members; invite to chat should be for current
 * team members."
 *
 * Behavior:
 *   - Fetches the company roster (active members only).
 *   - Excludes the current participants of the topic so the user only
 *     sees adds, not no-ops.
 *   - Multi-select with a search filter (so it scales past a handful).
 *   - Submit upserts the chosen members into `chat_participants` for
 *     this topic; the RLS policy on inserts allows any company member
 *     to add a teammate to a topic in their own company.
 *
 * What this is NOT: it does not generate invitation codes, does not
 * mailto anyone, does not touch auth.users. For onboarding net-new
 * people the user goes to /dashboard/team.
 */

type Props = {
  open: boolean;
  topicId: string;
  topicTitle: string;
  alreadyParticipantIds: ReadonlySet<string>;
  onClose: () => void;
  onAdded?: () => void;
};

export function AddParticipantsDialog({
  open,
  topicId,
  topicTitle,
  alreadyParticipantIds,
  onClose,
  onAdded,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (!open) {
      setSelected(new Set());
      setQuery("");
      setError("");
      setDone(0);
      return;
    }
    setLoading(true);
    void fetchTeam()
      .then((snap) => setMembers(snap.members))
      .finally(() => setLoading(false));
  }, [open]);

  const addable = useMemo(
    () =>
      members
        .filter((m) => m.status === "active")
        .filter((m) => !alreadyParticipantIds.has(m.id))
        .filter((m) => {
          if (!query.trim()) return true;
          const q = query.toLowerCase();
          return (
            (m.fullName ?? "").toLowerCase().includes(q) ||
            m.role.toLowerCase().includes(q)
          );
        }),
    [members, alreadyParticipantIds, query]
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const submit = async () => {
    if (selected.size === 0) {
      setError("Pick at least one teammate to add.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const { added } = await addParticipantsToTopic(
        topicId,
        Array.from(selected)
      );
      setDone(added);
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add members.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Add members to topic" size="md">
      {done > 0 ? (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 flex items-center gap-2">
            <CheckCircle2
              className="w-4 h-4 text-emerald-300 flex-shrink-0"
              aria-hidden
            />
            <p className="text-xs text-primary">
              Added {done} {done === 1 ? "member" : "members"} to{" "}
              <span className="font-semibold text-brand">{topicTitle}</span>.
            </p>
          </div>
          <div className="flex items-center justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-xs text-brand hover:text-primary px-3 py-2"
            >
              Done
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3" aria-busy={loading || submitting}>
          <p className="text-[11px] text-muted leading-relaxed">
            Add existing teammates to <span className="text-brand">{topicTitle}</span>.
            They&apos;ll be able to read and post messages here. To onboard
            someone brand-new to your company, use the Team page instead.
          </p>

          <div className="relative">
            <Search
              className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or role…"
              className="w-full bg-surface border border-default rounded-lg pl-9 pr-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-default divide-y divide-default">
            {loading ? (
              <div className="py-8 flex items-center justify-center gap-2 text-xs text-muted">
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                Loading roster…
              </div>
            ) : addable.length === 0 ? (
              <div className="py-8 text-center">
                <Users
                  className="w-5 h-5 text-muted mx-auto mb-2"
                  aria-hidden
                />
                <p className="text-xs text-primary mb-1">
                  No more teammates to add.
                </p>
                <p className="text-[11px] text-muted max-w-xs mx-auto">
                  Everyone in your company is already in this topic. To
                  onboard a new person, head to the Team page.
                </p>
              </div>
            ) : (
              addable.map((m) => {
                const checked = selected.has(m.id);
                const initials = (m.fullName ?? "?")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                return (
                  <button
                    type="button"
                    key={m.id}
                    onClick={() => toggle(m.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      checked
                        ? "bg-ember-400/8"
                        : "hover:bg-surface-raised"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(m.id)}
                      aria-label={`Select ${m.fullName ?? "member"}`}
                      className="h-4 w-4 rounded border-default accent-ember-400"
                    />
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary truncate">
                        {m.fullName ?? "—"}
                      </p>
                      <p className="text-[10px] text-muted font-mono">
                        {m.role}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {error && (
            <p className="text-xs text-red-400" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-default">
            <p className="text-[11px] text-muted">
              {selected.size} selected
              {addable.length > 0 ? ` · ${addable.length} available` : ""}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="text-xs text-muted hover:text-secondary px-3 py-2 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || selected.size === 0}
                className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
              >
                {submitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                ) : (
                  <UserPlus className="w-3.5 h-3.5" aria-hidden />
                )}
                {submitting
                  ? "Adding…"
                  : `Add ${selected.size > 0 ? selected.size : ""}`.trim()}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
