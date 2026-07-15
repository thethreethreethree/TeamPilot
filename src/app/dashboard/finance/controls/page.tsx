"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney, parseMoneyInput } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { ShieldCheck, Plus, Gauge, Ban, UserCheck, Split } from "lucide-react";

/**
 * Finance controls — the ceilings the company sets on its own spending.
 *
 * These three live on ONE page deliberately. Spend limits (who may approve how much), expense policy
 * (what may be claimed, up to what), and mileage/per-diem rates (what a claim is worth) are not three
 * unrelated settings screens — they are the same question asked at three points in the same flow. A
 * controller thinking "how much can go out without me?" needs all three in one view, or they will set one
 * and believe they have set the control.
 *
 * The most important thing on this page is the WARNING at the top of the limits section: an approver with
 * no limit is UNLIMITED. That is the schema's honest default (NULL = unlimited), and hiding it behind a
 * blank cell would be the worst kind of interface lie — it would read as "configured" when it means
 * "anyone with the approver role can approve any amount". So it is stated in words, not left as an empty
 * space for the reader to misread.
 */

type Role = { user_id: string; role: string; approval_limit: number | null; granted_at: string };
type Policy = {
  id: string;
  category: string | null;
  effective_from: string;
  is_disallowed: boolean;
  max_amount: number | null;
  requires_receipt_above: number | null;
};
type MileageRate = { id: string; effective_from: string; rate_per_unit: number; unit: string; currency: string };
type PerDiemRate = { id: string; effective_from: string; jurisdiction: string; daily_rate: number; currency: string };
type Delegation = {
  id: string;
  delegator_id: string;
  delegate_id: string;
  starts_on: string;
  ends_on: string;
  reason: string | null;
  revoked_at: string | null;
};
type Member = { id: string; full_name: string | null };
type Account = { id: string; code: string; name: string; type: string; cost_type: string };
type Fx = { id: string; from_currency: string; to_currency: string; rate: number; as_of_date: string };

const today = () => new Date().toISOString().slice(0, 10);

export default function FinanceControlsPage() {
  const toast = useToast();
  const [ready, setReady] = useState<boolean | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [mileage, setMileage] = useState<MileageRate[]>([]);
  const [perDiem, setPerDiem] = useState<PerDiemRate[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  // new-policy form
  const [pCategory, setPCategory] = useState("");
  const [pMax, setPMax] = useState("");
  const [pReceiptAbove, setPReceiptAbove] = useState("");
  const [pDisallowed, setPDisallowed] = useState(false);

  // new-rate form
  const [mRate, setMRate] = useState("");
  const [dRate, setDRate] = useState("");
  const [dJurisdiction, setDJurisdiction] = useState("default");

  // delegation
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  // True when the delegations read failed (e.g. migration 0168 not applied yet) — the
  // section is hidden rather than shown as a misleading empty state (§A14).
  const [dgUnavailable, setDgUnavailable] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  // The direct/indirect split. It defaults to 'none', and until someone sets it, break-even treats EVERY
  // cost as fixed and overhead can be allocated to nobody. Three analytics features depend on this one
  // column, and it had no way in.
  const [accounts, setAccounts] = useState<Account[]>([]);
  // Manual FX (the founder's confirmed parameter). Until this form existed there was NO way to enter a
  // rate at all — a foreign-currency invoice would convert at whatever the fallback is, silently, and every
  // base-currency figure derived from it would be wrong by the size of the FX move. The books would balance.
  const [fx, setFx] = useState<Fx[]>([]);
  const [fxFrom, setFxFrom] = useState("");
  const [fxTo, setFxTo] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [gTo, setGTo] = useState("");
  const [gFrom, setGFrom] = useState(today());
  const [gUntil, setGUntil] = useState("");
  const [gReason, setGReason] = useState("");

  const load = useCallback(async () => {
    const [r, p, rt, dg, tm, ac] = await Promise.all([
      fetch("/api/finance/roles").then((x) => x.json()),
      fetch("/api/finance/expense-policies").then((x) => x.json()),
      fetch("/api/finance/rates").then((x) => x.json()),
      fetch("/api/finance/delegations").then((x) => x.json()),
      fetch("/api/team").then((x) => x.json()),
      fetch("/api/finance/accounts").then((x) => x.json()),
    ]);
    // A failed read must NOT render as "nothing is configured" — that reads as an unpoliced company and
    // invites a controller to add a duplicate control. Say we could not load it.
    //
    // Delegations (migration 0168) is deliberately NOT in this fatal gate: it is a newer feature that may be
    // unmigrated even when the core controls (roles / policy / rates) are applied. Coupling it here would
    // blank the WHOLE page — hiding the working approval-limit, policy and rate sections — the moment 0168
    // lags behind. §A14 + the migration-coupling lesson: a newer feature's read must not hide the core.
    if (r.error || p.error || rt.error) {
      setLoadError(r.error || p.error || rt.error);
      setReady(true);
      return;
    }
    setLoadError(null);
    setRoles(r.roles ?? []);
    setPolicies(p.policies ?? []);
    setMileage(rt.mileage ?? []);
    setPerDiem(rt.perDiem ?? []);
    setFx(rt.fx ?? []);
    // §A14 live-error vs live-empty: if delegations errored (table missing / 0168 unapplied) we HIDE the
    // section rather than show "nobody has delegated" — the latter falsely implies the feature is live+empty.
    setDgUnavailable(Boolean(dg.error));
    setDelegations(dg.error ? [] : (dg.delegations ?? []));
    setMembers(tm.members ?? []);
    setAccounts((ac.accounts ?? []).filter((a: Account) => a.type === "expense"));
    setReady(true);
  }, []);

  useEffect(() => {
    load().catch(() => setReady(false));
  }, [load]);

  async function addPolicy() {
    const max = pMax.trim() ? parseMoneyInput(pMax) : undefined;
    const receipt = pReceiptAbove.trim() ? parseMoneyInput(pReceiptAbove) : undefined;
    if (!pCategory.trim()) return toast.error("A policy needs a category to bind to.");
    if (!pDisallowed && max === undefined && receipt === undefined) {
      // Mirrors the API's own refusal. A policy that states no rule would sit in the list looking like a
      // control while enforcing nothing — a false comfort, which is worse than no policy at all.
      return toast.error("State at least one rule: disallowed, a cap, or a receipt threshold.");
    }
    const res = await fetch("/api/finance/expense-policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: pCategory.trim(),
        isDisallowed: pDisallowed,
        maxAmount: max !== undefined && Number.isFinite(max) ? max : undefined,
        requiresReceiptAbove: receipt !== undefined && Number.isFinite(receipt) ? receipt : undefined,
        effectiveFrom: today(),
      }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not save the policy.");
    setPCategory("");
    setPMax("");
    setPReceiptAbove("");
    setPDisallowed(false);
    toast.success("Policy saved", "It applies to expenses dated from today.");
    load();
  }

  async function addRate(kind: "mileage" | "per_diem") {
    const raw = kind === "mileage" ? mRate : dRate;
    const val = parseMoneyInput(raw);
    if (!Number.isFinite(val)) return toast.error("Enter a rate.");
    const res = await fetch("/api/finance/rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        kind === "mileage"
          ? { kind: "mileage", effectiveFrom: today(), ratePerUnit: val, unit: "km" }
          : { kind: "per_diem", effectiveFrom: today(), dailyRate: val, jurisdiction: dJurisdiction.trim() || "default" },
      ),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not save the rate.");
    setMRate("");
    setDRate("");
    toast.success("Rate saved", "Claims dated from today use it. Earlier claims keep their old rate.");
    load();
  }

  /**
   * Delegation. Note what this form does NOT ask: who the authority comes FROM.
   *
   * You can only ever delegate your own. The API accepts no delegator field and RLS rejects any row where
   * delegator_id <> auth.uid() — so there is nothing for this form to ask, and asking would imply a choice
   * that does not exist. The absent field is the security model, visible in the interface.
   */
  async function delegate() {
    if (!gTo) return toast.error("Choose who covers for you.");
    if (!gUntil) return toast.error("A delegation needs an end date", "Authority that never lapses isn't cover — it's a second set of keys.");
    if (gUntil < gFrom) return toast.error("The end date can't be before the start date.");
    const res = await fetch("/api/finance/delegations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "delegate",
        delegateId: gTo,
        startsOn: gFrom,
        endsOn: gUntil,
        reason: gReason.trim() || undefined,
      }),
    });
    const j = await res.json();
    // The database's refusal is the honest one ("you cannot delegate authority you do not have"). Show it.
    if (!res.ok) return toast.error(j.error ?? "Could not delegate.");
    setGTo("");
    setGUntil("");
    setGReason("");
    toast.success("Cover arranged", "They can approve in your name, up to your limit, until the end date — and no longer.");
    load();
  }

  async function revoke(id: string) {
    const res = await fetch("/api/finance/delegations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke", id }),
    });
    const j = await res.json();
    if (!res.ok) return toast.error(j.error ?? "Could not revoke.");
    toast.success("Revoked", "Their borrowed authority ended immediately.");
    load();
  }

  if (ready === false) return <FinanceNotSetUp feature="Finance controls" />;

  const nameOf = (id: string) => members.find((m) => m.id === id)?.full_name ?? `${id.slice(0, 8)}…`;
  const t = today();
  const isLive = (d: Delegation) => !d.revoked_at && d.starts_on <= t && d.ends_on >= t;
  const liveCount = delegations.filter(isLive).length;

  const unlimitedApprovers = roles.filter(
    (r) => (r.role === "approver" || r.role === "controller" || r.role === "cfo") && r.approval_limit == null,
  ).length;

  return (
    <>
      <TopBar title="Finance controls" />
      <FinanceNav />
      <main className="mx-auto max-w-5xl px-4 py-6 space-y-8">
        {loadError && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            Could not load your controls: {loadError}. This is <strong>not</strong> the same as having none
            configured — do not add duplicates until this loads.
          </div>
        )}

        {/* ── Spend limits ─────────────────────────────────────────── */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck size={18} /> Approval limits
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            The most a person may approve on their own. Above it, the approval is refused and must escalate
            to a controller or CFO.
          </p>

          {/* The honest default, stated in words. A blank cell would read as "configured". */}
          {unlimitedApprovers > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>{unlimitedApprovers}</strong>{" "}
              {unlimitedApprovers === 1 ? "person can" : "people can"} approve{" "}
              <strong>any amount</strong>. An approver with no limit set is unlimited — that is the current
              state, not a missing value.
            </div>
          )}

          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Person</th>
                  <th className="px-3 py-2">Role</th>
                  <th className="px-3 py-2 text-right">Approval limit</th>
                </tr>
              </thead>
              <tbody>
                {roles.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                      No finance roles granted yet.
                    </td>
                  </tr>
                )}
                {roles.map((r) => (
                  <tr key={r.user_id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-mono text-xs">{r.user_id.slice(0, 8)}…</td>
                    <td className="px-3 py-2 capitalize">{r.role}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.approval_limit == null ? (
                        <span className="text-amber-700">Unlimited</span>
                      ) : (
                        formatMoney(r.approval_limit)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Delegation ───────────────────────────────────────────── */}
        {/* This sits directly under approval limits because it is the same authority, lent out. Anyone
            reading "who can approve how much" must see, in the same glance, who is currently approving in
            someone else's name — otherwise the limits table above is an incomplete answer to the question
            it appears to answer. */}
        {/* Hidden entirely when delegations is unavailable (0168 unmigrated) — §A14: an unreadable
            feature must not masquerade as a configured-but-empty one. */}
        {!dgUnavailable && (
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <UserCheck size={18} /> Cover while you&apos;re away
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Going on leave? Lend your approval authority to a colleague for a fixed window, instead of
            lending them your login. The approval is then recorded as <em>theirs</em>, made under authority
            delegated by you — which is the truth, and keeps the audit trail honest.
          </p>

          {liveCount > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>{liveCount}</strong> {liveCount === 1 ? "person is" : "people are"} currently approving
              under someone else&apos;s authority. That is normal during leave — but it means the limits above
              are not the whole picture today.
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-600">
              Who covers for you
              <select
                value={gTo}
                onChange={(e) => setGTo(e.target.value)}
                className="mt-1 block w-44 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              >
                <option value="">Choose a colleague…</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.full_name ?? m.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs text-neutral-600">
              From
              <input
                type="date"
                value={gFrom}
                onChange={(e) => setGFrom(e.target.value)}
                className="mt-1 block rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-neutral-600">
              Until
              <input
                type="date"
                value={gUntil}
                onChange={(e) => setGUntil(e.target.value)}
                className="mt-1 block rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-neutral-600">
              Reason
              <input
                value={gReason}
                onChange={(e) => setGReason(e.target.value)}
                placeholder="Annual leave"
                className="mt-1 block w-36 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={delegate}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
            >
              <Plus size={14} /> Delegate
            </button>
          </div>

          {/* There is no "delegate FROM" field, and its absence is deliberate — see the note on delegate(). */}
          <p className="mt-2 text-xs text-neutral-500">
            You can only lend authority you hold yourself, and never more than your own limit. Segregation of
            duties still applies: your stand-in cannot approve a bill they entered.
          </p>

          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-3 py-2">From</th>
                  <th className="px-3 py-2">Acting</th>
                  <th className="px-3 py-2">Window</th>
                  <th className="px-3 py-2">Reason</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {delegations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-neutral-500">
                      Nobody has delegated approval authority.
                    </td>
                  </tr>
                )}
                {delegations.map((d) => {
                  const live = isLive(d);
                  return (
                    <tr key={d.id} className="border-t border-neutral-100">
                      <td className="px-3 py-2">{nameOf(d.delegator_id)}</td>
                      <td className="px-3 py-2 font-medium">{nameOf(d.delegate_id)}</td>
                      <td className="px-3 py-2 tabular-nums text-neutral-600">
                        {d.starts_on} → {d.ends_on}{" "}
                        {/* Lapsed and revoked are different facts and are never collapsed into one word.
                            "Ended" means it ran its course; "revoked" means someone took it back early. */}
                        {d.revoked_at ? (
                          <span className="ml-1 rounded-full bg-neutral-200 px-2 py-0.5 text-xs">Revoked</span>
                        ) : live ? (
                          <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">
                            Live now
                          </span>
                        ) : (
                          <span className="ml-1 rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">
                            {d.starts_on > t ? "Scheduled" : "Ended"}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-neutral-600">{d.reason ?? "—"}</td>
                      <td className="px-3 py-2 text-right">
                        {!d.revoked_at && d.ends_on >= t && (
                          <button
                            onClick={() => revoke(d.id)}
                            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {/* ── Direct vs fixed costs ────────────────────────────────── */}
        {/* This section exists because three features silently depended on a column nobody could set.
            Until an account is marked "direct", break-even treats every cost as FIXED — and prints a
            plausible, wrong number rather than failing. Overhead can be allocated to nobody, and every
            project's "fully loaded" margin reads "not yet knowable". */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Split size={18} /> Which costs rise with the work?
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            A <strong>direct</strong> cost grows with each extra job you take on — materials, contractor
            time, cost of goods. A <strong>fixed</strong> cost does not — rent, salaries, software. This one
            distinction decides your break-even point and how overhead is shared across projects, so it is
            worth ten minutes.
          </p>

          {accounts.filter((a) => a.cost_type === "direct").length === 0 && accounts.length > 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <strong>Nothing is marked as a direct cost yet.</strong> Until something is, we treat{" "}
              <em>every</em> cost as fixed — which makes your break-even point look far better than it is,
              and leaves overhead unallocatable across your projects. Both figures are currently
              misleading, and they will not look it.
            </div>
          )}

          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Expense account</th>
                  <th className="px-3 py-2">Rises with the work?</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={2} className="px-3 py-6 text-center text-neutral-500">
                      No expense accounts yet.
                    </td>
                  </tr>
                )}
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">
                      <span className="font-mono text-xs text-neutral-500">{a.code}</span> {a.name}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={a.cost_type}
                        onChange={async (e) => {
                          const res = await fetch("/api/finance/accounts", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ accountId: a.id, costType: e.target.value }),
                          });
                          const j = await res.json();
                          if (!res.ok) return toast.error(j.error ?? "Could not update the account.");
                          toast.success("Updated", "Break-even and overhead sharing will re-compute.");
                          load();
                        }}
                        className="rounded-md border border-neutral-300 px-2 py-1 text-xs"
                      >
                        <option value="none">Not classified</option>
                        <option value="direct">Direct — rises with the work</option>
                        <option value="indirect">Fixed — stays the same</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Expense policy ───────────────────────────────────────── */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Ban size={18} /> Expense policy
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Enforced by the database when the claim is entered — not by this screen. A claim that breaks
            policy is refused at the source.
          </p>

          <div className="mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-neutral-600">
              Category
              <input
                value={pCategory}
                onChange={(e) => setPCategory(e.target.value)}
                placeholder="meals"
                className="mt-1 block w-36 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-neutral-600">
              Cap
              <input
                value={pMax}
                onChange={(e) => setPMax(e.target.value)}
                inputMode="decimal"
                placeholder="40.00"
                className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="text-xs text-neutral-600">
              Receipt required above
              <input
                value={pReceiptAbove}
                onChange={(e) => setPReceiptAbove(e.target.value)}
                inputMode="decimal"
                placeholder="25.00"
                className="mt-1 block w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex items-center gap-1.5 pb-1.5 text-xs text-neutral-700">
              <input type="checkbox" checked={pDisallowed} onChange={(e) => setPDisallowed(e.target.checked)} />
              Not reimbursable
            </label>
            <button
              onClick={addPolicy}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
            >
              <Plus size={14} /> Add
            </button>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Rule</th>
                  <th className="px-3 py-2">In force from</th>
                </tr>
              </thead>
              <tbody>
                {policies.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-3 py-6 text-center text-neutral-500">
                      No policy set — every category is currently unlimited.
                    </td>
                  </tr>
                )}
                {policies.map((p) => (
                  <tr key={p.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2">{p.category ?? "—"}</td>
                    <td className="px-3 py-2">
                      {p.is_disallowed && <span className="text-red-700">Not reimbursable</span>}
                      {!p.is_disallowed && (
                        <>
                          {p.max_amount != null && <>Cap {formatMoney(p.max_amount)}</>}
                          {p.max_amount != null && p.requires_receipt_above != null && " · "}
                          {p.requires_receipt_above != null && (
                            <>Receipt above {formatMoney(p.requires_receipt_above)}</>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-neutral-600">{p.effective_from}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── Rates ────────────────────────────────────────────────── */}
        <section>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Gauge size={18} /> Mileage &amp; per-diem rates
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            A mileage claim states the distance; the rate here decides the money. Changing a rate never
            revalues past claims — an older claim keeps the rate that was in force on its date.
          </p>

          {mileage.length === 0 && (
            <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              No mileage rate is set. Until one is, a mileage claim will be <strong>refused</strong> — the
              system will not guess what a kilometre is worth.
            </div>
          )}

          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            <div>
              <div className="flex items-end gap-2">
                <label className="text-xs text-neutral-600">
                  Rate per km
                  <input
                    value={mRate}
                    onChange={(e) => setMRate(e.target.value)}
                    inputMode="decimal"
                    placeholder="0.30"
                    className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  onClick={() => addRate("mileage")}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
                >
                  Set
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                {mileage.map((m) => (
                  <li key={m.id} className="tabular-nums">
                    {formatMoney(m.rate_per_unit)} / {m.unit}{" "}
                    <span className="text-neutral-500">from {m.effective_from}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* EXCHANGE RATES. Effective-dated like every other rate here: entering a rate today does NOT
                revalue yesterday's invoice. Re-pricing history because the pound moved would rewrite what a
                transaction was worth on the day it actually happened. */}
            <div className="sm:col-span-2">
              <div className="text-xs font-medium text-neutral-700">Exchange rates</div>
              {fx.length === 0 && (
                <p className="mt-1 text-xs text-amber-800">
                  No exchange rate is set. If you invoice or are billed in another currency,{" "}
                  <strong>we cannot convert it</strong> — and we will not guess a rate, because a guessed
                  rate produces books that balance perfectly and are wrong by however much the currency moved.
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <input value={fxFrom} onChange={(e) => setFxFrom(e.target.value.toUpperCase())} maxLength={3} placeholder="EUR"
                  className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm uppercase" />
                <span className="pb-2 text-xs text-neutral-500">to</span>
                <input value={fxTo} onChange={(e) => setFxTo(e.target.value.toUpperCase())} maxLength={3} placeholder="GBP"
                  className="w-16 rounded-md border border-neutral-300 px-2 py-1.5 text-sm uppercase" />
                <input value={fxRate} onChange={(e) => setFxRate(e.target.value)} inputMode="decimal" placeholder="0.8540"
                  className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
                <button
                  onClick={async () => {
                    const r = parseMoneyInput(fxRate);
                    if (fxFrom.length !== 3 || fxTo.length !== 3) return toast.error("Use 3-letter currency codes.");
                    if (!Number.isFinite(r) || r <= 0) return toast.error("Enter a rate.");
                    const res = await fetch("/api/finance/rates", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ kind: "fx", fromCurrency: fxFrom, toCurrency: fxTo, rate: r, asOfDate: today() }),
                    });
                    const j = await res.json();
                    if (!res.ok) return toast.error(j.error ?? "Could not save the rate.");
                    setFxRate("");
                    toast.success("Rate saved", "It applies from today. Earlier transactions keep their own rate.");
                    load();
                  }}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
                >
                  Set
                </button>
              </div>
              <ul className="mt-2 flex flex-wrap gap-3 text-sm text-neutral-700">
                {fx.slice(0, 8).map((r) => (
                  <li key={r.id} className="tabular-nums">
                    1 {r.from_currency} = {Number(r.rate).toFixed(4)} {r.to_currency}{" "}
                    <span className="text-neutral-500">from {r.as_of_date}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="flex items-end gap-2">
                <label className="text-xs text-neutral-600">
                  Per-diem / day
                  <input
                    value={dRate}
                    onChange={(e) => setDRate(e.target.value)}
                    inputMode="decimal"
                    placeholder="45.00"
                    className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-xs text-neutral-600">
                  Jurisdiction
                  <input
                    value={dJurisdiction}
                    onChange={(e) => setDJurisdiction(e.target.value)}
                    placeholder="default"
                    className="mt-1 block w-28 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  onClick={() => addRate("per_diem")}
                  className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
                >
                  Set
                </button>
              </div>
              <ul className="mt-2 space-y-1 text-sm text-neutral-700">
                {perDiem.map((d) => (
                  <li key={d.id} className="tabular-nums">
                    {formatMoney(d.daily_rate)} / day · {d.jurisdiction}{" "}
                    <span className="text-neutral-500">from {d.effective_from}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
