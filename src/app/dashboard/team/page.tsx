"use client";

import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { supabaseEnabled } from "@/lib/supabase/client";
import { fetchTeam, type TeamMember, type TeamInvitation } from "@/lib/data/team";
import Modal from "@/components/ui/Modal";
import { Field, Input, Select } from "@/components/ui/Field";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Loader2,
  Mail,
  ShieldOff,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

const ROLES = ["CEO", "COO", "Lead", "Member"] as const;

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
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar title="Team" subtitle={`${companyName} · Members + invitations`} />

      <div className="p-6 max-w-5xl mx-auto space-y-6">
        {!supabaseEnabled && (
          <div className="glass-card p-6 text-center">
            <AlertTriangle className="w-5 h-5 text-yellow-300 mx-auto mb-2" />
            <p className="text-sm text-yellow-100 mb-1">Live mode required</p>
            <p className="text-xs text-[#5a6399] max-w-md mx-auto">
              Team management requires the database. Configure Supabase to invite members.
            </p>
          </div>
        )}

        {supabaseEnabled && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5a6399]">
                  {members.length} member{members.length === 1 ? "" : "s"} ·{" "}
                  {pendingInvites.length} pending invite
                  {pendingInvites.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => setInviting(true)}
                className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite member
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center gap-2 text-xs text-[#5a6399] py-10">
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
                    <p className="text-xs text-[#5a6399] py-6 text-center">
                      No active members. This usually means onboarding hasn&apos;t
                      completed.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#1a1d2e]">
                      {members.map((m) => (
                        <MemberRow key={m.id} member={m} onRemoved={refresh} />
                      ))}
                    </div>
                  )}
                </Section>

                <Section title={`Pending invitations (${pendingInvites.length})`}>
                  {pendingInvites.length === 0 ? (
                    <p className="text-xs text-[#5a6399] py-6 text-center">
                      No pending invitations.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#1a1d2e]">
                      {pendingInvites.map((i) => (
                        <InviteRow key={i.id} invitation={i} onRevoked={refresh} />
                      ))}
                    </div>
                  )}
                </Section>

                {invitations.filter((i) => i.acceptedAt || i.revokedAt).length > 0 && (
                  <Section title="History">
                    <div className="divide-y divide-[#1a1d2e]">
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

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onInvited={() => {
            setInviting(false);
            refresh();
          }}
        />
      )}
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
      <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">{title}</h2>
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
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#5470ff] to-[#7a96ff] flex items-center justify-center text-xs font-bold text-white">
          {initials}
        </div>
        <div>
          <p className="text-sm text-[#e8eaf6]">{member.fullName ?? "—"}</p>
          <p className="text-[10px] text-[#5a6399] font-mono">
            {member.role} · joined {member.createdAt.slice(0, 10)}
          </p>
        </div>
      </div>
      <button
        onClick={remove}
        disabled={busy}
        className="flex items-center gap-1.5 text-xs text-[#5a6399] hover:text-red-400 disabled:opacity-40"
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
          <p className="text-sm text-[#e8eaf6] flex items-center gap-2 flex-wrap">
            <Mail className="w-3.5 h-3.5 text-[#5a6399]" />
            {invitation.email}
            <span className="text-[10px] uppercase tracking-widest text-violet-300 bg-violet-500/10 border border-violet-500/30 px-1.5 py-0.5 rounded-full">
              {invitation.role}
            </span>
          </p>
          <p className="text-[10px] text-[#5a6399] mt-1 font-mono">
            invited {invitation.invitedAt.slice(0, 10)} · expires{" "}
            {invitation.expiresAt.slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-2.5 py-1.5 rounded-lg transition-all"
            aria-label={`Copy invite link for ${invitation.email}`}
            title="Copy invite link"
          >
            <Copy aria-hidden="true" className="w-3 h-3" />
            {copied ? "Copied" : "Copy link"}
          </button>
          <button
            onClick={revoke}
            disabled={busy}
            className="text-xs text-[#5a6399] hover:text-red-400 disabled:opacity-40 p-1.5"
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
    : { label: "revoked", color: "text-[#5a6399]" };
  return (
    <div className="py-2 flex items-center justify-between">
      <p className="text-xs text-[#8895c4]">
        {invitation.email} ·{" "}
        <span className="text-[#5a6399] font-mono">{invitation.role}</span>
      </p>
      <p className={`text-[10px] uppercase tracking-widest ${status.color}`}>
        {status.label}
      </p>
    </div>
  );
}

function InviteModal({
  onClose,
  onInvited,
}: {
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof ROLES)[number]>("Member");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const submit = async () => {
    if (!email.includes("@")) {
      setError("Valid email required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invite failed.");
      const url = `${window.location.origin}/invite/${data.code}`;
      setInviteUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Modal open onClose={onClose} title="Invite member" size="md">
      {!inviteUrl ? (
        <div className="space-y-3" aria-busy={submitting}>
          <Field label="Email" required>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="teammate@company.com"
            />
          </Field>
          <Field label="Role">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as (typeof ROLES)[number])}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="text-xs text-[#5a6399] hover:text-[#8895c4] px-3 py-2"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 text-white font-semibold px-4 py-2 rounded-lg transition-all text-xs"
            >
              {submitting ? "Creating…" : "Create invitation"}
              {!submitting && <CheckCircle2 className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-xs text-emerald-200 mb-2">
              Invitation created. Share this link with your teammate. (Email
              sending is not configured — copy-paste the link for now.)
            </p>
            <div className="flex items-center gap-2">
              <input
                value={inviteUrl}
                readOnly
                className="flex-1 bg-[#12141f] border border-[#252840] rounded-lg px-3 py-2 text-xs text-[#8895c4] font-mono"
              />
              <button
                onClick={copy}
                className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-2.5 py-2 rounded-lg transition-all"
              >
                <Copy className="w-3 h-3" />
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-end pt-2">
            <button
              onClick={onInvited}
              className="text-xs text-[#7a96ff] hover:text-white px-3 py-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
