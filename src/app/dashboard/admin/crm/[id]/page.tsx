"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { useToast } from "@/components/ui/toast";
import {
  ArrowLeft,
  Loader2,
  Pin,
  Plus,
  Trash2,
  Receipt,
  Users,
  Activity as ActivityIcon,
  StickyNote,
  ShieldAlert,
} from "lucide-react";
import {
  LIFECYCLE_LABEL,
  LIFECYCLE_TONE,
  PLAN_LABEL,
  SUBSCRIPTION_LABEL,
  type CrmAccount,
  type CrmActivityEvent,
  type CrmContact,
  type CrmInvoice,
  type CrmLifecycleStage,
  type CrmNote,
  type CrmSubscription,
} from "@/lib/crm/types";

type Detail = {
  account: CrmAccount;
  subscription: CrmSubscription | null;
  subscriptions: CrmSubscription[];
  contacts: CrmContact[];
  notes: CrmNote[];
  invoices: CrmInvoice[];
  activity: CrmActivityEvent[];
};

const ACTIVITY_LABEL: Record<CrmActivityEvent["kind"], string> = {
  account_created: "Account created",
  lifecycle_changed: "Lifecycle changed",
  subscription_changed: "Subscription changed",
  invoice_issued: "Invoice issued",
  invoice_paid: "Invoice paid",
  contact_added: "Contact added",
  contact_removed: "Contact removed",
  note_added: "Note added",
  support_volume_spiked: "Support volume spiked",
  control_month_completed: "Control month completed",
  health_changed: "Health changed",
  owner_assigned: "Owner assigned",
};

export default function CrmAccountDetailPage() {
  const params = useParams();
  const toast = useToast();
  const accountId = params?.id as string;
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [tab, setTab] = useState<
    "overview" | "contacts" | "subscription" | "activity" | "notes"
  >("overview");

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/crm/accounts/${accountId}`);
    if (res.status === 403) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = (await res.json()) as Detail;
    setDetail(data);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (forbidden) {
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Account" subtitle="Vendor back office" />
        <div className="p-6 max-w-3xl mx-auto">
          <div className="glass-card p-6 border-ember-800/40 bg-ember-800/[0.06]">
            <div className="flex items-center gap-2 mb-2">
              <ShieldAlert className="w-4 h-4 text-ember-300" aria-hidden />
              <h2 className="text-sm font-semibold text-primary">
                Vendor admin only
              </h2>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              CRM detail pages require CEO / COO / admin role.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !detail) {
    return (
      <div className="min-h-screen bg-base">
        <TopBar title="Account" subtitle="Loading…" />
        <div className="p-6 max-w-7xl mx-auto">
          <Loader2
            className="w-4 h-4 animate-spin text-muted"
            aria-hidden
          />
        </div>
      </div>
    );
  }

  const { account, subscription, contacts, notes, invoices, activity } =
    detail;

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title={`Account · ${account.id.slice(0, 8)}`}
        subtitle="Vendor back office"
      />
      <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
        <Link
          href="/dashboard/admin/crm"
          className="inline-flex items-center gap-1 text-[11px] text-muted hover:text-primary"
        >
          <ArrowLeft className="w-3 h-3" aria-hidden /> Back to accounts
        </Link>

        {/* Hero */}
        <div className="glass-card p-5 flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-primary">
              Account
            </h1>
            <p className="text-xs font-mono text-muted mt-0.5">
              {account.companyId}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${LIFECYCLE_TONE[account.lifecycleStage]}`}
              >
                {LIFECYCLE_LABEL[account.lifecycleStage]}
              </span>
              {subscription && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-default bg-surface text-secondary">
                  {PLAN_LABEL[subscription.plan]} ·{" "}
                  {SUBSCRIPTION_LABEL[subscription.status]}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-default bg-surface text-secondary">
                billing: {account.billingStatus}
              </span>
              {account.isTestAccount && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full border border-violet-500/40 bg-violet-500/10 text-violet-300">
                  test account
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <LifecycleSwitcher
              current={account.lifecycleStage}
              accountId={account.id}
              onChanged={() => void load()}
            />
            <button
              type="button"
              onClick={async () => {
                const res = await fetch(`/api/admin/crm/accounts/${account.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    isTestAccount: !account.isTestAccount,
                  }),
                });
                if (!res.ok) {
                  toast.error("Couldn't update the account", "Please try again.");
                  return;
                }
                void load();
              }}
              className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded border border-default bg-surface text-secondary hover:text-primary"
            >
              {account.isTestAccount
                ? "Mark as production"
                : "Mark as test account"}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-default overflow-x-auto">
          {(
            [
              {
                key: "overview",
                label: "Overview",
                icon: ActivityIcon,
                hint: {
                  whatItIs: "The at-a-glance summary of this account — industry, size, health score, primary contact, lifecycle stage, account owner. The first thing you see when opening an account.",
                  why: "Vendor admin work is usually 'why is this account where it is?' Overview is the structured answer in one view: the basics + a quick activity pulse so context loads fast.",
                  how: "Land here, scan the basics, click into the right tab if you need to act. For deeper history, switch to Activity. For touch points, Contacts.",
                },
              },
              {
                key: "contacts",
                label: "Contacts",
                icon: Users,
                hint: {
                  whatItIs: "Every named contact on this account — full name, email, role, primary vs secondary. Add new contacts here; their email auto-attaches to any inbound C.A.R.E conversation from the same address.",
                  why: "Most vendor-customer relationships are with people, not companies. Tracking contacts lets the team know WHO they're talking to vs guessing from email signatures. When the primary contact churns, you see it.",
                  how: "Add contacts as the team meets them. Mark exactly ONE as primary (the system uses primary email as default reply target). Keep roles accurate so the team knows whether they're talking to ops, eng, or leadership.",
                  principle: "Relationships are with people. The contact list is how the team remembers WHO across turnover.",
                },
              },
              {
                key: "subscription",
                label: "Subscription",
                icon: Receipt,
                hint: {
                  whatItIs: "The account's plan + status — plan tier, seat count, MRR, subscription state (active / not_collecting / paused / cancelled). Per the constitution, billing is in the schema but NOT actively collecting during pilot; state stays 'not_collecting' until the team explicitly turns on live billing.",
                  why: "Billing data here is the SHAPE of what will land when collection turns on — not active charges yet. The honesty here matters: claiming MRR you haven't collected would corrupt the team's read of revenue.",
                  how: "Read to see how this account is configured for billing. Use Generate stub to produce paper invoices for bookkeeping while collection is off. When live billing turns on tenant-wide, this tab becomes the operational subscription surface.",
                  principle: "Subscription data is honest about the not-collecting state. Performing revenue you haven't collected is the failure mode this surface defeats.",
                },
              },
              {
                key: "activity",
                label: "Activity",
                icon: ActivityIcon,
                hint: {
                  whatItIs: "The chronological log of every event on this account — lifecycle changes, subscription updates, contact additions, notes appended. Each row is an immutable §3.1 chain event.",
                  why: "Without an audit trail, account state changes get re-litigated ('who moved this to churned and when?'). The activity log is the structural answer: it shows exactly who did what, when, with what reason.",
                  how: "Scan top-down for recent activity. Open older logs when investigating 'how did this account get to where it is.' Use the activity log as evidence in any vendor-side decision about the account's future.",
                  principle: "Append-only history is how vendor admin avoids re-litigating decisions. The log is the record.",
                },
              },
              {
                key: "notes",
                label: "Notes",
                icon: StickyNote,
                hint: {
                  whatItIs: "Free-form notes on this account — the team's read of the relationship, things worth remembering, context that doesn't fit in other tabs. Notes are append-only (no editing prior notes); new notes append to the bottom.",
                  why: "Salesforce-style structured fields can't capture nuance like 'CTO is skeptical about pricing but their CEO loves us.' Notes are where the human read lives. Append-only keeps the history honest: you can disagree with a prior note, but you can't erase it.",
                  how: "Write a note when something material changes (new contact joins, decision-maker shifts, pricing conversation happens). Date it implicitly via the chain. Future notes can reference and update without erasing.",
                  principle: "Append-only notes preserve the team's evolving read. Erasing history is the failure mode this defeats.",
                },
              },
            ] as const
          ).map((t) => {
            const Icon = t.icon;
            return (
              <LearningHint
                key={t.key}
                category="CRM · Tab"
                title={t.label}
                whatItIs={t.hint.whatItIs}
                why={t.hint.why}
                how={t.hint.how}
                principle={"principle" in t.hint ? t.hint.principle : undefined}
              >
                <button
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 border-b-2 transition-colors shrink-0 ${
                    tab === t.key
                      ? "border-ember-400 text-primary"
                      : "border-transparent text-secondary hover:text-primary"
                  }`}
                >
                  <Icon className="w-3 h-3" aria-hidden />
                  {t.label}
                </button>
              </LearningHint>
            );
          })}
        </div>

        {tab === "overview" && (
          <OverviewTab
            account={account}
            contactCount={contacts.length}
            noteCount={notes.length}
            recentActivity={activity.slice(0, 6)}
            invoices={invoices}
            onChanged={() => void load()}
          />
        )}
        {tab === "contacts" && (
          <ContactsTab
            accountId={account.id}
            contacts={contacts}
            onChanged={() => void load()}
          />
        )}
        {tab === "subscription" && (
          <SubscriptionTab
            accountId={account.id}
            subscription={subscription}
            invoices={invoices}
            onChanged={() => void load()}
          />
        )}
        {tab === "activity" && <ActivityTab activity={activity} />}
        {tab === "notes" && (
          <NotesTab
            accountId={account.id}
            notes={notes}
            onChanged={() => void load()}
          />
        )}
      </div>
    </div>
  );
}

// ─────────── Lifecycle switcher ──────────────────────────────

const LIFECYCLE_OPTIONS: CrmLifecycleStage[] = [
  "trial",
  "control_month",
  "activated",
  "paying",
  "at_risk",
  "churned",
  "archived",
];

function LifecycleSwitcher({
  current,
  accountId,
  onChanged,
}: {
  current: CrmLifecycleStage;
  accountId: string;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const change = async (stage: CrmLifecycleStage) => {
    setBusy(true);
    const res = await fetch(`/api/admin/crm/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lifecycleStage: stage }),
    });
    setBusy(false);
    // §3.4: a failed lifecycle change (the most important field) must be VISIBLE,
    // not silently dropped while the UI re-fetches and looks unchanged.
    if (!res.ok) {
      toast.error("Couldn't change the lifecycle stage", "Please try again.");
      return;
    }
    onChanged();
  };
  return (
    <LearningHint
      as="block"
      category="CRM · Lifecycle"
      title="Lifecycle stage switcher"
      whatItIs="A horizontal row of stage buttons (lead → trial → active → at_risk → churned, etc.). Clicking a different stage writes a lifecycle_changed chain event on this account immediately. The current stage is the highlighted ember button."
      why="The lifecycle stage is the single most important field on an account — it drives the team's read of customer health AND it shapes the vendor metrics (count by stage, conversion rates, churn signal). The append-only chain event means every transition is auditable: WHO moved this account to where, and WHEN."
      how="Click a different stage when the account's state has materially changed. The change writes immediately; there's no Save button (the discipline is that lifecycle changes are deliberate, not draft). For nuance the stage can't capture, use the Notes tab."
      principle="Lifecycle is operational truth. Treat the transition button like a chain event — because that's exactly what it is."
    >
    <div className="flex items-center gap-1.5 flex-wrap">
      {LIFECYCLE_OPTIONS.map((s) => (
        <button
          key={s}
          type="button"
          disabled={busy || s === current}
          onClick={() => void change(s)}
          className={`text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded border transition-colors ${
            s === current
              ? "border-ember-400 bg-ember-400/15 text-ember-300 cursor-default"
              : "border-default bg-surface text-secondary hover:text-primary hover:border-strong disabled:opacity-50"
          }`}
        >
          {LIFECYCLE_LABEL[s]}
        </button>
      ))}
    </div>
    </LearningHint>
  );
}

// ─────────── Overview tab ────────────────────────────────────

function OverviewTab({
  account,
  contactCount,
  noteCount,
  recentActivity,
  invoices,
  onChanged,
}: {
  account: CrmAccount;
  contactCount: number;
  noteCount: number;
  recentActivity: CrmActivityEvent[];
  invoices: CrmInvoice[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    industry: account.industry ?? "",
    sizeBracket: account.sizeBracket ?? "",
    region: account.region ?? "",
    primaryContactEmail: account.primaryContactEmail ?? "",
    healthScore: account.healthScore ?? "",
    healthReason: account.healthReason ?? "",
    sourceNote: account.sourceNote ?? "",
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/crm/accounts/${account.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        industry: form.industry || null,
        sizeBracket: form.sizeBracket || null,
        region: form.region || null,
        primaryContactEmail: form.primaryContactEmail || null,
        healthScore: form.healthScore === "" ? null : Number(form.healthScore),
        healthReason: form.healthReason || null,
        sourceNote: form.sourceNote || null,
      }),
    });
    setSaving(false);
    // §3.4: don't close the editor + claim saved if the write failed.
    if (!res.ok) {
      toast.error("Couldn't save the account", "Please try again.");
      return;
    }
    setEditing(false);
    onChanged();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-primary">Profile</h2>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-[11px] text-ember-300 hover:text-primary"
            >
              Edit
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="text-[11px] text-muted hover:text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="text-[11px] font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-2.5 py-0.5 rounded"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          )}
        </div>
        {editing ? (
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Industry">
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm({ ...form, industry: e.target.value })}
                className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
              />
            </FormField>
            <FormField label="Size bracket">
              <select
                value={form.sizeBracket}
                onChange={(e) =>
                  setForm({ ...form, sizeBracket: e.target.value })
                }
                className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
              >
                <option value="">—</option>
                <option value="1-10">1–10</option>
                <option value="11-50">11–50</option>
                <option value="51-200">51–200</option>
                <option value="201-500">201–500</option>
                <option value="500+">500+</option>
              </select>
            </FormField>
            <FormField label="Region">
              <input
                type="text"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
              />
            </FormField>
            <FormField label="Primary contact email">
              <input
                type="email"
                autoComplete="email"
                value={form.primaryContactEmail}
                onChange={(e) =>
                  setForm({ ...form, primaryContactEmail: e.target.value })
                }
                className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
              />
            </FormField>
            <FormField label="Health score (0–100)">
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={100}
                value={form.healthScore}
                onChange={(e) =>
                  setForm({ ...form, healthScore: e.target.value })
                }
                className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
              />
            </FormField>
            <FormField label="Health reason">
              <input
                type="text"
                value={form.healthReason}
                onChange={(e) =>
                  setForm({ ...form, healthReason: e.target.value })
                }
                className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
              />
            </FormField>
            <div className="col-span-2">
              <FormField label="Source note">
                <textarea
                  value={form.sourceNote}
                  onChange={(e) =>
                    setForm({ ...form, sourceNote: e.target.value })
                  }
                  rows={2}
                  className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none resize-y"
                />
              </FormField>
            </div>
          </div>
        ) : (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <ReadField label="Industry" value={account.industry} />
            <ReadField label="Size bracket" value={account.sizeBracket} />
            <ReadField label="Region" value={account.region} />
            <ReadField
              label="Primary contact email"
              value={account.primaryContactEmail}
            />
            <ReadField
              label="Health score"
              value={
                account.healthScore !== null
                  ? `${account.healthScore} / 100`
                  : null
              }
            />
            <ReadField label="Health reason" value={account.healthReason} />
            <ReadField label="Source" value={account.source} />
            <ReadField label="Source note" value={account.sourceNote} />
          </dl>
        )}
      </div>
      <div className="space-y-3">
        <div className="glass-card p-3">
          <h2 className="text-sm font-semibold text-primary mb-2">
            At a glance
          </h2>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <Stat label="Contacts" value={contactCount} />
            <Stat label="Notes" value={noteCount} />
            <Stat label="Invoices" value={invoices.length} />
            <Stat
              label="Activity entries"
              value={recentActivity.length > 0 ? "many" : "0"}
            />
          </dl>
        </div>
        <div className="glass-card p-3">
          <h2 className="text-sm font-semibold text-primary mb-2">
            Recent activity
          </h2>
          <ul className="space-y-1.5">
            {recentActivity.length === 0 && (
              <li className="text-xs text-muted italic">No activity yet.</li>
            )}
            {recentActivity.map((e) => (
              <li
                key={e.id}
                className="text-[11px] text-secondary flex items-center justify-between gap-2"
              >
                <span>{ACTIVITY_LABEL[e.kind] ?? e.kind}</span>
                <span className="text-muted font-mono">
                  {new Date(e.createdAt).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-widest font-bold text-muted block mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function ReadField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest font-bold text-muted">
        {label}
      </dt>
      <dd className="text-secondary mt-0.5">{value ?? "—"}</dd>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest font-bold text-muted">
        {label}
      </dt>
      <dd className="text-sm text-primary font-semibold">{value}</dd>
    </div>
  );
}

// ─────────── Contacts tab ────────────────────────────────────

function ContactsTab({
  accountId,
  contacts,
  onChanged,
}: {
  accountId: string;
  contacts: CrmContact[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    role: "",
    isPrimary: false,
    isDecisionMaker: false,
  });
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!form.fullName.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/crm/accounts/${accountId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName.trim(),
        email: form.email.trim() || null,
        role: form.role.trim() || null,
        isPrimary: form.isPrimary,
        isDecisionMaker: form.isDecisionMaker,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't add the contact", "Please try again.");
      return;
    }
    setAdding(false);
    setForm({
      fullName: "",
      email: "",
      role: "",
      isPrimary: false,
      isDecisionMaker: false,
    });
    onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this contact?")) return;
    const res = await fetch(`/api/admin/crm/contacts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Couldn't remove the contact", "Please try again.");
      return;
    }
    onChanged();
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">
          Contacts ({contacts.length})
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-ember-300 hover:text-primary"
          >
            <Plus className="w-3 h-3" aria-hidden /> Add contact
          </button>
        )}
      </div>
      {adding && (
        <div className="border border-default rounded-md p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              placeholder="Full name"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
            />
            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
            />
            <input
              type="text"
              placeholder="Role"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
            />
            <div className="flex items-center gap-3 text-[11px] text-secondary">
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={form.isPrimary}
                  onChange={(e) =>
                    setForm({ ...form, isPrimary: e.target.checked })
                  }
                  className="accent-ember-400"
                />
                Primary
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={form.isDecisionMaker}
                  onChange={(e) =>
                    setForm({ ...form, isDecisionMaker: e.target.checked })
                  }
                  className="accent-ember-400"
                />
                Decision-maker
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="text-[11px] text-muted hover:text-secondary"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || !form.fullName.trim()}
              onClick={() => void submit()}
              className="text-[11px] font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-40 px-2.5 py-0.5 rounded"
            >
              {saving ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      )}
      {contacts.length === 0 ? (
        <p className="text-xs text-muted italic">No contacts yet.</p>
      ) : (
        <ul className="divide-y divide-default">
          {contacts.map((c) => (
            <li
              key={c.id}
              className="py-2 flex items-center justify-between gap-3"
            >
              <div>
                <p className="text-sm text-primary font-semibold">
                  {c.fullName}
                  {c.isPrimary && (
                    <span className="ml-2 text-[10px] uppercase tracking-widest text-ember-300">
                      primary
                    </span>
                  )}
                  {c.isDecisionMaker && (
                    <span className="ml-2 text-[10px] uppercase tracking-widest text-violet-300">
                      decision-maker
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-secondary">
                  {c.role ?? "—"} · {c.email ?? "no email"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void remove(c.id)}
                className="text-muted hover:text-ember-300 p-1"
                aria-label="Remove contact"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────── Subscription tab ────────────────────────────────

function SubscriptionTab({
  accountId,
  subscription,
  invoices,
  onChanged,
}: {
  accountId: string;
  subscription: CrmSubscription | null;
  invoices: CrmInvoice[];
  onChanged: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [plan, setPlan] = useState<CrmSubscription["plan"]>(
    subscription?.plan ?? "pilot"
  );
  const [status, setStatus] = useState<CrmSubscription["status"]>(
    subscription?.status ?? "control_month"
  );
  const [seatCount, setSeatCount] = useState<number>(
    subscription?.seatCount ?? 0
  );
  const [mrr, setMrr] = useState<number>(
    Math.floor((subscription?.monthlyRecurringRevenueCents ?? 0) / 100)
  );
  const [stubAmount, setStubAmount] = useState<string>("0");
  const toast = useToast();

  const save = async () => {
    setSaving(true);
    const res = await fetch(`/api/admin/crm/accounts/${accountId}/subscription`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        plan,
        status,
        seatCount,
        monthlyRecurringRevenueCents: Math.max(0, Math.floor(mrr * 100)),
      }),
    });
    setSaving(false);
    // §3.4: MRR/plan/seats are the vendor's revenue truth — a silent failed save
    // would corrupt the metrics the vendor reads. Surface it.
    if (!res.ok) {
      toast.error("Couldn't save the subscription", "Please try again.");
      return;
    }
    onChanged();
  };

  const generateStub = async () => {
    const cents = Math.max(0, Math.floor(parseFloat(stubAmount) * 100));
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    setSaving(true);
    const res = await fetch(`/api/admin/crm/accounts/${accountId}/subscription`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountCents: cents,
        periodStart: start.toISOString(),
        periodEnd: end.toISOString(),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't generate the invoice", "Please try again.");
      return;
    }
    setStubAmount("0");
    onChanged();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="glass-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-primary">Plan + state</h2>
        <p className="text-[11px] text-muted italic">
          Per §3.4 — collection is off. Status changes are bookkeeping only
          until live billing is turned on.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Plan">
            <select
              value={plan}
              onChange={(e) =>
                setPlan(e.target.value as CrmSubscription["plan"])
              }
              className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
            >
              {(
                [
                  "pilot",
                  "team_small",
                  "team_medium",
                  "team_large",
                  "enterprise",
                ] as const
              ).map((p) => (
                <option key={p} value={p}>
                  {PLAN_LABEL[p]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as CrmSubscription["status"])
              }
              className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
            >
              {(
                [
                  "inactive",
                  "trialing",
                  "control_month",
                  "active",
                  "paused",
                  "past_due",
                  "cancelled",
                ] as const
              ).map((s) => (
                <option key={s} value={s}>
                  {SUBSCRIPTION_LABEL[s]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Seat count">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={seatCount}
              onChange={(e) =>
                setSeatCount(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
            />
          </FormField>
          <FormField label="MRR (USD)">
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={mrr}
              onChange={(e) =>
                setMrr(Math.max(0, parseInt(e.target.value, 10) || 0))
              }
              className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none"
            />
          </FormField>
        </div>
        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="text-[11px] font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-50 px-2.5 py-1 rounded"
          >
            {saving ? "Saving…" : "Save subscription"}
          </button>
        </div>
      </div>
      <div className="glass-card p-4 space-y-3">
        <h2 className="text-sm font-semibold text-primary">Invoices</h2>
        <p className="text-[11px] text-muted italic">
          Stub invoices generated for bookkeeping. Status =
          &quot;not_collecting&quot; until live billing.
        </p>
        <div className="border border-default rounded-md p-2 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            Generate stub (USD)
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            value={stubAmount}
            onChange={(e) => setStubAmount(e.target.value)}
            className="flex-1 bg-base border border-default focus:border-strong rounded-md px-2 py-1 text-xs text-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void generateStub()}
            disabled={saving}
            className="text-[11px] font-semibold text-ember-300 hover:text-primary disabled:opacity-50"
          >
            Generate
          </button>
        </div>
        {invoices.length === 0 ? (
          <p className="text-xs text-muted italic">No invoices yet.</p>
        ) : (
          <ul className="divide-y divide-default">
            {invoices.map((inv) => (
              <li
                key={inv.id}
                className="py-2 flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="text-primary font-mono">
                    {inv.invoiceNumber}
                  </p>
                  <p className="text-muted font-mono text-[10px]">
                    {new Date(inv.periodStart).toLocaleDateString()} →{" "}
                    {new Date(inv.periodEnd).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-primary font-semibold">
                    ${(inv.amountCents / 100).toFixed(2)}
                  </p>
                  <p className="text-[10px] text-muted uppercase tracking-widest">
                    {inv.status}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─────────── Activity tab ────────────────────────────────────

function ActivityTab({ activity }: { activity: CrmActivityEvent[] }) {
  return (
    <div className="glass-card p-4">
      <h2 className="text-sm font-semibold text-primary mb-3">
        Activity ({activity.length})
      </h2>
      {activity.length === 0 ? (
        <p className="text-xs text-muted italic">No activity yet.</p>
      ) : (
        <ul className="space-y-2">
          {activity.map((e) => (
            <li
              key={e.id}
              className="border border-default rounded-md p-2.5 text-xs"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-primary font-semibold">
                  {ACTIVITY_LABEL[e.kind] ?? e.kind}
                </span>
                <span className="text-muted font-mono text-[10px]">
                  {new Date(e.createdAt).toLocaleString()}
                </span>
              </div>
              {Object.keys(e.payload).length > 0 && (
                <pre className="text-[10px] text-secondary font-mono whitespace-pre-wrap overflow-x-auto">
                  {JSON.stringify(e.payload, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─────────── Notes tab ───────────────────────────────────────

function NotesTab({
  accountId,
  notes,
  onChanged,
}: {
  accountId: string;
  notes: CrmNote[];
  onChanged: () => void;
}) {
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const submit = async () => {
    if (!body.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/admin/crm/accounts/${accountId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: body.trim(), pinned }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error("Couldn't save the note", "Please try again.");
      return;
    }
    setBody("");
    setPinned(false);
    onChanged();
  };

  return (
    <div className="glass-card p-4 space-y-3">
      <h2 className="text-sm font-semibold text-primary">
        Notes ({notes.length})
      </h2>
      <div className="border border-default rounded-md p-2 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Internal note about this account…"
          rows={2}
          className="w-full bg-base border border-default focus:border-strong rounded-md px-2 py-1.5 text-xs text-primary focus:outline-none resize-y"
        />
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-1 text-[11px] text-secondary">
            <input
              type="checkbox"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="accent-ember-400"
            />
            Pin to top
          </label>
          <button
            type="button"
            disabled={!body.trim() || saving}
            onClick={() => void submit()}
            className="text-[11px] font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-40 px-2.5 py-0.5 rounded"
          >
            {saving ? "Saving…" : "Add note"}
          </button>
        </div>
      </div>
      {notes.length === 0 ? (
        <p className="text-xs text-muted italic">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li
              key={n.id}
              className={`border rounded-md p-2.5 ${n.pinned ? "border-ember-400/40 bg-ember-400/[0.04]" : "border-default"}`}
            >
              <div className="flex items-center justify-between text-[10px] text-muted mb-1">
                <span className="font-mono">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
                {n.pinned && (
                  <span className="inline-flex items-center gap-1 text-ember-300">
                    <Pin className="w-3 h-3" aria-hidden /> Pinned
                  </span>
                )}
              </div>
              <p className="text-xs text-primary leading-relaxed whitespace-pre-wrap">
                {n.body}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
