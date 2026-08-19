"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, UserPlus, Users } from "lucide-react";
import type { Employee } from "@/lib/schedule/types";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";

/**
 * Schedule Management System — the staff roster page (Phase 5). Standalone tool: a manager enters staff
 * directly (no Elostate account for the staff). Add-form + list, wired to /api/schedule/employees. The
 * grid schedule view + the file upload are sibling surfaces. Honest loading/error (never a false-empty).
 */

type FormState = { name: string; role: string; skills: string; maxHours: string };
const EMPTY: FormState = { name: "", role: "", skills: "", maxHours: "" };

export default function ScheduleRosterPage() {
  const [roster, setRoster] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const togglingRef = useRef<Set<string>>(new Set()); // per-id double-submit latch (RQ13 class)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(EMPTY);
  const savingEditRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/schedule/employees");
      if (res.ok) {
        const d = await res.json();
        setRoster(d.employees ?? []);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // savingRef is a synchronous latch — the `saving` state alone can double-fire (two fast clicks both
    // read saving === false before the re-render), creating a DUPLICATE staff record.
    if (!form.name.trim() || saving || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/schedule/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role.trim() || null,
          skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
          maxHoursWeek: form.maxHours.trim() ? Number(form.maxHours) : null,
        }),
      });
      if (res.status === 201) {
        setForm(EMPTY);
        await load();
      } else if (res.status === 403) {
        setFormError("Only a manager can add staff.");
      } else {
        setFormError("Couldn't add the staff member. Please try again.");
      }
    } catch {
      setFormError("Couldn't reach the server. Please try again.");
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  };

  const startEdit = (emp: Employee) => {
    setEditingId(emp.id);
    setEditForm({
      name: emp.name,
      role: emp.role ?? "",
      skills: emp.skills.join(", "),
      maxHours: emp.maxHoursWeek != null ? String(emp.maxHoursWeek) : "",
    });
    setFormError(null);
  };
  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    if (savingEditRef.current || !editForm.name.trim()) return;
    savingEditRef.current = true;
    setFormError(null);
    try {
      const res = await fetch(`/api/schedule/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editForm.name.trim(),
          role: editForm.role.trim() || null,
          skills: editForm.skills.split(",").map((s) => s.trim()).filter(Boolean),
          maxHoursWeek: editForm.maxHours.trim() ? Number(editForm.maxHours) : null,
        }),
      });
      if (res.ok) { setEditingId(null); await load(); }
      else setFormError(res.status === 403 ? "Only a manager can update staff." : "Couldn't save the changes.");
    } catch { setFormError("Couldn't reach the server."); }
    finally { savingEditRef.current = false; }
  };

  // Deactivate a departed employee (or reactivate). Deactivating flips status → inactive so isEligible stops
  // scheduling them. Per-id ref latch so a double-click can't double-submit the same row.
  const toggleStatus = async (emp: Employee) => {
    if (togglingRef.current.has(emp.id)) return;
    togglingRef.current.add(emp.id);
    setTogglingId(emp.id);
    setFormError(null);
    const next = emp.status === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/schedule/employees/${emp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      if (res.ok) await load();
      else setFormError(res.status === 403 ? "Only a manager can update staff." : "Couldn't update the staff member.");
    } catch {
      setFormError("Couldn't reach the server.");
    } finally {
      setTogglingId(null);
      togglingRef.current.delete(emp.id);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8 max-w-3xl mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <Users className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">Staff Roster</h1>
      </div>
      <p className="text-xs text-muted mb-5">
        Your team, entered directly. No account needed for staff. Add people here, then build their schedule.
      </p>

      {/* Add-staff form */}
      <form onSubmit={submit} className="glass-card p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-secondary">
          <UserPlus className="w-4 h-4" aria-hidden /> Add a staff member
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Name (required)"
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted"
          />
          <input
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
            placeholder="Role (e.g. cashier)"
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted"
          />
          <input
            value={form.skills}
            onChange={(e) => setForm((f) => ({ ...f, skills: e.target.value }))}
            placeholder="Skills, comma separated"
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted"
          />
          <input
            value={form.maxHours}
            onChange={(e) => setForm((f) => ({ ...f, maxHours: e.target.value }))}
            placeholder="Max hours / week (optional)"
            inputMode="numeric"
            className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted"
          />
        </div>
        {formError && <p className="text-xs text-red-300">{formError}</p>}
        <button
          type="submit"
          disabled={!form.name.trim() || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <UserPlus className="w-3.5 h-3.5" aria-hidden />}
          Add staff
        </button>
      </form>

      {/* Roster list */}
      {error ? (
        <div className="glass-card p-5 border border-red-500/30">
          <p className="text-sm text-red-300">
            Couldn&apos;t load the roster. This is an error, not an empty team. Check your connection and try again.
          </p>
          <button type="button" onClick={() => void load()} className="mt-3 text-sm font-semibold text-brand hover:underline">
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading roster…
        </div>
      ) : roster.length === 0 ? (
        <p className="text-sm text-muted">No staff yet. Add your first team member above.</p>
      ) : (
        <ul className="space-y-2">
          {roster.map((emp) =>
            editingId === emp.id ? (
              <li key={emp.id} className="glass-card p-3.5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Name" className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
                  <input value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                    placeholder="Role" className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
                  <input value={editForm.skills} onChange={(e) => setEditForm((f) => ({ ...f, skills: e.target.value }))}
                    placeholder="Skills (comma separated)" className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
                  <input value={editForm.maxHours} onChange={(e) => setEditForm((f) => ({ ...f, maxHours: e.target.value }))}
                    placeholder="Max hours/week" inputMode="numeric" className="rounded-lg bg-surface border border-white/10 px-3 py-2 text-sm text-primary" />
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void saveEdit(emp.id)} disabled={!editForm.name.trim()}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-brand text-black font-semibold disabled:opacity-50">Save</button>
                  <button type="button" onClick={cancelEdit}
                    className="text-[11px] px-3 py-1.5 rounded-lg bg-surface border border-white/10 text-secondary">Cancel</button>
                </div>
              </li>
            ) : (
              <li key={emp.id} className="glass-card p-3.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-primary truncate">
                    {emp.name}
                    {emp.status === "inactive" && <span className="ml-2 text-[11px] text-muted">(inactive)</span>}
                  </div>
                  <div className="text-[11px] text-muted">
                    {emp.role ?? "no role"}
                    {emp.skills.length > 0 && ` · ${emp.skills.join(", ")}`}
                    {emp.maxHoursWeek != null && ` · max ${emp.maxHoursWeek}h/wk`}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-1.5">
                  <button type="button" onClick={() => startEdit(emp)}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-surface border border-white/10 text-secondary">Edit</button>
                  <button type="button" onClick={() => void toggleStatus(emp)} disabled={togglingId === emp.id}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-surface border border-white/10 text-secondary disabled:opacity-50">
                    {togglingId === emp.id ? "…" : emp.status === "active" ? "Deactivate" : "Reactivate"}
                  </button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
