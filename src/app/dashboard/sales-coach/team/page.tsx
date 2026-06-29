"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Lock, Users } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";

/**
 * Sales Coach → Team (Phase 3). A manager assigns company members as
 * Sales Coach staff or admin (sets sales_coach_role). §A18 — roles only,
 * no ranking. §A10 — configuration, not surveillance. §3.4 — honest
 * admin-only state for non-managers.
 */

type Member = {
  id: string;
  fullName: string | null;
  companyRole: string | null;
  salesCoachRole: "admin" | "staff" | null;
};

const OPTIONS: { value: "admin" | "staff" | null; label: string }[] = [
  { value: null, label: "—" },
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Admin" },
];

export default function SalesCoachTeamPage() {
  const toast = useToast();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/sales-session/team").catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        setIsManager(!!d.isManager);
        setMembers(d.members ?? []);
      } else {
        setMembers([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const setRole = async (m: Member, next: "admin" | "staff" | null) => {
    const prev = m.salesCoachRole;
    setMembers((ms) =>
      (ms ?? []).map((x) => (x.id === m.id ? { ...x, salesCoachRole: next } : x))
    );
    try {
      const res = await fetch("/api/coach/sales-session/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: m.id, salesCoachRole: next }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "failed");
      }
      toast.success(
        next ? `${m.fullName ?? "Member"} → ${next}` : `${m.fullName ?? "Member"} removed`
      );
    } catch (e) {
      setMembers((ms) =>
        (ms ?? []).map((x) => (x.id === m.id ? { ...x, salesCoachRole: prev } : x))
      );
      toast.error("Couldn't update", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <>
      <TopBar title="Team" subtitle="Sales Coach access & roles" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl mx-auto w-full space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : !isManager ? (
          <div className="rounded-xl border border-default bg-white/[0.01] p-5">
            <div className="inline-flex items-center gap-1.5 text-[11px] text-muted rounded-md border border-default px-2 py-1 mb-3">
              <Lock className="w-3 h-3" aria-hidden />
              Admin only
            </div>
            <h2 className="text-sm font-semibold text-primary mb-1">
              Team management is admin-only
            </h2>
            <p className="text-xs text-secondary leading-relaxed">
              Only a Sales Coach admin (or a company admin) can assign who uses
              the Sales Coach and at what level. Ask one of them to give you
              access.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start gap-2 rounded-lg border border-ember-400/30 bg-ember-400/5 p-3">
              <Users className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-secondary leading-relaxed">
                Assign company members as Sales Coach <span className="text-primary">staff</span>{" "}
                or <span className="text-primary">admin</span>. This sets who the
                product is for and who can manage it — independent of their
                Elostate role.
              </p>
            </div>
            <div className="rounded-xl border border-default bg-white/[0.01] divide-y divide-default overflow-hidden">
              {(members ?? []).map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-primary truncate">
                      {m.fullName ?? "Unnamed"}
                    </p>
                    <p className="text-[10px] text-muted">
                      Elostate: {m.companyRole ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.salesCoachRole === "admin" && (
                      <ShieldCheck className="w-3.5 h-3.5 text-brand" aria-hidden />
                    )}
                    {OPTIONS.map((opt) => (
                      <button
                        key={String(opt.value)}
                        type="button"
                        onClick={() => void setRole(m, opt.value)}
                        className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                          m.salesCoachRole === opt.value
                            ? "border-ember-400/50 bg-ember-400/10 text-brand"
                            : "border-default text-secondary hover:text-primary"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {(members ?? []).length === 0 && (
                <p className="text-xs text-muted py-6 text-center">
                  No members found.
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
