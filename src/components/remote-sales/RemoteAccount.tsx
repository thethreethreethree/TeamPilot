"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CheckSquare, Loader2, Phone, TrendingUp, UserPlus } from "lucide-react";
import { AddContact } from "./DealAccountContacts";
import { AskCalls } from "./AskCalls";

/**
 * One account (revenue Phase 1, 0370; Gong F21.2 panel + F21.3 console): the name (editable), open/won/lost totals, its
 * deals, its contacts, and one timeline of calls, deal changes and to-dos, newest first. Every item links to where it
 * lives (the deal in Pipeline, the call page), so the account is a hub, not a dead end.
 */
type Deal = { id: string; name: string | null; status: string; stage_label: string | null; amount: number | null; close_date: string | null; last_call_at: string | null; next_call_date: string | null };
type Contact = { id: string; name: string; title: string | null; rank: string };
type Item =
  | { kind: "call"; at: string; sessionId: string; label: string | null; channel: string | null; dealId: string | null }
  | { kind: "deal"; at: string; dealId: string; what: string; value: Record<string, unknown> }
  | { kind: "task"; at: string; dealId: string; taskId: string; title: string; done: boolean };
type Data = { account: { id: string; name: string }; deals: Deal[]; contacts: Contact[]; timeline: Item[] };

const RANK_WORD: Record<string, string> = { c_level: "C-level", vp: "VP", director: "Director", manager: "Manager", individual: "Individual" };
const day = (s: string | null) => (s ? new Date(s.length === 10 ? `${s}T12:00:00Z` : s).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—");
const money = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const STATUS: Record<string, string> = { open: "Open", won: "Won", lost: "Lost" };

function describe(i: Extract<Item, { kind: "deal" }>, dealName: string): string {
  const v = i.value ?? {};
  if (i.what === "stage") return `${dealName}: stage ${STATUS[String(v.status)] ?? String(v.status)}${v.label ? ` · ${String(v.label)}` : ""}`;
  if (i.what === "amount") return `${dealName}: amount ${money(Number(v.amount ?? 0))}`;
  if (i.what === "close_date") return `${dealName}: expected close ${v.date ? day(String(v.date)) : "cleared"}`;
  return `${dealName}: next call ${v.date ? day(String(v.date)) : "cleared"}`;
}

export function RemoteAccount({ id }: { id: string }) {
  const [d, setD] = useState<Data | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "missing" | "failed">("loading");
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/coach/remote/accounts/${id}`, { cache: "no-store" });
      if (r.status === 404) return setState("missing");
      if (!r.ok) return setState("failed");
      setD((await r.json()) as Data);
      setState("ok");
    } catch {
      setState("failed");
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  const rename = async () => {
    setMsg(null);
    const r = await fetch(`/api/coach/remote/accounts/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    if (!r.ok) return setMsg(j.error ?? "Couldn't rename this account.");
    setRenaming(false);
    await load();
  };

  if (state === "loading") return <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>;
  if (state === "missing") return <p className="text-xs text-secondary">This account doesn&apos;t exist or isn&apos;t one you can open. <Link href="/dashboard/remote-sales/accounts" className="text-primary underline-offset-2 hover:underline">Back to accounts</Link></p>;
  if (state === "failed" || !d) return <p className="text-xs text-secondary">Couldn&apos;t load this account. Refresh to try again.</p>;

  const dealName = new Map(d.deals.map((x) => [x.id, x.name ?? "A deal"]));
  const open = d.deals.filter((x) => x.status === "open");
  const totals = { open: open.length, openAmount: open.reduce((s, x) => s + Number(x.amount ?? 0), 0), won: d.deals.filter((x) => x.status === "won").length, lost: d.deals.filter((x) => x.status === "lost").length };

  return (
    <div className="space-y-4">
      <Link href="/dashboard/remote-sales/accounts" className="inline-flex items-center gap-1 text-xs text-secondary hover:text-primary"><ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Accounts</Link>
      <header className="rounded-xl border border-default bg-surface p-4">
        {renaming ? (
          <div className="flex flex-wrap gap-2">
            <input autoFocus value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={120} aria-label="Account name" className="min-w-0 flex-1 rounded-lg border border-default bg-base px-2 py-1 text-sm text-primary" />
            <button type="button" disabled={!name.trim()} onClick={() => void rename()} className="rounded-lg border border-default px-2 py-1 text-xs text-primary disabled:opacity-50">Save</button>
            <button type="button" onClick={() => setRenaming(false)} className="px-2 text-xs text-muted hover:text-primary">Cancel</button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex items-center gap-1.5 text-base font-semibold text-primary"><Building2 className="h-4 w-4 text-brand" aria-hidden /> {d.account.name}</h2>
            <button type="button" onClick={() => { setName(d.account.name); setRenaming(true); }} className="text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline">Rename</button>
          </div>
        )}
        {msg && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{msg}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div><dt className="text-muted">Open deals</dt><dd className="text-sm font-semibold tabular-nums text-primary">{totals.open}</dd></div>
          <div><dt className="text-muted">Open amount</dt><dd className="text-sm font-semibold tabular-nums text-primary">{totals.openAmount ? money(totals.openAmount) : "—"}</dd></div>
          <div><dt className="text-muted">Won</dt><dd className="text-sm font-semibold tabular-nums text-primary">{totals.won}</dd></div>
          <div><dt className="text-muted">Lost</dt><dd className="text-sm font-semibold tabular-nums text-primary">{totals.lost}</dd></div>
        </dl>
      </header>

      <AskCalls
        title="Ask about this account"
        calls={d.timeline.filter((i): i is Extract<Item, { kind: "call" }> => i.kind === "call").map((i) => ({ sessionId: i.sessionId, label: `${day(i.at)}${i.label ? ` · ${i.label}` : ""}` }))}
        starters={["What does this account care about most?", "What objections keep coming up?", "Who are the people we talk to, and what do they want?"]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <section aria-label="Timeline" className="rounded-xl border border-default bg-surface p-4">
          <h3 className="text-sm font-semibold text-primary">Timeline</h3>
          {d.timeline.length === 0 ? (
            <p className="mt-2 text-xs text-secondary">Nothing yet. Link calls to this account&apos;s deals (open a call, then “Add to pipeline”) and they&apos;ll appear here.</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {d.timeline.map((i, n) => (
                <li key={`${i.kind}-${n}`} className="flex gap-2 text-xs">
                  <span className="mt-0.5 text-muted" aria-hidden>
                    {i.kind === "call" ? <Phone className="h-3.5 w-3.5" /> : i.kind === "task" ? <CheckSquare className="h-3.5 w-3.5" /> : <TrendingUp className="h-3.5 w-3.5" />}
                  </span>
                  <span className="min-w-0">
                    {i.kind === "call" ? (
                      <Link href={`/dashboard/remote-sales/calls/${i.sessionId}`} className="text-primary hover:underline">
                        {i.channel === "video" ? "Video call" : "Phone call"}{i.label ? ` · ${i.label}` : ""}{i.dealId ? ` · ${dealName.get(i.dealId) ?? "a deal"}` : ""}
                      </Link>
                    ) : i.kind === "task" ? (
                      <Link href={`/dashboard/remote-sales/pipeline?p=${i.dealId}`} className={i.done ? "text-muted line-through hover:underline" : "text-primary hover:underline"}>To-do: {i.title}</Link>
                    ) : (
                      <Link href={`/dashboard/remote-sales/pipeline?p=${i.dealId}`} className="text-primary hover:underline">{describe(i, dealName.get(i.dealId) ?? "A deal")}</Link>
                    )}
                    <span className="block text-[11px] text-muted">{day(i.at)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <div className="space-y-4">
          <section aria-label="Deals" className="rounded-xl border border-default bg-surface p-4">
            <h3 className="text-sm font-semibold text-primary">Deals</h3>
            {d.deals.length === 0 ? <p className="mt-2 text-xs text-secondary">No deals on this account.</p> : (
              <ul className="mt-2 space-y-1.5">
                {d.deals.map((x) => (
                  <li key={x.id} className="text-xs">
                    <Link href={`/dashboard/remote-sales/pipeline?p=${x.id}`} className="font-medium text-primary hover:underline">{x.name ?? "Unnamed deal"}</Link>
                    <span className="block text-[11px] text-muted">
                      {[STATUS[x.status] ?? x.status, x.stage_label, x.amount != null ? money(Number(x.amount)) : null, x.close_date ? `close ${day(x.close_date)}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Contacts" className="rounded-xl border border-default bg-surface p-4">
            <h3 className="text-sm font-semibold text-primary">Contacts</h3>
            {d.contacts.length === 0 && <p className="mt-2 text-xs text-secondary">No contacts on this account yet.</p>}
            <ul className="mt-2 space-y-1">
              {d.contacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-primary">{c.name}</span>
                  {c.title && <span className="text-muted">{c.title}</span>}
                  {RANK_WORD[c.rank] && <span className="rounded-full bg-brand/10 px-1.5 py-0.5 text-[10px] text-primary">{RANK_WORD[c.rank]}</span>}
                </li>
              ))}
            </ul>
            {adding ? (
              <AddContact accountId={d.account.id} withRole={false} pickLabel="already here" onPicked={async () => { setAdding(false); await load(); }} onError={setMsg} onCancel={() => setAdding(false)} exclude={new Set(d.contacts.map((c) => c.id))} />
            ) : (
              <button type="button" onClick={() => setAdding(true)} className="mt-2 inline-flex items-center gap-1 text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline">
                <UserPlus className="h-3.5 w-3.5" aria-hidden /> Add a contact
              </button>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
