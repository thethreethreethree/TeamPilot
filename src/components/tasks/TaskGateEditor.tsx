"use client";

import { useEffect, useState } from "react";
import { Loader2, Pencil, Save, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * TaskGateEditor — persistent, always-editable Understanding-Gate
 * answers on a task.
 *
 * Per the user's design choice (2026-06-15): "keep the gate answer
 * on the task always editable but create an identifier when it was
 * edited." The identifier is `tasks.gate_last_edited_at` — stamped
 * automatically by the 0032 trigger on any gate edit; this UI just
 * renders it and offers an inline-edit affordance.
 *
 * §A11 alignment: the timestamp is a FACT (when did this last
 * change?), never a verdict ("this row edits the gate too often").
 * The user reads the count and renders the verdict. The S3 follow-up
 * may add a mirror chip when edits cluster, but at that point it's
 * still a count + a question, never a rating.
 *
 * §A7 alignment: when the gate has never been edited since clearing,
 * the read is silent (no datum standalone). When it HAS been edited,
 * the timestamp comes paired with the edit affordance — the user has
 * a constructive next move right next to the read.
 */
export function TaskGateEditor({
  taskId,
  gateMode,
  gateWhat,
  gateResources,
  gateRoles,
  gateLastEditedAt,
  onSaved,
}: {
  taskId: string;
  gateMode: "small" | "real" | null;
  gateWhat: string | null;
  gateResources: string | null;
  gateRoles: string | null;
  gateLastEditedAt: string | null;
  /** Called after a successful save so the parent can refresh the
   *  task row (and the new gate_last_edited_at value flows back in). */
  onSaved: () => void;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftWhat, setDraftWhat] = useState(gateWhat ?? "");
  const [draftResources, setDraftResources] = useState(gateResources ?? "");
  const [draftRoles, setDraftRoles] = useState(gateRoles ?? "");

  // Re-sync local drafts when the underlying task row refreshes
  // (e.g. after a save, or when another participant edits).
  useEffect(() => {
    if (!editing) {
      setDraftWhat(gateWhat ?? "");
      setDraftResources(gateResources ?? "");
      setDraftRoles(gateRoles ?? "");
    }
  }, [editing, gateWhat, gateResources, gateRoles]);

  const cancel = () => {
    setEditing(false);
    setDraftWhat(gateWhat ?? "");
    setDraftResources(gateResources ?? "");
    setDraftRoles(gateRoles ?? "");
  };

  const save = async () => {
    if (!draftWhat.trim()) {
      toast.warn(
        "What we're accomplishing is required",
        "The gate's first answer carries the whole task — name it before saving."
      );
      return;
    }
    if (gateMode === "real") {
      if (!draftResources.trim() || !draftRoles.trim()) {
        toast.warn(
          "Real-mode gate needs all three fields",
          "Resources and Roles round out the structured understanding."
        );
        return;
      }
    }
    setSaving(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: taskId,
          gateWhat: draftWhat.trim(),
          gateResources:
            gateMode === "real" ? draftResources.trim() : draftResources.trim() || null,
          gateRoles:
            gateMode === "real" ? draftRoles.trim() : draftRoles.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't save.");
      toast.success("Gate updated", "The edit is on the §3.1 chain.");
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(
        "Couldn't save",
        err instanceof Error ? err.message : "Unknown error."
      );
    } finally {
      setSaving(false);
    }
  };

  // Display the "last edited" stamp only when it exists. Silent
  // when null (the gate was cleared but never re-edited — no datum
  // to surface, per §A7).
  const editedAgo = gateLastEditedAt
    ? formatRelative(new Date(gateLastEditedAt))
    : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-default">
        <div>
          <h3 className="text-xs font-semibold text-primary">
            Understanding (gate answers)
          </h3>
          {editedAgo && (
            <p className="text-[10px] text-muted font-mono">
              Last edited {editedAgo}
            </p>
          )}
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-[11px] text-secondary hover:text-primary border border-default hover:border-strong px-2 py-1 rounded-md transition-colors"
          >
            <Pencil className="w-3 h-3" aria-hidden />
            Edit
          </button>
        ) : (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={cancel}
              disabled={saving}
              className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary px-2 py-1 rounded-md transition-colors disabled:opacity-50"
            >
              <X className="w-3 h-3" aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-2 py-1 rounded-md transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
              ) : (
                <Save className="w-3 h-3" aria-hidden />
              )}
              Save
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 text-xs">
          <Field
            label="What we're accomplishing"
            value={draftWhat}
            onChange={setDraftWhat}
            placeholder="The outcome this task is here to produce."
          />
          {gateMode === "real" && (
            <>
              <Field
                label="Resources we have"
                value={draftResources}
                onChange={setDraftResources}
                placeholder="People, time, tools, money already lined up."
              />
              <Field
                label="Who's involved + their roles"
                value={draftRoles}
                onChange={setDraftRoles}
                placeholder="Who's doing what, and who decides what."
              />
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2 text-xs">
          <ReadRow label="What we're accomplishing" value={gateWhat} />
          {gateMode === "real" && (
            <>
              <ReadRow label="Resources we have" value={gateResources} />
              <ReadRow
                label="Who's involved + their roles"
                value={gateRoles}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-widest text-muted mb-1">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        placeholder={placeholder}
        className="w-full bg-surface border border-default rounded-md px-2 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y"
      />
    </label>
  );
}

function ReadRow({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <span className="block text-[10px] uppercase tracking-widest text-muted mb-0.5">
        {label}
      </span>
      <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">
        {value ?? <span className="text-muted italic">Not set</span>}
      </p>
    </div>
  );
}

/**
 * Relative-time formatter for the "Last edited" stamp. Bounds:
 *   < 1 min  → "just now"
 *   < 1 hr   → "N minutes ago"
 *   < 1 day  → "N hours ago"
 *   < 7 days → "N days ago"
 *   else     → "YYYY-MM-DD"
 */
function formatRelative(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return date.toISOString().slice(0, 10);
}
