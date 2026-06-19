"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { Loader2, Tag, X } from "lucide-react";

/**
 * Asset System v1 — the classification gate UI.
 *
 * Per §3.2 (Understanding Gate is structural) — this modal is
 * the user-facing surface of the gate. The schema enforces the
 * derivation; this UI makes the act of classification
 * deliberate. Per §A11 — the System suggests (eventually);
 * the user always decides.
 *
 * Fields:
 *   - Title (required, ≤120 chars)
 *   - Description (short, ≤500 chars)
 *   - Departments (multi-select, ≥1 for classified lane)
 *   - Tasks (multi-select, ≥1 for classified lane)
 *   - Tags (chips, free-text, lowercase, ≤40 chars each)
 *   - Access role (everyone / admins / ceo_admins / specific_people)
 *
 * Save button shows the CURRENT lane the file will land in
 * (classified vs casual) so the user makes an informed choice.
 */

export type ClassificationDept = { id: string; name: string };
export type ClassificationTask = { id: string; title: string };

export type ClassificationDraft = {
  title: string;
  description: string;
  departmentIds: string[];
  taskIds: string[];
  tags: string[];
  accessRole: "everyone" | "admins" | "ceo_admins" | "specific_people";
};

export type ClassificationPerson = { id: string; fullName: string | null };

export function ClassificationModal({
  open,
  onClose,
  fileId,
  initial,
  departments,
  tasks,
  teamMembers,
  onSaved,
  casualRemaining,
}: {
  open: boolean;
  onClose: () => void;
  fileId: string;
  initial: Partial<ClassificationDraft>;
  departments: ClassificationDept[];
  tasks: ClassificationTask[];
  teamMembers?: ClassificationPerson[];
  onSaved: (file: unknown) => void;
  casualRemaining: number;
}) {
  const [grants, setGrants] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    if (initial.accessRole !== "specific_people") return;
    void (async () => {
      const res = await fetch(`/api/files/${fileId}/access`);
      if (res.ok) {
        const data = await res.json();
        setGrants(
          (data.grants ?? []).map((g: { profile_id: string }) => g.profile_id)
        );
      }
    })();
  }, [open, fileId, initial.accessRole]);

  const toggleGrant = async (profileId: string) => {
    if (grants.includes(profileId)) {
      setGrants((g) => g.filter((x) => x !== profileId));
      await fetch(`/api/files/${fileId}/access?profileId=${profileId}`, {
        method: "DELETE",
      });
    } else {
      setGrants((g) => [...g, profileId]);
      await fetch(`/api/files/${fileId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId }),
      });
    }
  };
  const [title, setTitle] = useState(initial.title ?? "");
  const [description, setDescription] = useState(initial.description ?? "");
  const [departmentIds, setDepartmentIds] = useState<string[]>(
    initial.departmentIds ?? []
  );
  const [taskIds, setTaskIds] = useState<string[]>(initial.taskIds ?? []);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [accessRole, setAccessRole] = useState<ClassificationDraft["accessRole"]>(
    initial.accessRole ?? "everyone"
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle(initial.title ?? "");
      setDescription(initial.description ?? "");
      setDepartmentIds(initial.departmentIds ?? []);
      setTaskIds(initial.taskIds ?? []);
      setTags(initial.tags ?? []);
      setAccessRole(initial.accessRole ?? "everyone");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fileId]);

  const willClassify =
    departmentIds.length > 0 &&
    taskIds.length > 0 &&
    description.trim().length > 0;

  const addTag = () => {
    const t = tagInput.trim().toLowerCase();
    if (!t || t.length > 40 || tags.includes(t)) {
      setTagInput("");
      return;
    }
    setTags((arr) => [...arr, t]);
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setTags((arr) => arr.filter((x) => x !== t));
  };

  const toggleDepartment = (id: string) => {
    setDepartmentIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
    );
  };

  const toggleTask = (id: string) => {
    setTaskIds((arr) =>
      arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]
    );
  };

  const save = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!willClassify && casualRemaining <= 0) {
      setError(
        "Casual cap reached today (3/3). Add a department, a task, AND a description to classify."
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/files/${fileId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          departmentIds,
          taskIds,
          tags,
          accessRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? `Save failed (${res.status})`);
        setSaving(false);
        return;
      }
      onSaved(data.file);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Classify this asset"
      size="lg"
    >
      <div className="space-y-4">
        {/* Lane preview */}
        <div
          className={`rounded-md border px-3 py-2 text-xs flex items-center gap-2 ${
            willClassify
              ? "border-emerald-500/40 bg-emerald-500/[0.06] text-emerald-300"
              : "border-amber-500/30 bg-amber-500/[0.05] text-accent-text"
          }`}
        >
          <span className="font-bold uppercase tracking-widest text-[10px]">
            {willClassify ? "Classified" : "Casual"}
          </span>
          <span className="text-secondary">
            {willClassify
              ? "Becomes a team asset — searchable, citable, retrievable."
              : `Missing classification. Counts against your 3/day cap (${casualRemaining} remaining).`}
          </span>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1 block">
            Title <span className="text-red-300">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="e.g., June budget report — finance team review"
            className="w-full bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
          />
          <p className="text-[10px] text-muted mt-0.5">{title.length}/120</p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1 block">
            Short description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, 500))}
            rows={3}
            placeholder="What is this file about? (3-5 lines max)"
            className="w-full bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 resize-none"
          />
          <p className="text-[10px] text-muted mt-0.5">
            {description.length}/500 · Required for classified lane.
          </p>
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1 block">
            Departments {departmentIds.length === 0 && <span className="text-red-300/60">(at least 1 for classified)</span>}
          </label>
          {departments.length === 0 ? (
            <p className="text-xs text-muted italic">
              No departments yet. An admin can create them in Settings.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {departments.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => toggleDepartment(d.id)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    departmentIds.includes(d.id)
                      ? "bg-ember-400/15 border-ember-400/50 text-brand"
                      : "border-default text-secondary hover:border-strong"
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1 block">
            Related tasks {taskIds.length === 0 && <span className="text-red-300/60">(at least 1 for classified)</span>}
          </label>
          {tasks.length === 0 ? (
            <p className="text-xs text-muted italic">No open tasks to link to.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {tasks.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTask(t.id)}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors text-left ${
                    taskIds.includes(t.id)
                      ? "bg-ember-400/15 border-ember-400/50 text-brand"
                      : "border-default text-secondary hover:border-strong"
                  }`}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1 block">
            Tags (chips)
          </label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {tags.map((t) => (
              <span
                key={t}
                className="text-[11px] inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-ember-400/10 border border-ember-400/30 text-brand"
              >
                <Tag className="w-3 h-3" aria-hidden />
                {t}
                <button
                  type="button"
                  onClick={() => removeTag(t)}
                  aria-label={`Remove tag ${t}`}
                  className="text-muted hover:text-primary"
                >
                  <X className="w-3 h-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                addTag();
              }
            }}
            onBlur={addTag}
            placeholder="Type a tag and press Enter…"
            className="w-full bg-surface border border-default rounded-md px-3 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
          />
        </div>

        <div>
          <label className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1 block">
            Who can see this file?
          </label>
          <select
            value={accessRole}
            onChange={(e) =>
              setAccessRole(e.target.value as ClassificationDraft["accessRole"])
            }
            className="w-full bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary focus:outline-none focus:border-ember-400/50"
          >
            <option value="everyone">Everyone in the company</option>
            <option value="admins">Admins (CEO / COO / admin) only</option>
            <option value="ceo_admins">CEO + admins only</option>
            <option value="specific_people">Specific people (configure later)</option>
          </select>
          <p className="text-[10px] text-muted mt-0.5">
            You (the uploader) always see your own file regardless of this setting.
          </p>
          {accessRole === "specific_people" && (
            <div className="mt-2 rounded-md border border-default p-2">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1.5">
                Who specifically?
              </p>
              {!teamMembers || teamMembers.length === 0 ? (
                <p className="text-[11px] text-muted italic">
                  No teammates available.
                </p>
              ) : (
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {teamMembers.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleGrant(p.id)}
                      className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                        grants.includes(p.id)
                          ? "bg-ember-400/15 border-ember-400/50 text-brand"
                          : "border-default text-secondary hover:border-strong"
                      }`}
                    >
                      {p.fullName ?? "Unnamed"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/30 rounded-md px-3 py-2">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-secondary hover:text-primary px-3 py-1.5 rounded-md border border-default hover:border-strong"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || !title.trim()}
            className="bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold text-xs px-4 py-1.5 rounded-md flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
            {willClassify ? "Save as classified" : "Save as casual"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
