/**
 * The team import file (RSS Phase 9; Gong F2.8 "bulk team upload with managers"). Pure: parsing and the plan.
 *
 * Columns (header row, any order, case-insensitive): email (required), role, manager_email.
 *   · a new email → an invitation with that role (same path and gates as inviting one person: createInvitation);
 *   · manager_email → who they report to. Set now when both are already on the team; for someone being invited, set it
 *     on the Team page once they have joined (an invitation has no person to attach a manager to yet).
 * A person already on the team whose row names a different role gets that role (2026-11-25, ledger F2.8) — through
 * setMemberRole, the same rules as the Team page (company pin, never the last admin), applied row by row. A blank role
 * leaves an existing person's role as it is.
 */
export const MAX_ROWS = 200;

export type CsvRow = { line: number; email: string; role: string | null; managerEmail: string | null };
export type ParseResult = { rows: CsvRow[]; errors: Array<{ line: number; message: string }>; warnings: string[] };

const EMAIL = /^[^@\s,;]+@[^@\s,;]+\.[^@\s,;]+$/;

/** RFC-4180-ish: quoted fields with doubled quotes, commas and CRLF inside quotes. */
export function splitCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const t = text.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]!;
    if (quoted) {
      if (ch === '"' && t[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out.filter((r) => r.some((c) => c.trim() !== ""));
}

export function parseTeamCsv(text: string, isInvitableRole: (r: string) => boolean): ParseResult {
  const lines = splitCsv(text);
  const errors: ParseResult["errors"] = [];
  if (lines.length === 0) return { rows: [], errors: [{ line: 1, message: "The file is empty." }], warnings: [] };
  const head = lines[0]!.map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const col = (name: string) => head.indexOf(name);
  const iEmail = col("email");
  const iRole = col("role");
  const iMgr = col("manager_email");
  if (iEmail < 0) return { rows: [], errors: [{ line: 1, message: "The first row must name the columns, including email." }], warnings: [] };
  const unknown = head.filter((h) => h && !["email", "role", "manager_email"].includes(h));
  const warnings = unknown.length ? [`Ignored column${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}.`] : [];
  if (lines.length - 1 > MAX_ROWS) return { rows: [], errors: [{ line: 1, message: `Up to ${MAX_ROWS} people per file; this one has ${lines.length - 1}.` }], warnings };

  const rows: CsvRow[] = [];
  const seen = new Set<string>();
  lines.slice(1).forEach((cells, k) => {
    const line = k + 2;
    const email = (cells[iEmail] ?? "").trim().toLowerCase();
    const role = iRole >= 0 ? (cells[iRole] ?? "").trim() : "";
    const mgr = iMgr >= 0 ? (cells[iMgr] ?? "").trim().toLowerCase() : "";
    if (!EMAIL.test(email)) return void errors.push({ line, message: `"${email || "(blank)"}" isn't an email address.` });
    if (seen.has(email)) return void errors.push({ line, message: `${email} appears more than once.` });
    if (role && !isInvitableRole(role)) return void errors.push({ line, message: `"${role}" isn't a role you can invite with.` });
    if (mgr && !EMAIL.test(mgr)) return void errors.push({ line, message: `The manager "${mgr}" isn't an email address.` });
    if (mgr && mgr === email) return void errors.push({ line, message: `${email} can't be their own manager.` });
    seen.add(email);
    rows.push({ line, email, role: role || null, managerEmail: mgr || null });
  });
  return { rows, errors, warnings };
}

export type Person = { id: string; status: string; role?: string | null };
export type RowPlan = {
  line: number;
  email: string;
  person: "invite" | "member" | "pending" | "ambiguous";
  manager: "none" | "set" | "on_join" | "after_join" | "not_found" | "ambiguous";
  managerEmail: string | null;
  personId: string | null;
  managerId: string | null;
  role: string | null;
  /** An existing member whose row names a different role: their role now (the change is from → role). */
  roleFrom: string | null;
};

/**
 * What would happen to each row. `accounts`: email → auth user ids (all matches); `members`: this company's profiles
 * by id; `pending`: emails with a live invitation. Pure.
 */
export function planImport(
  rows: CsvRow[],
  accounts: Map<string, string[]>,
  members: Map<string, Person>,
  pending: Set<string>,
): RowPlan[] {
  const memberIdFor = (email: string): { id: string | null; ambiguous: boolean } => {
    const ids = (accounts.get(email) ?? []).filter((id) => members.get(id)?.status === "active");
    return { id: ids.length === 1 ? ids[0]! : null, ambiguous: ids.length > 1 };
  };
  const invitedHere = new Set<string>();
  const plans = rows.map((r): RowPlan => {
    const who = memberIdFor(r.email);
    const person: RowPlan["person"] = who.ambiguous ? "ambiguous" : who.id ? "member" : pending.has(r.email) ? "pending" : "invite";
    if (person === "invite") invitedHere.add(r.email);
    const now = who.id ? members.get(who.id)?.role ?? null : null;
    const roleFrom = person === "member" && r.role && now !== r.role ? now : null;
    return { line: r.line, email: r.email, person, manager: "none", managerEmail: r.managerEmail, personId: who.id, managerId: null, role: r.role, roleFrom };
  });
  for (const p of plans) {
    if (!p.managerEmail) continue;
    const m = memberIdFor(p.managerEmail);
    if (m.ambiguous) p.manager = "ambiguous";
    else if (m.id && p.person === "member") {
      p.manager = "set";
      p.managerId = m.id;
    } else if (m.id && p.person === "invite") {
      // The invitation carries it and accepting applies it (0288).
      p.manager = "on_join";
      p.managerId = m.id;
    } else if (m.id || invitedHere.has(p.managerEmail) || pending.has(p.managerEmail)) p.manager = "after_join";
    else p.manager = "not_found";
  }
  return plans;
}
