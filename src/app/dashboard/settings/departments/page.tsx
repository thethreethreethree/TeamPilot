"use client";

import { useEffect, useState } from "react";
import { useSubmitLatch } from "@/lib/hooks/useSubmitLatch";
import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { Archive, Building2, Loader2, Plus, RotateCcw } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

type Dept = {
  id: string;
  name: string;
  description: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export default function DepartmentsSettingsPage() {
  const companyName = useCompanyName();
  const [items, setItems] = useState<Dept[]>([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    const url = `/api/departments${includeArchived ? "?include_archived=1" : ""}`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      setItems(data.departments ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeArchived]);

  const runLatched = useSubmitLatch();

  const create = () => runLatched(async () => {
    if (!newName.trim()) {
      setError("Name is required.");
      return;
    }
    setCreating(true);
    setError(null);
    const res = await fetch("/api/departments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, description: newDescription }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? `Create failed (${res.status})`);
      setCreating(false);
      return;
    }
    setNewName("");
    setNewDescription("");
    setCreating(false);
    void refresh();
  });

  // §3.4 / 558ce56 class: a failed archive/unarchive must be visible. These were
  // bare `await fetch` with no res.ok check — the `create` handler above already
  // setError; these two didn't, so a rejected PATCH silently left the row where
  // it was after refresh.
  const setArchivedState = async (id: string, action: "archive" | "unarchive") => {
    setError(null);
    try {
      const res = await fetch("/api/departments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? `Couldn't ${action} the department (${res.status}).`);
        return;
      }
    } catch {
      setError(`Couldn't reach the server to ${action} the department.`);
      return;
    }
    void refresh();
  };

  const archive = (id: string) => setArchivedState(id, "archive");
  const unarchive = (id: string) => setArchivedState(id, "unarchive");

  return (
    <>
      <TopBar
        title="Departments"
        subtitle={`${companyName ?? "Your team"} · Org chart pillar of the asset gate (§A6)`}
      />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full">
        <LearningHint
          as="block"
          category="Settings · Departments"
          title="Departments"
          whatItIs="The org-chart units within your company. Pillar 1 of the §A6 classification triad — every classified file belongs to one or more departments. Admin-managed: only CEO/COO/admin can create, rename, or archive."
          why="Without real departments, the asset classification gate is theater — files get tagged with made-up labels and the search later doesn't help anyone. Real org-chart units make the gate honest and the retrieval valuable."
          how="Add a department for each function the team actually has (Engineering, Customer Success, etc.). Add a short description so the AI classifier can read department semantics. Archive (not delete) when an area is wound down — historical files stay attributed."
          principle="The org chart is the search index. Honest names + honest descriptions = the team finding what it built."
        >
          <div className="rounded-lg border border-default p-4 bg-white/[0.01] mb-6">
            <h2 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
              <Plus className="w-4 h-4 text-brand" aria-hidden />
              Create a department
            </h2>
            <div className="space-y-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name (e.g., Engineering)"
                className="w-full bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value.slice(0, 200))}
                rows={2}
                placeholder="Short description (optional — helps AI classification)"
                className="w-full bg-surface border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 resize-none"
              />
              {error && (
                <p className="text-xs text-red-300">{error}</p>
              )}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={create}
                  disabled={creating || !newName.trim()}
                  className="bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold text-xs px-3 py-1.5 rounded-md flex items-center gap-1.5"
                >
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
                  Create
                </button>
              </div>
            </div>
          </div>
        </LearningHint>

        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-primary">All departments</h2>
          <label className="text-[11px] text-muted flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
              className="accent-ember-400"
            />
            Show archived
          </label>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-xs text-muted">
            No departments yet. Create one above.
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((d) => (
              <li
                key={d.id}
                className={`rounded-md border px-3 py-2 flex items-start justify-between gap-3 ${
                  d.archivedAt
                    ? "border-default/50 bg-white/[0.01] opacity-60"
                    : "border-default bg-white/[0.02]"
                }`}
              >
                <div className="flex items-start gap-2 flex-1 min-w-0">
                  <Building2 className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary truncate">
                      {d.name}
                      {d.archivedAt && (
                        <span className="text-[10px] uppercase tracking-widest text-muted ml-2">
                          archived
                        </span>
                      )}
                    </p>
                    {d.description && (
                      <p className="text-[11px] text-muted line-clamp-2 mt-0.5">
                        {d.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {d.archivedAt ? (
                    <button
                      type="button"
                      onClick={() => unarchive(d.id)}
                      aria-label="Unarchive"
                      title="Unarchive"
                      className="text-muted hover:text-primary p-1 rounded hover:bg-white/[0.04]"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => archive(d.id)}
                      aria-label="Archive"
                      title="Archive"
                      className="text-muted hover:text-amber-300 p-1 rounded hover:bg-white/[0.04]"
                    >
                      <Archive className="w-3.5 h-3.5" aria-hidden />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
