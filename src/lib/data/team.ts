import { createClient, supabaseEnabled } from "@/lib/supabase/client";

export type TeamMember = {
  id: string;
  fullName: string | null;
  role: string;
  status: "active" | "removed";
  removedAt: string | null;
  createdAt: string;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: string;
  code: string;
  invitedAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
};

export type TeamSnapshot = {
  members: TeamMember[];
  invitations: TeamInvitation[];
  // "live-error": a query FAILED (RLS/DB) — distinct from "live-empty" (query
  // succeeded, no rows). Conflating them renders a DB error as the misleading
  // "onboarding hasn't completed" empty state (§3.4 / A14 — live-error must not
  // masquerade as live-empty). Callers that only care about data can keep
  // ignoring `mode`; surfaces that show an empty state should branch on it.
  mode: "live-data" | "live-empty" | "live-error" | "demo-unavailable";
};

export async function fetchTeam(): Promise<TeamSnapshot> {
  if (!supabaseEnabled) {
    return { members: [], invitations: [], mode: "demo-unavailable" };
  }
  const supabase = createClient();
  const [membersRes, invitesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, role, status, removed_at, created_at")
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("team_invitations")
      .select(
        "id, email, role, code, invited_at, expires_at, accepted_at, revoked_at"
      )
      .order("invited_at", { ascending: false }),
  ]);

  const members: TeamMember[] = (membersRes.data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    role: row.role,
    status: row.status as "active" | "removed",
    removedAt: row.removed_at,
    createdAt: row.created_at,
  }));
  const invitations: TeamInvitation[] = (invitesRes.data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    code: row.code,
    invitedAt: row.invited_at,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    revokedAt: row.revoked_at,
  }));
  return {
    members,
    invitations,
    mode: membersRes.error || invitesRes.error
      ? "live-error"
      : members.length === 0 && invitations.length === 0
        ? "live-empty"
        : "live-data",
  };
}
