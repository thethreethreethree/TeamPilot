"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, UserPlus, X } from "lucide-react";

/**
 * A deal's account and contacts (revenue Phase 1, 0370; Gong F20.3 Contacts tab). Inside the Pipeline deal panel.
 *   · Account: pick one of the accounts the caller can see, or type a name (found or made by the company-wide key, so
 *     "Acme Inc." and "acme inc" are one account), or none. It links to the account page.
 *   · Contacts: the people on the deal with a role; add an existing contact of the account or a new one; remove.
 * Every change is an event through /api/coach/remote/prospects/:id; the panel reloads from the server after each.
 */
export type DealContact = { id: string; name: string; title: string | null; rank: string; role: string };
type Option = { id: string; name: string };

const ROLES: Array<[string, string]> = [["decision_maker", "Decision maker"], ["champion", "Champion"], ["user", "User"], ["other", "Other"]];
const RANK_WORD: Record<string, string> = { c_level: "C-level", vp: "VP", director: "Director", manager: "Manager", individual: "Individual" };
const field = "rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary";

export function DealAccountContacts({
  dealId,
  account,
  contacts,
  busy,
  post,
}: {
  dealId: string;
  account: { id: string; name: string } | null;
  contacts: DealContact[];
  busy: boolean;
  post: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [accName, setAccName] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [optionsFailed, setOptionsFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    let live = true;
    const t = setTimeout(() => {
      fetch(`/api/coach/remote/accounts?scope=team&q=${encodeURIComponent(accName.trim())}`, { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          const j = (await r.json()) as { accounts?: Option[] };
          if (!live) return;
          setOptions((j.accounts ?? []).slice(0, 8));
          setOptionsFailed(false);
        })
        .catch(() => {
          if (!live) return;
          setOptions([]);
          setOptionsFailed(true);
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [editing, accName]);

  const choose = async (body: Record<string, unknown>) => {
    if (await post({ action: "account", ...body })) {
      setEditing(false);
      setAccName("");
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Account</p>
        {!editing ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {account ? (
              <Link href={`/dashboard/remote-sales/accounts/${account.id}`} className="inline-flex items-center gap-1 text-primary hover:underline">
                <Building2 className="h-3.5 w-3.5 text-muted" aria-hidden /> {account.name}
              </Link>
            ) : (
              <span className="text-secondary">No account yet.</span>
            )}
            <button type="button" disabled={busy} onClick={() => setEditing(true)} className="text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline">
              {account ? "Change" : "Set the account"}
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <input
                autoFocus
                value={accName}
                onChange={(e) => setAccName(e.currentTarget.value)}
                maxLength={120}
                placeholder="Company name"
                aria-label="Account name"
                className={`${field} min-w-0 flex-1`}
              />
              <button type="button" disabled={busy || !accName.trim()} onClick={() => void choose({ name: accName.trim() })} className="rounded-lg border border-default px-2 py-1 text-xs text-primary disabled:opacity-50">
                Use this name
              </button>
              {account && (
                <button type="button" disabled={busy} onClick={() => void choose({ accountId: null })} className="px-2 text-xs text-muted hover:text-primary">
                  No account
                </button>
              )}
              <button type="button" onClick={() => setEditing(false)} className="px-2 text-xs text-muted hover:text-primary">Cancel</button>
            </div>
            {options.length > 0 && (
              <ul className="flex flex-wrap gap-1.5" aria-label="Existing accounts">
                {options.map((o) => (
                  <li key={o.id}>
                    <button type="button" disabled={busy} onClick={() => void choose({ accountId: o.id })} className="rounded-full border border-default px-2 py-0.5 text-[11px] text-primary hover:border-brand">
                      {o.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {optionsFailed && <p className="text-[11px] text-amber-700 dark:text-amber-300">Couldn&apos;t load your accounts to pick from. Typing a name still finds the existing one.</p>}
            <p className="text-[11px] text-muted">A name your company already uses (any capitals or punctuation) joins that account.</p>
          </div>
        )}
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Contacts</p>
        {contacts.length === 0 && <p className="text-xs text-secondary">No one on this deal yet.</p>}
        <ul className="space-y-1">
          {contacts.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-primary">{c.name}</span>
              {c.title && <span className="text-muted">{c.title}</span>}
              {RANK_WORD[c.rank] && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] text-primary">{RANK_WORD[c.rank]}</span>}
              <select
                value={c.role}
                disabled={busy}
                aria-label={`${c.name}'s role on this deal`}
                onChange={(e) => void post({ action: "contact", contactId: c.id, role: e.currentTarget.value })}
                className={field}
              >
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button type="button" disabled={busy} onClick={() => void post({ action: "contact", contactId: c.id, role: "removed" })} aria-label={`Take ${c.name} off this deal`} className="text-muted hover:text-primary">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        {adding ? (
          <AddContact
            accountId={account?.id ?? null}
            onPicked={async (contactId, role) => {
              if (await post({ action: "contact", contactId, role })) setAdding(false);
            }}
            onError={setErr}
            onCancel={() => setAdding(false)}
            exclude={new Set(contacts.map((c) => c.id))}
            key={dealId}
          />
        ) : (
          <button type="button" disabled={busy} onClick={() => setAdding(true)} className="mt-1 inline-flex items-center gap-1 text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline">
            <UserPlus className="h-3.5 w-3.5" aria-hidden /> Add a contact
          </button>
        )}
        {err && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{err}</p>}
      </div>
    </div>
  );
}

/** Pick a contact (of this account first) or make a new one on this account, then give them a role on the deal. */
export function AddContact({
  accountId,
  onPicked,
  onError,
  onCancel,
  exclude,
  pickLabel = "Add to deal",
  withRole = true,
}: {
  accountId: string | null;
  onPicked: (contactId: string, role: string) => Promise<void> | void;
  onError: (msg: string | null) => void;
  onCancel: () => void;
  exclude?: Set<string>;
  pickLabel?: string;
  withRole?: boolean;
}) {
  const [q, setQ] = useState("");
  const [title, setTitle] = useState("");
  const [role, setRole] = useState("other");
  const [found, setFound] = useState<Array<{ id: string; name: string; title: string | null }>>([]);
  const [foundFailed, setFoundFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    const t = setTimeout(() => {
      const qs = new URLSearchParams();
      if (q.trim()) qs.set("q", q.trim());
      if (accountId && !q.trim()) qs.set("accountId", accountId);
      fetch(`/api/coach/remote/contacts?${qs}`, { cache: "no-store" })
        .then(async (r) => {
          if (!r.ok) throw new Error(String(r.status));
          const j = (await r.json()) as { contacts?: Array<{ id: string; name: string; title: string | null }> };
          if (!live) return;
          setFound((j.contacts ?? []).filter((c) => !exclude?.has(c.id)).slice(0, 8));
          setFoundFailed(false);
        })
        .catch(() => {
          if (!live) return;
          setFound([]);
          setFoundFailed(true);
        });
    }, 200);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [q, accountId, exclude]);

  const create = async () => {
    setSaving(true);
    onError(null);
    try {
      const r = await fetch("/api/coach/remote/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: q.trim(), title: title.trim() || null, accountId }),
      });
      const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
      if (!r.ok || !j.id) throw new Error(j.error ?? "Couldn't add the contact.");
      await onPicked(j.id, role);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Couldn't add the contact.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 space-y-1.5 rounded-lg border border-default p-2">
      <div className="flex flex-wrap gap-2">
        <input autoFocus value={q} onChange={(e) => setQ(e.currentTarget.value)} maxLength={80} placeholder="Name" aria-label="Contact name" className={`${field} min-w-0 flex-1`} />
        {withRole && (
          <select value={role} onChange={(e) => setRole(e.currentTarget.value)} aria-label="Role on the deal" className={field}>
            {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        )}
        <button type="button" onClick={onCancel} className="px-2 text-xs text-muted hover:text-primary">Cancel</button>
      </div>
      {foundFailed && <p className="text-[11px] text-amber-700 dark:text-amber-300">Couldn&apos;t load existing contacts. You can still add a new one.</p>}
      {found.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="Existing contacts">
          {found.map((c) => (
            <li key={c.id}>
              <button type="button" disabled={saving} onClick={() => void onPicked(c.id, role)} className="rounded-full border border-default px-2 py-0.5 text-[11px] text-primary hover:border-brand">
                {c.name}{c.title ? ` · ${c.title}` : ""} — {pickLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
      {q.trim() && (
        <div className="flex flex-wrap gap-2">
          <input value={title} onChange={(e) => setTitle(e.currentTarget.value)} maxLength={80} placeholder="Job title (optional)" aria-label="Job title" className={`${field} min-w-0 flex-1`} />
          <button type="button" disabled={saving} onClick={() => void create()} className="rounded-lg border border-default px-2 py-1 text-xs text-primary disabled:opacity-50">
            {saving ? "Adding…" : `New contact “${q.trim()}”${accountId ? " on this account" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
