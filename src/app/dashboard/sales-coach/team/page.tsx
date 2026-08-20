"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Lock, Users, UserPlus, Clock, KeyRound } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";
import { AddAgentDialog } from "@/components/team/AddAgentDialog";
import { TeamPasswordsDialog } from "@/components/team/TeamPasswordsDialog";
import { LearningHint } from "@/components/learning/LearningHint";

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
  const [pendingInvites, setPendingInvites] = useState<
    { id: string; email: string; invitedAt: string }[]
  >([]);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  // The team fetch failed. Kept distinct from "empty roster" AND from "not a manager": on a transient error
  // isManager stays false, which would otherwise tell a real admin they'd lost admin access, and members stays
  // null, which would read as "No members found". An error is neither (error-as-no-data / INV22).
  const [loadError, setLoadError] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const res = await fetch("/api/coach/sales-session/team").catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        setIsManager(!!d.isManager);
        setMembers(d.members ?? []);
        setPendingInvites(d.pendingInvites ?? []);
      } else {
        // Network error or 5xx — NOT an empty team and NOT a demotion. Flag it so the render shows an honest
        // "couldn't load", never the admin-only gate or "No members found".
        setLoadError(true);
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

  const revokeInvite = async (inv: { id: string; email: string }) => {
    // Cancel a pending invite (wrong email, changed mind). Optimistic drop; on failure, reload the true state.
    // Uses the shared /api/team DELETE revoke path (which asserts a row was actually revoked).
    setPendingInvites((ps) => ps.filter((p) => p.id !== inv.id));
    try {
      const res = await fetch(`/api/team?invitationId=${encodeURIComponent(inv.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "failed");
      }
      toast.success("Invite canceled", `The invite to ${inv.email} was canceled.`);
    } catch (e) {
      void load(); // restore the real list — the revoke didn't land
      toast.error("Couldn't cancel the invite", e instanceof Error ? e.message : undefined);
    }
  };

  return (
    <>
      <TopBar title="Team" subtitle="Sales Coach access & roles" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl mx-auto w-full space-y-4 bg-base">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-5">
            <p className="text-xs text-amber-300 leading-relaxed">
              Couldn&apos;t load your team right now — this is an error, not an
              empty team, and it doesn&apos;t change your access. Try again shortly.
            </p>
          </div>
        ) : !isManager ? (
          <LearningHint
            as="block"
            category="Sales Coach · Team"
            title="Admin-only gate"
            whatItIs="This page is visible in full only to a Sales Coach admin (or a company admin). As a non-admin you see this notice instead of the roster."
            why="Who gets coached and at what level is a configuration decision, and letting anyone reassign it would scramble access. The gate keeps role management with the people accountable for the team's growth."
            how="If you need to use the Sales Coach or change someone's access, ask a Sales Coach admin to grant it — they can assign your role here."
            principle="Access controls exist to keep responsibility clear, not to hide the work happening behind them."
          >
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-5">
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
          </LearningHint>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2">
              <LearningHint
                as="inline-block"
                category="Sales Coach · Team"
                title="Members"
                whatItIs="Everyone in your company who can be given a Sales Coach role, listed so you can grant or change access in one place."
                why="Coaching only reaches people you've deliberately included. Keeping the roster in view means no one is quietly left out — or left with access they no longer need."
                how="Scan the list to see who has what role, then use the role buttons on each row to adjust."
                principle="A clear roster is the first honest answer to 'who is this actually helping?'"
              >
              <h2 className="text-sm font-semibold text-primary">Members</h2>
              </LearningHint>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPwOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold border border-ember-400/40 text-brand hover:bg-ember-400/10 px-3 py-1.5 rounded-lg transition-colors"
                >
                  <KeyRound className="w-3.5 h-3.5" aria-hidden />
                  Team passwords
                </button>
                <LearningHint
                  as="inline-block"
                  category="Sales Coach · Team"
                  title="Add agent"
                  whatItIs="Adds a team member by email. An existing Elostate/Sales Coach account joins immediately; a brand-new person is created with a team password and sets their own on first login."
                  why="You can only coach people the system knows about. This is the on-ramp — no invite link to chase; add the person once, set their role here."
                  how="Click it, enter their email, pick Existing or New (new users need a team password), then assign their Sales Coach access."
                  principle="Bring the person in first, then decide their level — access is a deliberate step, not an accident of signup."
                >
                <button
                  type="button"
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] text-[#09090B] px-3 py-1.5 rounded-lg transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" aria-hidden />
                  Add agent
                </button>
                </LearningHint>
              </div>
            </div>
            <LearningHint
              as="block"
              category="Sales Coach · Team"
              title="How roles work"
              whatItIs="An explainer: Sales Coach roles (staff or admin) are set here and are independent of a person's Elostate company role."
              why="People assume the two roles are the same and get confused about who can do what. Separating them lets you decide Sales Coach access on its own terms — a company admin isn't automatically a coaching admin, and vice versa."
              how="Read this once to understand the model: invite via Add agent, then assign a Sales Coach role on the person's row."
              principle="Access should follow the responsibility you intend, not inherit whatever role someone happened to already have."
            >
            <div className="flex items-start gap-2 rounded-lg border border-ember-400/30 bg-ember-400/5 p-3">
              <Users className="w-4 h-4 text-brand shrink-0 mt-0.5" aria-hidden />
              <p className="text-xs text-secondary leading-relaxed">
                Assign company members as Sales Coach <span className="text-primary">staff</span>{" "}
                or <span className="text-primary">admin</span>. This sets who the
                product is for and who can manage it — independent of their
                Elostate role. Add people with{" "}
                <span className="text-primary">Add agent</span> — an existing
                account joins right away; a new person is created with a{" "}
                <span className="text-primary">team password</span> (managed under
                Team passwords) and sets their own on first login.
              </p>
            </div>
            </LearningHint>
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm divide-y divide-default overflow-hidden">
              {(members ?? []).map((m, mi) => (
                <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  {mi === 0 ? (
                    <LearningHint
                      as="block"
                      category="Sales Coach · Team"
                      title="Member identity"
                      whatItIs="Each row shows the person's name and their Elostate company role — the role they already hold, separate from any Sales Coach access."
                      why="Showing the Elostate role next to the name stops the two role systems from being confused. You can see who someone is in the company before deciding their coaching access."
                      how="Read the name and the 'Elostate:' line to identify the person, then set their Sales Coach role with the buttons on the right."
                      principle="Know who you're granting access to before you grant it — identity first, then the decision."
                    >
                    <div className="min-w-0">
                      <p className="text-sm text-primary truncate">
                        {m.fullName ?? "Unnamed"}
                      </p>
                      <p className="text-[10px] text-muted">
                        Elostate: {m.companyRole ?? "—"}
                      </p>
                    </div>
                    </LearningHint>
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm text-primary truncate">
                        {m.fullName ?? "Unnamed"}
                      </p>
                      <p className="text-[10px] text-muted">
                        Elostate: {m.companyRole ?? "—"}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {m.salesCoachRole === null && (
                      // Joined the company but has no Sales Coach role yet → can't use the coach. Surface it so
                      // the "invite → forgot to assign Staff" gap is visible, not silent.
                      <span className="text-[10px] font-semibold text-ember-300 bg-ember-400/10 border border-ember-400/30 rounded px-1.5 py-0.5 whitespace-nowrap">
                        No access yet
                      </span>
                    )}
                    {m.salesCoachRole === "admin" && (
                      mi === 0 ? (
                        <LearningHint
                          as="inline-block"
                          category="Sales Coach · Team"
                          title="Admin badge"
                          whatItIs="This shield marks a person whose Sales Coach role is admin — they can manage the team and roles, not just use the coach."
                          why="Admin access is powerful, so it's worth being able to spot at a glance who holds it. The badge makes over-granting visible before it becomes a problem."
                          how="Use it to audit at a glance — every shield is someone who can change access. Keep the admin set small and intentional."
                          principle="Powerful access should be easy to see, so it stays deliberate."
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-brand" aria-hidden />
                        </LearningHint>
                      ) : (
                        <ShieldCheck className="w-3.5 h-3.5 text-brand" aria-hidden />
                      )
                    )}
                    {mi === 0 ? (
                      <LearningHint
                        as="inline-block"
                        category="Sales Coach · Team"
                        title="Role selector"
                        whatItIs="The three buttons — dash, Staff, Admin — set this person's Sales Coach role. Dash removes access; Staff can use the coach; Admin can also manage the team."
                        why="Access should match what each person actually needs to do. One-tap role changes keep the roster honest as people join, change jobs, or leave."
                        how="Tap the level you intend. It saves immediately (and rolls back with a message if the save fails), so change it the moment someone's needs change."
                        principle="Grant the least access that lets the person do their job — no more, and revisit it as things change."
                      >
                      <span className="flex items-center gap-1.5">
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
                      </span>
                      </LearningHint>
                    ) : (
                      OPTIONS.map((opt) => (
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
                      ))
                    )}
                  </div>
                </div>
              ))}
              {(members ?? []).length === 0 && (
                <p className="text-xs text-muted py-6 text-center">
                  No members found.
                </p>
              )}
            </div>

            {pendingInvites.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-default">
                  <Clock className="w-3.5 h-3.5 text-muted" aria-hidden />
                  <h3 className="text-xs font-semibold text-secondary">Invited — waiting to accept</h3>
                </div>
                <div className="divide-y divide-default">
                  {pendingInvites.map((inv) => (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 px-4 py-2.5"
                    >
                      <p className="text-xs text-secondary truncate">{inv.email}</p>
                      <button
                        type="button"
                        onClick={() => void revokeInvite(inv)}
                        className="text-[10px] text-muted hover:text-red-400 border border-default hover:border-red-400/40 rounded px-2 py-0.5 whitespace-nowrap transition-colors"
                        title="Cancel this invite"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted px-4 py-2.5 border-t border-default leading-relaxed">
                  Once they accept, they move to the list above — set them to{" "}
                  <span className="text-primary">Staff</span> to give them the coach.
                </p>
              </div>
            )}

            <AddAgentDialog
              open={inviteOpen}
              onClose={() => setInviteOpen(false)}
              onAdded={(msg) => {
                toast.success("Added to team", msg);
                void load();
              }}
            />
            <TeamPasswordsDialog open={pwOpen} onClose={() => setPwOpen(false)} />
          </>
        )}
      </div>
    </>
  );
}
