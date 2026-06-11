"use client";

import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { supabaseEnabled } from "@/lib/supabase/client";
import { fetchTeam, type TeamMember, type TeamInvitation } from "@/lib/data/team";
import { InviteMemberDialog } from "@/components/team/InviteMemberDialog";
import {
  AlertTriangle,
  Copy,
  Loader2,
  Mail,
  ShieldOff,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function TeamPage() {
  const companyName = useCompanyName();
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
    setLoading(false);
  };

  useEffect(() => {
    if (supabaseEnabled) refresh();
    else setLoading(false);
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get("new") === "1" && supabaseEnabled) {
      setInviting(true);
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
              <button
                onClick={() => setInviting(true)}
                className="flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite member
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
              </div>
            )}

            {!loading && error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            {!loading && (
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
                        <MemberRow key={m.id} member={m} onRemoved={refresh} />
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
  onRemoved,
}: {
  member: TeamMember;
  onRemoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const remove = async () => {
    if (!confirm(`Remove ${member.fullName ?? "this member"}?`)) return;
    setBusy(true);
    const res = await fetch(`/api/team?memberId=${encodeURIComponent(member.id)}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) onRemoved();
  };
  const initials = (member.fullName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#FACC15] to-[#FDE047] flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
        <div>
          <p className="text-sm text-primary">{member.fullName ?? "—"}</p>
          <p className="text-[10px] text-muted font-mono">
            {member.role} · joined {member.createdAt.slice(0, 10)}
          </p>
        </div>
      </div>
      <button
        onClick={remove}
        disabled={busy}
        className="flex items-center gap-1.5 text-xs text-muted hover:text-red-400 disabled:opacity-40"
        aria-label={`Remove member ${member.fullName ?? ""}`.trim()}
        title="Remove member"
      >
        <UserMinus aria-hidden="true" className="w-3.5 h-3.5" />
      </button>
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

  const inviteUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/invite/${invitation.code}`
      : `/invite/${invitation.code}`;

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
    if (res.ok) onRevoked();
  };

  return (
    <div className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-primary flex items-center gap-2 flex-wrap">
            <Mail className="w-3.5 h-3.5 text-muted" />
            {invitation.email}
            <span className="text-[10px] uppercase tracking-widest text-violet-300 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.5 rounded-full">
              {invitation.role}
            </span>
          </p>
          <p className="text-[10px] text-muted mt-1 font-mono">
            invited {invitation.invitedAt.slice(0, 10)} · expires{" "}
            {invitation.expiresAt.slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs text-brand hover:text-primary border border-[#FACC15]/30 hover:border-[#FACC15]/60 px-2.5 py-1.5 rounded-lg transition-all"
            aria-label={`Copy invite link for ${invitation.email}`}
            title="Copy invite link"
          >
            <Copy aria-hidden="true" className="w-3 h-3" />
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
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

