"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  User,
  BookOpen,
  CheckCircle2,
  Save,
  Volume2,
  Check,
  Package,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";

/**
 * Sales Coach → Settings (Phase 4). Role-aware: every staff/admin gets
 * the Account tab; admins also get the Coaching tab (product config).
 * §A10 — your own account + config, shown to you. §3.4 — real state +
 * honest "coming", no fake toggles.
 */

type SettingsCtx = {
  account: {
    fullName: string | null;
    companyRole: string | null;
    salesCoachRole: string | null;
  };
  isManager: boolean;
  corpus: { loaded: boolean; words: number };
};

export default function SalesCoachSettingsPage() {
  const [ctx, setCtx] = useState<SettingsCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"account" | "coaching">("account");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/sales-session/settings").catch(
        () => null
      );
      if (res && res.ok) setCtx(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isManager = ctx?.isManager ?? false;

  return (
    <>
      <TopBar title="Settings" subtitle="Sales Coach" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <>
            {/* Tabs — Coaching only shown to managers */}
            <div className="flex items-center gap-2 mb-4 border-b border-default">
              <TabButton
                active={tab === "account"}
                onClick={() => setTab("account")}
                icon={User}
                label="Account"
              />
              {isManager && (
                <TabButton
                  active={tab === "coaching"}
                  onClick={() => setTab("coaching")}
                  icon={BookOpen}
                  label="Coaching"
                />
              )}
            </div>

            {tab === "account" && ctx && (
              <div className="space-y-3">
                <Row label="Name" value={ctx.account.fullName ?? "—"} />
                <Row label="Elostate role" value={ctx.account.companyRole ?? "—"} />
                <Row
                  label="Sales Coach role"
                  value={
                    ctx.account.salesCoachRole
                      ? ctx.account.salesCoachRole
                      : "Not a Sales Coach member"
                  }
                />
                <p className="text-[11px] text-muted leading-relaxed pt-1">
                  Your Sales Coach role is set by an admin under Team. More
                  per-staff preferences (default cue mode, notifications) are
                  coming.
                </p>
              </div>
            )}

            {tab === "coaching" && isManager && ctx && (
              <div className="space-y-4">
                <CorpusEditor />

                <ProductEditor />

                <VoicePicker />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 -mb-px border-b-2 transition-colors ${
        active
          ? "border-ember-400 text-brand"
          : "border-transparent text-secondary hover:text-primary"
      }`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-default bg-white/[0.01] px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-primary capitalize">{value}</span>
    </div>
  );
}

type CorpusData = {
  content: string;
  isCustom: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
  effectiveSource: "custom" | "books" | "starter";
};

const SOURCE_LABEL: Record<CorpusData["effectiveSource"], string> = {
  custom: "your team's own corpus",
  books: "the built-in books (SPIN, Challenger, Voss, Navigate 2.0)",
  starter: "the built-in starter methodology",
};

/**
 * Editable methodology corpus (migration 0074). An admin writes/saves a
 * company-specific methodology the post-call REVIEW coach reasons from,
 * overriding the built-in books/starter (§5). Append-only: each save is a
 * new version (§3.1). Honest about which source is ACTUALLY in use (§3.4).
 */
function CorpusEditor() {
  const toast = useToast();
  const [data, setData] = useState<CorpusData | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/sales-session/corpus").catch(
        () => null
      );
      if (res && res.ok) {
        const d: CorpusData = await res.json();
        setData(d);
        setText(d.content ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = data
    ? text.trim() !== (data.content ?? "").trim()
    : text.trim().length > 0;

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/coach/sales-session/corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "failed");
      }
      toast.success("Methodology saved", "Future reviews will use it.");
      await load();
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">
          Coaching methodology
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : (
        <>
          <p className="inline-flex items-center gap-1.5 text-xs text-secondary">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" aria-hidden />
            Reviews currently use{" "}
            {SOURCE_LABEL[data?.effectiveSource ?? "starter"]}.
          </p>
          {data?.isCustom && data.updatedAt && (
            <p className="text-[11px] text-muted">
              Last saved {new Date(data.updatedAt).toLocaleString()}
              {data.updatedByName ? ` by ${data.updatedByName}` : ""}.
            </p>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder="Paste or write your team's sales methodology — the principles, moves, and language you want the post-call coach to reason from. Saving it overrides the built-in methodology for your team."
            className="w-full bg-surface border border-default rounded-lg px-3 py-2.5 text-xs text-primary placeholder:text-muted font-mono leading-relaxed focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-y"
          />

          {/* §3.4: advertise the 100k cap up front, not on rejection. */}
          <p
            className={`text-[10px] text-right ${
              text.length > 100000 ? "text-red-400" : "text-muted"
            }`}
          >
            {text.length.toLocaleString()} / 100,000 characters
          </p>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">
              {data?.effectiveSource === "custom"
                ? "Saving appends a new version (history is kept). Shapes the post-call review, not live cues."
                : "Saving your own corpus overrides the built-in. Shapes the post-call review, not live cues."}
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !text.trim() || !dirty || text.length > 100000}
              className="inline-flex items-center gap-1.5 shrink-0 bg-ember-400 hover:bg-ember-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden />
              )}
              {saving ? "Saving…" : "Save methodology"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

type ProductData = {
  content: string;
  isSet: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
};

/**
 * Editable PRODUCT / brand details (migration 0078). An admin describes what
 * the team sells; this WILL be the coach's product source for Prep Time +
 * product-aware coaching (build 2 — not yet wired). Append-only versions
 * (§3.1), mirroring the methodology
 * editor above (§A21 — same store, second kind).
 */
function ProductEditor() {
  const toast = useToast();
  const [data, setData] = useState<ProductData | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/sales-session/product").catch(
        () => null
      );
      if (res && res.ok) {
        const d: ProductData = await res.json();
        setData(d);
        setText(d.content ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = data
    ? text.trim() !== (data.content ?? "").trim()
    : text.trim().length > 0;

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/coach/sales-session/product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "failed");
      }
      toast.success(
        "Product details saved",
        "History is kept — the coach will use these once Prep Time ships."
      );
      await load();
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Package className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">
          Product &amp; brand details
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : (
        <>
          <p className="text-xs text-secondary leading-relaxed">
            What your team sells — the offer, pricing, key benefits, common
            objections, and anything a rep should have at their fingertips. The
            coach will use this for Prep Time (coming soon); saving it now means
            it&apos;s ready the moment that ships.
          </p>
          {data?.isSet && data.updatedAt && (
            <p className="text-[11px] text-muted">
              Last saved {new Date(data.updatedAt).toLocaleString()}
              {data.updatedByName ? ` by ${data.updatedByName}` : ""}.
            </p>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Describe the product/offer: what it is, who it's for, pricing, the strongest benefits, and the objections you hear most. The coach uses this to prep the rep on what they're selling."
            className="w-full bg-surface border border-default rounded-lg px-3 py-2.5 text-xs text-primary placeholder:text-muted font-mono leading-relaxed focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-y"
          />

          <p
            className={`text-[10px] text-right ${
              text.length > 100000 ? "text-red-400" : "text-muted"
            }`}
          >
            {text.length.toLocaleString()} / 100,000 characters
          </p>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">
              Saving appends a new version (history is kept).
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !text.trim() || !dirty || text.length > 100000}
              className="inline-flex items-center gap-1.5 shrink-0 bg-ember-400 hover:bg-ember-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden />
              )}
              {saving ? "Saving…" : "Save details"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

type Voice = { id: string; name: string; description: string };
type VoiceData = {
  salesCoachVoiceId: string | null;
  careVoiceId: string | null;
  effectiveVoiceId: string;
  defaultVoiceId: string;
  voices: Voice[];
};

const PREVIEW_TEXT = "Nice open — now ask one more question before you pitch.";

/**
 * Dedicated Sales Coach cue voice (migration 0075). Decoupled from
 * C.A.R.E/Jeff: a manager picks a voice (or "follow C.A.R.E"), previews
 * it (§A16 — presentation only), and saves. §3.4 — the picker reflects
 * the actually-saved selection.
 */
function VoicePicker() {
  const toast = useToast();
  const [data, setData] = useState<VoiceData | null>(null);
  const [selected, setSelected] = useState<string | null>(null); // null = follow C.A.R.E
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/sales-session/voice").catch(
        () => null
      );
      if (res && res.ok) {
        const d: VoiceData = await res.json();
        setData(d);
        setSelected(d.salesCoachVoiceId);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = data ? selected !== data.salesCoachVoiceId : false;

  const preview = async (voiceId: string | null) => {
    // "Follow C.A.R.E" (null) previews the voice it would actually use:
    // the C.A.R.E voice, or the deployment default if none is set.
    const vid =
      voiceId ?? data?.careVoiceId ?? data?.defaultVoiceId ?? null;
    setPreviewing(voiceId ?? "__follow__");
    try {
      const res = await fetch("/api/coach/sales-session/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          vid ? { text: PREVIEW_TEXT, voiceId: vid } : { text: PREVIEW_TEXT }
        ),
      });
      if (!res.ok) throw new Error("preview failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch {
      toast.error("Couldn't play a preview");
    } finally {
      setPreviewing(null);
    }
  };

  const save = async () => {
    if (saving || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/coach/sales-session/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voiceId: selected }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "failed");
      }
      toast.success("Cue voice saved");
      await load();
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  const options: Array<{
    id: string | null;
    name: string;
    description: string;
  }> = [
    {
      id: null,
      name: "Follow C.A.R.E voice",
      description: "Default — uses the same voice as your C.A.R.E assistant.",
    },
    ...(data?.voices ?? []),
  ];

  return (
    <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <Volume2 className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Cue voice</h2>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        The voice the live coach speaks cues to the agent&apos;s earpiece.
        Setting one here is independent of C.A.R.E/Jeff.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-default divide-y divide-default overflow-hidden">
            {options.map((opt) => {
              const isSel = selected === opt.id;
              const previewKey = opt.id ?? "__follow__";
              return (
                <div
                  key={previewKey}
                  className="flex items-center gap-2 px-3 py-2.5"
                >
                  <button
                    type="button"
                    onClick={() => setSelected(opt.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left"
                  >
                    <span
                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                        isSel
                          ? "border-ember-400 bg-ember-400"
                          : "border-default"
                      }`}
                    >
                      {isSel && (
                        <Check
                          className="w-2.5 h-2.5 text-[#09090B]"
                          aria-hidden
                        />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs text-primary truncate">
                        {opt.name}
                      </span>
                      <span className="block text-[10px] text-muted truncate">
                        {opt.description}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void preview(opt.id)}
                    disabled={previewing !== null}
                    className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-primary border border-default rounded-md px-2 py-1 shrink-0 disabled:opacity-50"
                  >
                    {previewing === previewKey ? (
                      <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                    ) : (
                      <Volume2 className="w-3 h-3" aria-hidden />
                    )}
                    Preview
                  </button>
                </div>
              );
            })}
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden />
              )}
              {saving ? "Saving…" : "Save voice"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
