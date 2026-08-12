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
import { LearningModePanel } from "@/components/settings/LearningModePanel";
import { ExperienceModePanel } from "@/components/settings/ExperienceModePanel";
import { QuotaTargetPanel } from "@/components/sales-coach/QuotaTargetPanel";
import { LearningHint } from "@/components/learning/LearningHint";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";
import { DocUploadButton } from "@/components/sales-coach/DocUploadButton";

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
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full bg-base">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <>
            {/* Tabs — Coaching only shown to managers */}
            <div className="flex items-center gap-2 mb-4 border-b border-default">
              <LearningHint
                as="inline-block"
                category="Sales Coach · Settings"
                title="Account tab"
                whatItIs="Your own Sales Coach identity — your name, your Elostate role, and the role you hold inside the Sales Coach product."
                why="The coach adapts to who you are: what it shows a rep is not what it shows a manager. Knowing your role tells you which controls you'll see and which are set for you."
                how="Open this tab to confirm the coach has you identified correctly. If a role looks wrong, an admin fixes it under Team."
                principle="A coach that doesn't know who it's coaching is guessing.">
                <TabButton
                  active={tab === "account"}
                  onClick={() => setTab("account")}
                  icon={User}
                  label="Account"
                />
              </LearningHint>
              {isManager && (
                <LearningHint
                  as="inline-block"
                  category="Sales Coach · Settings"
                  title="Coaching tab"
                  whatItIs="The manager-only workshop where you set what the coach reasons from: your methodology, your product details, and the live-cue voice."
                  why="Out of the box the coach reasons from generic sales books. This tab is where it becomes YOUR company's coach instead of a generic one — the single biggest lever on how useful its coaching is."
                  how="Only managers see this tab. Fill in the three editors here so every rep's reviews and cues reflect how your team actually sells."
                  principle="Each company has its own personality; a coach that ignores it can only give generic advice.">
                  <TabButton
                    active={tab === "coaching"}
                    onClick={() => setTab("coaching")}
                    icon={BookOpen}
                    label="Coaching"
                  />
                </LearningHint>
              )}
            </div>

            {tab === "account" && ctx && (
              <div className="space-y-3">
                <LearningHint
                  as="block"
                  category="Sales Coach · Account"
                  title="Name"
                  whatItIs="The name the coach and your team know you by — pulled from your Elostate profile."
                  why="Reviews, cues, and any team-facing coaching are attributed to a person, not an anonymous seat. This is that person."
                  how="If it's wrong, update your profile in Elostate; it flows here automatically."
                  principle="Coaching is personal; it has to be addressed to someone.">
                  <Row label="Name" value={ctx.account.fullName ?? "—"} />
                </LearningHint>
                <LearningHint
                  as="block"
                  category="Sales Coach · Account"
                  title="Elostate role"
                  whatItIs="Your role across the wider Elostate platform — the same identity you carry everywhere, not something specific to Sales Coach."
                  why="Sales Coach lives inside Elostate. Your platform role governs baseline access; the Sales Coach role below is layered on top of it."
                  how="Read-only here. An admin changes platform roles in the main Elostate team settings."
                  principle="One identity across the platform keeps access honest and traceable.">
                  <Row label="Elostate role" value={ctx.account.companyRole ?? "—"} />
                </LearningHint>
                <LearningHint
                  as="block"
                  category="Sales Coach · Account"
                  title="Sales Coach role"
                  whatItIs="The role you hold specifically inside Sales Coach — for example a rep who receives coaching, or a manager who configures it."
                  why="This role, not your platform role, decides what the coach shows you: reps get cues and reviews, managers also get the Coaching tab to set methodology, product, and voice."
                  how="Read-only here. An admin assigns Sales Coach roles under Team. 'Not a Sales Coach member' means you haven't been added yet."
                  principle="The coach can only guide you correctly once it knows the seat you actually sit in.">
                  <Row
                    label="Sales Coach role"
                    value={
                      ctx.account.salesCoachRole
                        ? ctx.account.salesCoachRole
                        : "Not a Sales Coach member"
                    }
                  />
                </LearningHint>
                <p className="text-[11px] text-muted leading-relaxed pt-1">
                  Your Sales Coach role is set by an admin under Team. More
                  per-staff preferences (default cue mode, notifications) are
                  coming.
                </p>
                {/* Learning Mode — the SAME per-user preference Elostate uses
                    (§A21: same LearningModePanel + provider + profiles.
                    learning_mode_enabled). Toggling here flips it everywhere,
                    including Elostate. */}
                <LearningModePanel />
                {/* Experience Mode — the SAME per-user dial (0110), present in
                    Sales Coach per founder spec; flipping here applies everywhere. */}
                <ExperienceModePanel />
              </div>
            )}

            {tab === "coaching" && isManager && ctx && (
              <div className="space-y-4">
                <QuotaTargetPanel />
                <CorpusEditor />

                <ProductEditor />

                <VoicePicker />

                <VoiceHealthCard />
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
    <div className="flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3">
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
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
      <LearningHint
        as="block"
        category="Sales Coach · Corpus"
        title="Coaching methodology"
        whatItIs="Your team's own sales methodology — the principles, moves, and language you want the post-call review coach to reason from."
        why="Without it, the coach reasons from the built-in books (SPIN, Challenger, Voss, Navigate 2.0) — good, but generic. Saving your own corpus overrides those so the coach critiques calls against how YOUR team actually sells."
        how="Paste or write your methodology in the box below and save. It shapes the post-call review — not the live in-call cues."
        principle="The corpus is the coach's per-company personality; feed it yours or it stays generic.">
        <div className="flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5 text-brand" aria-hidden />
          <h2 className="text-sm font-semibold text-primary">
            Coaching methodology
          </h2>
        </div>
      </LearningHint>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : (
        <>
          <LearningHint
            as="block"
            category="Sales Coach · Corpus"
            title="Active source"
            whatItIs="An honest read-out of which methodology the coach is ACTUALLY using right now: your custom corpus, the built-in books, or the starter."
            why="It would be easy to imply your corpus is live the moment you open this page. This line refuses that — it tells you the real source, so you're never coached against a methodology you think you replaced but didn't."
            how="Check it after saving. Once it reads 'your team's own corpus,' your methodology is what reviews reason from."
            principle="Honesty about what's actually running beats a reassuring label that isn't true.">
            <p className="inline-flex items-center gap-1.5 text-xs text-secondary">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" aria-hidden />
              Reviews currently use{" "}
              {SOURCE_LABEL[data?.effectiveSource ?? "starter"]}.
            </p>
          </LearningHint>
          {data?.isCustom && data.updatedAt && (
            <p className="text-[11px] text-muted">
              Last saved {new Date(data.updatedAt).toLocaleString()}
              {data.updatedByName ? ` by ${data.updatedByName}` : ""}.
            </p>
          )}

          {/* Upload → fill the draft for review, then Save (founder 2026-07-30).
              Non-destructive: replaces the editor draft, not the saved version. */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-muted">
              Have it in a document? Upload a file to fill the editor, then review below.
            </p>
            <DocUploadButton onExtracted={setText} targetLabel="the methodology" />
          </div>

          <LearningHint
            as="block"
            category="Sales Coach · Corpus"
            title="Methodology editor"
            whatItIs="The free-text box where you write or paste the methodology itself — the actual content the coach reads."
            why="This is the raw material of your custom coach. Everything the review coach says about a call is traced back through the words you put here, so specificity here becomes specificity in the coaching."
            how="Write in plain language: the principles you believe in, the moves you want reps making, the phrasing you want them using. Save when it reflects your team."
            principle="Vague input, vague coaching — the corpus is only as sharp as what you write into it.">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={14}
              placeholder="Paste or write your team's sales methodology — the principles, moves, and language you want the post-call coach to reason from. Saving it overrides the built-in methodology for your team."
              className="w-full bg-surface border border-default rounded-lg px-3 py-2.5 text-xs text-primary placeholder:text-muted font-mono leading-relaxed focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-y"
            />
          </LearningHint>

          {/* §3.4: advertise the 100k cap up front, not on rejection. */}
          <LearningHint
            as="block"
            category="Sales Coach · Corpus"
            title="Character count"
            whatItIs="A live count of how much you've written against the 100,000-character limit, shown up front rather than sprung on you when you save."
            why="A save that fails at the limit after you've written thousands of words is a bad surprise. Showing the cap the whole time means you never hit a wall you couldn't see coming."
            how="Keep an eye on it as you write. It turns amber when you cross the limit — trim before saving if it does."
            principle="Tell the user the constraint up front, not at the moment of rejection.">
            <p
              className={`text-[10px] text-right ${
                text.length > 100000 ? "text-brand" : "text-muted"
              }`}
            >
              {text.length.toLocaleString()} / 100,000 characters
            </p>
          </LearningHint>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">
              {data?.effectiveSource === "custom"
                ? "Saving appends a new version (history is kept). Shapes the post-call review, not live cues."
                : "Saving your own corpus overrides the built-in. Shapes the post-call review, not live cues."}
            </p>
            <LoadingButton
              pending={saving}
              onClick={() => void save()}
              disabled={!text.trim() || !dirty || text.length > 100000}
              icon={<Save className="w-3.5 h-3.5" aria-hidden />}
              pendingLabel="Saving…"
              className="inline-flex items-center gap-1.5 shrink-0 bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              Save methodology
            </LoadingButton>
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
 * the team sells; this is the coach's product source for Prep Time +
 * product-aware coaching (wired in build 2). Append-only versions
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
        "The coach uses these now — in pre-call prep, live cues, and the post-call review. History is kept."
      );
      await load();
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
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
            coach grounds itself in this everywhere: pre-call prep, live in-call
            cues, and the post-call review — so it critiques against what
            you&apos;re actually selling, never an invented product.
          </p>
          {data?.isSet && data.updatedAt && (
            <p className="text-[11px] text-muted">
              Last saved {new Date(data.updatedAt).toLocaleString()}
              {data.updatedByName ? ` by ${data.updatedByName}` : ""}.
            </p>
          )}

          {/* Upload → fill the product draft for review, then Save (founder 2026-07-30). */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-muted">
              Have a product sheet or brand doc? Upload it to fill the editor, then review.
            </p>
            <DocUploadButton onExtracted={setText} targetLabel="the product details" />
          </div>

          <LearningHint
            as="block"
            category="Sales Coach · Product"
            title="Product & brand details"
            whatItIs="A free-text field for what your team sells — the offer, pricing, key benefits, and common objections — everything a rep should have at their fingertips."
            why="Out of the box the coach doesn't know your product; it can only coach delivery. This is what lets it prep a rep on what they're actually selling and answer 'what am I selling?' accurately — grounded in this text, never invented (§3.4)."
            how="Write it like a briefing: what it is, who it's for, pricing, the strongest benefits, and the objections you hear most. Saving appends a new version — history is kept."
            principle="A coach that doesn't know the product can only coach the delivery, not the substance."
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              placeholder="Describe the product/offer: what it is, who it's for, pricing, the strongest benefits, and the objections you hear most. The coach uses this to prep the rep on what they're selling."
              className="w-full bg-surface border border-default rounded-lg px-3 py-2.5 text-xs text-primary placeholder:text-muted font-mono leading-relaxed focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-y"
            />
          </LearningHint>

          <p
            className={`text-[10px] text-right ${
              text.length > 100000 ? "text-brand" : "text-muted"
            }`}
          >
            {text.length.toLocaleString()} / 100,000 characters
          </p>

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">
              Saving appends a new version (history is kept).
            </p>
            <LearningHint
              as="inline-block"
              category="Sales Coach · Product"
              title="Save product details"
              whatItIs="Saves your product/brand text as a new versioned entry the coach reads."
              why="Product knowledge is append-only here — each save is a new version, so an earlier description is never lost. Disabled until there's a change under the 100k cap."
              how="Edit the text, then save. The coach picks up the latest version for prep and product questions."
              principle="Keep the product truth current; the coach is only as accurate as what you last saved."
            >
              <LoadingButton
                pending={saving}
                onClick={() => void save()}
                disabled={!text.trim() || !dirty || text.length > 100000}
                icon={<Save className="w-3.5 h-3.5" aria-hidden />}
                pendingLabel="Saving…"
                className="inline-flex items-center gap-1.5 shrink-0 bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                Save details
              </LoadingButton>
            </LearningHint>
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
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
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
          <LearningHint
            as="block"
            category="Sales Coach · Voice"
            title="Cue voice"
            whatItIs="The voice the live coach speaks cues in, to the rep's earpiece. Pick 'Follow C.A.R.E voice' (the default — same voice as your C.A.R.E assistant) or any specific voice, and Preview it before saving."
            why="The cue voice is in the rep's ear during a live call — it should sound calm and clear, not jarring. It's decoupled from C.A.R.E/Jeff so Sales Coach can have its own presence."
            how="Select a voice, hit Preview to hear a sample cue, then Save. 'Follow C.A.R.E' keeps it in sync with your support assistant automatically."
            principle="A cue only helps if the rep can absorb it mid-conversation — the voice matters."
          >
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
                  <LoadingButton
                    pending={previewing === previewKey}
                    onClick={() => void preview(opt.id)}
                    disabled={previewing !== null}
                    icon={<Volume2 className="w-3 h-3" aria-hidden />}
                    spinnerClassName="w-3 h-3"
                    className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-primary border border-default rounded-md px-2 py-1 shrink-0 disabled:opacity-50"
                  >
                    Preview
                  </LoadingButton>
                </div>
              );
            })}
          </div>
          </LearningHint>
          <div className="flex justify-end">
            <LearningHint
              as="inline-block"
              category="Sales Coach · Voice"
              title="Save voice"
              whatItIs="Saves your selected cue voice for the live coach."
              why="The selection only takes effect once saved; the picker reflects the actually-saved voice, not a preview. Disabled until you change the selection."
              how="Pick + preview, then save. The live coach uses it on the next session's cues."
              principle="What's saved is what the rep hears — preview is not commitment."
            >
              <LoadingButton
                pending={saving}
                onClick={() => void save()}
                disabled={!dirty}
                icon={<Save className="w-3.5 h-3.5" aria-hidden />}
                pendingLabel="Saving…"
                className="inline-flex items-center gap-1.5 bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
              >
                Save voice
              </LoadingButton>
            </LearningHint>
          </div>
        </>
      )}
    </section>
  );
}

type VoiceHealthResult = {
  ok: boolean;
  summary: string;
  checks: { name: string; ok: boolean; detail: string }[];
};

/**
 * VoiceHealthCard — a manager-only, read-only diagnostic that runs the ElevenLabs voice probe and shows the
 * EXACT cause when captures keep failing (missing/expired key · missing Speech-to-Text scope · exhausted quota
 * · network). Live coaching AND recording transcription both auth against ElevenLabs STT, so this pins the one
 * provider problem that breaks both — surfacing the probe that previously existed only as an API endpoint
 * (founder priority 2026-08-12: the frequency of the "sessions failing to record" incident is an STT-scope/key
 * issue; this makes it self-diagnosable instead of guessed).
 */
function VoiceHealthCard() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VoiceHealthResult | null>(null);
  const [failed, setFailed] = useState(false);

  const check = async () => {
    setLoading(true);
    setFailed(false);
    setResult(null);
    try {
      const res = await fetch("/api/coach/sales-session/voice-health");
      // 200 with ok:false is intentional — the probe SUCCEEDED at diagnosing; the provider is what's down.
      if (res.ok) setResult((await res.json()) as VoiceHealthResult);
      else setFailed(true);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-primary">Voice provider health</h3>
        <p className="text-[11px] text-muted leading-relaxed mt-1">
          Live coaching and recording transcription both use ElevenLabs Speech-to-Text. If sessions keep
          failing to capture the conversation, run this to see the exact cause — a missing or expired key, a
          missing Speech-to-Text scope, or exhausted quota — instead of guessing. Read-only; it never
          transcribes or spends characters.
        </p>
      </div>
      <LoadingButton
        pending={loading}
        onClick={() => void check()}
        className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-primary border border-white/15 hover:border-white/30 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
      >
        Check voice provider
      </LoadingButton>
      {failed && (
        <p className="text-[11px] text-amber-300">
          Couldn&apos;t run the check right now — try again in a moment.
        </p>
      )}
      {result && (
        <div
          className={`rounded-xl border p-3 ${
            result.ok
              ? "border-emerald-500/30 bg-emerald-500/[0.06]"
              : "border-amber-400/40 bg-amber-400/[0.08]"
          }`}
        >
          <p
            className={`text-xs font-semibold ${
              result.ok ? "text-emerald-300" : "text-amber-300"
            }`}
          >
            {result.ok ? "✓ Voice provider healthy" : "✗ Voice provider issue found"}
          </p>
          {result.summary && (
            <p className="text-[11px] text-secondary mt-0.5 leading-relaxed">{result.summary}</p>
          )}
          <ul className="mt-2 space-y-1">
            {result.checks.map((c) => (
              <li key={c.name} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                <span className={`shrink-0 ${c.ok ? "text-emerald-300" : "text-amber-300"}`}>
                  {c.ok ? "✓" : "✗"}
                </span>
                <span className="text-muted">
                  <span className="text-secondary">{c.name}</span> — {c.detail}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
