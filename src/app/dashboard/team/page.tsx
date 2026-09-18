"use client";

import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { supabaseEnabled } from "@/lib/supabase/client";
import { siteUrl } from "@/lib/siteUrl";
import { fetchTeam, type TeamMember, type TeamInvitation } from "@/lib/data/team";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import { useCurrentUserRole } from "@/lib/hooks/useCurrentUserRole";
import { isAdminRole, orgTierLabel, ORG_ROLE_OPTIONS } from "@/lib/roles";
import {
  AlertTriangle,
  Copy,
  Check,
  KeyRound,
  Loader2,
  Mail,
  ShieldOff,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";

// useSearchParams() needs a Suspense boundary or the page fails to prerender (missing-suspense-with-csr-bailout).
export default function TeamPage() {
  return (
    <Suspense fallback={null}>
      <TeamInner />
    </Suspense>
  );
}

function TeamInner() {
  const companyName = useCompanyName();
  const amAdmin = isAdminRole(useCurrentUserRole()); // only an admin sees the org-role (tier) assignment control
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviting, setInviting] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setError("");
    const snap = await fetchTeam();
    setMembers(snap.members);
    setInvitations(snap.invitations);
    // §3.4 / A14: a failed load must NOT render as the "onboarding hasn't
    // completed" empty state. fetchTeam now flags a query failure as
    // "live-error" (distinct from "live-empty"); show it honestly.
    if (snap.mode === "live-error") {
      setError(
        "Couldn't load the team — the database rejected the request. Refresh to retry; if it persists it's likely an access-policy issue."
      );
    }
    setLoading(false);
  };

  useEffect(() => {
    if (supabaseEnabled) refresh();
    else setLoading(false);
  }, []);

  const searchParams = useSearchParams();
  // Consume ?new=1 exactly once. Without removing it from the
  // URL, any subsequent re-render where searchParams re-resolves
  // would re-open the invite modal even after the user has
  // dismissed it. (Audit finding: re-fire bug — user closes the
  // modal, sees it pop back up after typing elsewhere on the
  // page.)
  const handledNewParam = useRef(false);
  const [failedInvites, setFailedInvites] = useState<string[]>([]);
  useEffect(() => {
    if (handledNewParam.current) return;
    if (searchParams.get("new") === "1" && supabaseEnabled) {
      handledNewParam.current = true;
      setInviting(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      window.history.replaceState({}, "", url.toString());
    }
    // Consume ?inviteFailed=email1,email2 (set by the onboarding
    // wizard when one or more invites failed to create). Surface
    // them at the top of the team page so the founder can retry.
    const failedParam = searchParams.get("inviteFailed");
    if (failedParam) {
      const emails = failedParam.split(",").filter(Boolean);
      if (emails.length > 0) {
        setFailedInvites(emails);
        const url = new URL(window.location.href);
        url.searchParams.delete("inviteFailed");
        window.history.replaceState({}, "", url.toString());
      }
    }
  }, [searchParams]);

  const pendingInvites = invitations.filter(
    (i) => !i.acceptedAt && !i.revokedAt && new Date(i.expiresAt) > new Date()
  );

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Team" subtitle={`${companyName} · Members + invitations`} />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {!supabaseEnabled && (
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-300 mx-auto mb-2" />
            <p className="text-sm text-primary mb-1">Live mode required</p>
            <p className="text-xs text-muted max-w-md mx-auto">
              Team management requires the database. Configure Supabase to invite members.
            </p>
          </div>
        )}

        {supabaseEnabled && failedInvites.length > 0 && (
          <div className="glass-card p-4 border border-amber-400/40 bg-amber-400/5">
            <p className="text-sm font-semibold text-brand mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-300" aria-hidden />
              {failedInvites.length} invite
              {failedInvites.length === 1 ? "" : "s"} from onboarding didn&apos;t
              land
            </p>
            <p className="text-xs text-primary leading-relaxed mb-3">
              Either the email was already a member, the address was invalid,
              or the server rejected the request. Re-invite them from the
              Invite button below if you want to try again.
            </p>
            <ul className="text-xs font-mono text-primary bg-base/40 rounded-md p-2 space-y-1">
              {failedInvites.map((email) => (
                <li key={email}>· {email}</li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setFailedInvites([])}
              className="mt-3 text-[11px] text-brand hover:text-brand/80 underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {supabaseEnabled && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">
                  {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
                  {pendingInvites.length} pending invite
                  {pendingInvites.length === 1 ? "" : "s"}
                </p>
              </div>
              <LearningHint
                category="Team · Invite"
                title="Invite member"
                whatItIs="Opens the invite dialog. Generates a unique invite link tied to a specific email + role; the invitee clicks it, lands in auth, and joins this company on accept. Pending invites show on this page until accepted or revoked."
                why="Role is set at invite time because role gates what each user can see and do across the System. CEO/COO/admin see leadership readouts; member doesn't. Support agent gates the C.A.R.E inbox. Getting the role right at invite time prevents downstream confusion."
                how="Click. Type the teammate's email. Pick a role that matches what they'll actually do. Send. Copy the invite link separately if you want to share it via DM. Revoke any time before they accept."
                principle="Role is permissioning that's also pedagogy. A user's role signals what part of the System they're responsible for."
              >
                <button
                  type="button"
                  onClick={() => setInviting(true)}
                  className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-4 py-2 rounded-lg transition-all text-xs"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Invite member
                </button>
              </LearningHint>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            )}

            {!loading && error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            {!loading && !error && (
              <>
                <Section title={`Members (${members.length})`}>
                  {members.length === 0 ? (
                    <p className="text-xs text-muted py-6 text-center">
                      No active members. This usually means onboarding hasn&apos;t
                      completed.
                    </p>
                  ) : (
                    <div className="divide-y divide-default">
                      {members.map((m) => (
                        <MemberRow key={m.id} member={m} amAdmin={amAdmin} onChanged={refresh} onRemoved={refresh} />
                      ))}
                    </div>
                  )}
                </Section>

                <Section title={`Pending invitations (${pendingInvites.length})`}>
                  {pendingInvites.length === 0 ? (
                    <p className="text-xs text-muted py-6 text-center">
                      No pending invitations.
                    </p>
                  ) : (
                    <div className="divide-y divide-default">
                      {pendingInvites.map((i) => (
                        <InviteRow key={i.id} invitation={i} onRevoked={refresh} />
                      ))}
                    </div>
                  )}
                </Section>

                {invitations.filter((i) => i.acceptedAt || i.revokedAt).length > 0 && (
                  <Section title="History">
                    <div className="divide-y divide-default">
                      {invitations
                        .filter((i) => i.acceptedAt || i.revokedAt)
                        .slice(0, 20)
                        .map((i) => (
                          <HistoryRow key={i.id} invitation={i} />
                        ))}
                    </div>
                  </Section>
                )}
              </>
            )}
          </>
        )}
      </div>

      <InviteMemberDialog
        open={inviting}
        onClose={() => setInviting(false)}
        onInvited={refresh}
        companyName={companyName}
        canInviteAdmin={amAdmin}
      />
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="glass-card p-5">
      <h2 className="text-sm font-semibold text-primary mb-4">{title}</h2>
      {children}
    </div>
  );
}

function MemberRow({
  member,
  amAdmin,
  onChanged,
  onRemoved,
}: {
  member: TeamMember;
  amAdmin: boolean;
  onChanged: () => void;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [savingRole, setSavingRole] = useState(false);
  const [resetting, setResetting] = useState(false);
  // The generated password is shown ONCE, in a panel the admin can copy from — never a toast. A credential that
  // auto-dismisses after four seconds is a credential the admin has to ask for again.
  const [reset, setReset] = useState<{ password: string; forced: boolean; note?: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const resetPassword = async () => {
    if (!confirm(`Reset the password for ${member.fullName ?? "this member"}?

Their current password stops working immediately.`)) return;
    setResetting(true);
    const res = await fetch("/api/team/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id }),
    });
    setResetting(false);
    const data = (await res.json().catch(() => null)) as
      | { password?: string; mustChangeOnLogin?: boolean; error?: string }
      | null;
    // The 500-with-a-password case is deliberate, not a bug: the credential HAS changed, so swallowing it would
    // leave this person locked out holding nothing. Show it, and say the rotation wasn't forced.
    if (data?.password) {
      setCopied(false);
      setReset({ password: data.password, forced: data.mustChangeOnLogin === true, note: res.ok ? undefined : data.error });
      return;
    }
    toast.error("Couldn't reset the password", data?.error ?? "Something went wrong — try again.");
  };
  // Change this member's org tier (the `role` field). Admin-only, enforced server-side; C-Suite = admin authority.
  const setOrgRole = async (role: string) => {
    if (role === member.role) return;
    setSavingRole(true);
    const res = await fetch("/api/team/set-role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberId: member.id, role }),
    });
    setSavingRole(false);
    if (res.ok) {
      toast.success("Role updated", `${member.fullName ?? "Member"} is now ${orgTierLabel(role)}.`);
      onChanged();
    } else {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      toast.error("Couldn't change the role", data?.error ?? "Something went wrong — try again.");
    }
  };
  const remove = async () => {
    if (!confirm(`Remove ${member.fullName ?? "this member"}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/team?memberId=${encodeURIComponent(member.id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) {
      onRemoved();
      return;
    }
    // §3.4: a failed removal must be VISIBLE. This handler used to swallow
    // failures — which masked the route's own false-ok bug for weeks (the member
    // silently stayed). Route errors are honest now (403 not-admin / 404 not in
    // company); show them.
    const data = await res.json().catch(() => null);
    toast.error(
      "Couldn't remove the member",
      data?.error ?? "Something went wrong — try again."
    );
  };
  const initials = (member.fullName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center justify-between py-3 gap-2">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-ember-400 to-[#FDE047] flex items-center justify-center text-xs font-bold text-white shrink-0">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-primary truncate">{member.fullName ?? "—"}</p>
          <p className="text-[10px] text-muted font-mono truncate">
            {orgTierLabel(member.role)} · joined {member.createdAt.slice(0, 10)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {amAdmin && (
          <select
            value={ORG_ROLE_OPTIONS.some((o) => o.role === member.role) ? member.role : ""}
            onChange={(e) => void setOrgRole(e.target.value)}
            disabled={savingRole}
            aria-label={`Set org role for ${member.fullName ?? "member"}`}
            title="Set org role (tier)"
            className="text-[11px] bg-base border border-default rounded-md px-1.5 py-1 text-secondary focus:outline-none focus:border-strong disabled:opacity-50 max-w-[9rem]"
          >
            {/* Show a current non-standard role (e.g. the onboarding 'admin') as a disabled hint, so the tier still reads. */}
            {!ORG_ROLE_OPTIONS.some((o) => o.role === member.role) && (
              <option value="" disabled>
                {orgTierLabel(member.role)}
              </option>
            )}
            {ORG_ROLE_OPTIONS.map((o) => (
              <option key={o.role} value={o.role}>
                {o.role === o.tier ? o.role : `${o.role} — ${o.tier}`}
              </option>
            ))}
          </select>
        )}
        {/* Admin-only, and hidden for admin rows — which also hides the admin's OWN row, since an admin's row is
            an admin row. Matches the route, where a self-reset is 400 and an admin target is 403. */}
        {amAdmin && !isAdminRole(member.role) && (
          <button
            type="button"
            onClick={() => void resetPassword()}
            disabled={resetting}
            className="flex items-center gap-1.5 text-xs text-muted hover:text-brand disabled:opacity-40 p-2 -m-2"
            aria-label={`Reset password for ${member.fullName ?? ""}`.trim()}
            title="Reset password"
          >
            {resetting ? (
              <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <KeyRound aria-hidden="true" className="w-3.5 h-3.5" />
            )}
          </button>
        )}
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 disabled:opacity-40 p-2 -m-2"
          aria-label={`Remove member ${member.fullName ?? ""}`.trim()}
          title="Remove member"
        >
          <UserMinus aria-hidden="true" className="w-3.5 h-3.5" />
        </button>
      </div>

      {reset && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={() => setReset(null)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-3">
              <KeyRound className="w-4 h-4 text-brand" aria-hidden />
              <h2 className="text-sm font-semibold text-primary">
                Temporary password for {member.fullName ?? "this member"}
              </h2>
            </div>

            <p className="text-[11px] text-secondary mb-2">
              Shown once. Copy it now — we don&apos;t store it, and closing this box loses it.
            </p>

            <div className="flex items-center gap-2 rounded-lg bg-base border border-white/10 px-3 py-2 mb-3">
              <code className="text-sm text-primary font-mono tracking-wide select-all flex-1 break-all">{reset.password}</code>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(reset.password).then(
                    () => setCopied(true),
                    // Clipboard can be denied (insecure origin, permissions). Say so instead of a silent no-op —
                    // the admin would otherwise paste whatever was on the clipboard before.
                    () => toast.error("Couldn't copy", "Select the password and copy it manually."),
                  );
                }}
                className="text-muted hover:text-brand shrink-0"
                aria-label="Copy password"
                title="Copy"
              >
                {copied ? <Check aria-hidden className="w-4 h-4 text-emerald-400" /> : <Copy aria-hidden className="w-4 h-4" />}
              </button>
            </div>

            {reset.forced ? (
              <p className="text-[11px] text-secondary">
                They&apos;ll be asked to choose their own password the first time they sign in, so this one stops
                working straight away.
              </p>
            ) : (
              <p className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-lg px-2.5 py-2">
                {reset.note ?? "The password was reset, but we couldn't force a change on first login."} Ask them to
                change it themselves in Settings.
              </p>
            )}

            <button
              type="button"
              onClick={() => setReset(null)}
              className="mt-4 w-full rounded-lg bg-ember-400 text-[#09090B] font-semibold text-xs py-2 hover:bg-ember-300 transition-colors"
            >
              Done — I&apos;ve copied it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteRow({
  invitation,
  onRevoked,
}: {
  invitation: TeamInvitation;
  onRevoked: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  // Canonical origin, not window.location.origin — an invite link copied from a preview/marketing
  // deployment must still point at the real app (same origin-drift class as the recovery-redirect
  // bug; audit 2026-08-16, #6). siteUrl() is client-safe and has a production fallback.
  const inviteUrl = `${siteUrl()}/invite/${invitation.code}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can reject (denied permission / insecure context). Don't
      // leave the user thinking the copy worked — the whole point is sharing
      // the link. Show the URL so they can copy it manually.
      toast.error("Couldn't copy the link", inviteUrl);
    }
  };

  const revoke = async () => {
    const reason = prompt("Reason for revoking this invitation?", "Revoked by admin");
    if (!reason) return;
    setBusy(true);
    const res = await fetch(
      `/api/team?invitationId=${encodeURIComponent(invitation.id)}&reason=${encodeURIComponent(reason)}`,
      { method: "DELETE" }
    );
    setBusy(false);
    if (res.ok) {
      onRevoked();
      return;
    }
    // §3.4 + the 558ce56 lesson (MemberRow above): a failed revoke must be
    // VISIBLE. This branch used to be absent — a rejected revoke (403 not-admin
    // / 404 already gone / 500) silently stopped the spinner and left the invite
    // in the list, exactly the false-ok-in-the-UI class the member-remove fix
    // closed. Surface the route's honest error.
    const data = await res.json().catch(() => null);
    toast.error(
      "Couldn't revoke the invitation",
      data?.error ?? "Something went wrong — try again."
    );
  };

  return (
    <div className="py-3">
      <div className="flex items-start sm:items-center justify-between gap-3 flex-col sm:flex-row">
        <div className="min-w-0 w-full sm:w-auto">
          <p className="text-sm text-primary flex items-center gap-2 flex-wrap min-w-0">
            <Mail className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
            <span className="truncate">{invitation.email}</span>
            <span className="text-[10px] uppercase tracking-widest text-violet-300 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.5 rounded-full shrink-0">
              {invitation.role}
            </span>
          </p>
          <p className="text-[10px] text-muted mt-1 font-mono">
            invited {invitation.invitedAt.slice(0, 10)} · expires{" "}
            {invitation.expiresAt.slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-ember-400/30 hover:border-ember-400/60 px-2.5 py-1.5 rounded-lg transition-all"
            aria-label={`Copy invite link for ${invitation.email}`}
            title="Copy invite link"
          >
            <Copy aria-hidden="true" className="w-3 h-3" />
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={revoke}
            disabled={busy}
            className="text-xs text-muted hover:text-red-400 disabled:opacity-40 p-1.5"
            aria-label={`Revoke invitation for ${invitation.email}`}
            title="Revoke"
          >
            <ShieldOff aria-hidden="true" className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function HistoryRow({ invitation }: { invitation: TeamInvitation }) {
  const status = invitation.acceptedAt
    ? { label: "accepted", color: "text-emerald-300" }
    : { label: "revoked", color: "text-muted" };
  return (
    <div className="py-2 flex items-center justify-between">
      <p className="text-xs text-secondary">
        {invitation.email} ·{" "}
        <span className="text-muted font-mono">{invitation.role}</span>
      </p>
      <p className={`text-[10px] uppercase tracking-widest ${status.color}`}>
        {status.label}
      </p>
    </div>
  );
}

