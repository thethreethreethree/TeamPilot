"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import FinanceNotSetUp from "@/components/finance/FinanceNotSetUp";
import { formatMoney, parseMoneyInput } from "@/lib/finance/format";
import { useToast } from "@/components/ui/toast";
import { ShieldCheck, Plus, Gauge, Ban } from "lucide-react";

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

  const load = useCallback(async () => {
    const [r, p, rt] = await Promise.all([
      fetch("/api/finance/roles").then((x) => x.json()),
      fetch("/api/finance/expense-policies").then((x) => x.json()),
      fetch("/api/finance/rates").then((x) => x.json()),
    ]);
    // A failed read must NOT render as "nothing is configured" — that reads as an unpoliced company and
    // invites a controller to add a duplicate control. Say we could not load it.
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

  if (ready === false) return <FinanceNotSetUp feature="Finance controls" />;

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
