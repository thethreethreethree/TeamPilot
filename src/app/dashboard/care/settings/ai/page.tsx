"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { SettingsTabs } from "@/components/care/SettingsTabs";
import { AdaptiveKnowledgePanel } from "@/components/care/AdaptiveKnowledgePanel";
import { JeffGuidancePanel } from "@/components/care/JeffGuidancePanel";
import { DocUploadButton } from "@/components/sales-coach/DocUploadButton";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * /dashboard/care/settings/ai — the "AI & Personality" tab.
 *
 * This is where a company makes the AI *theirs*: its persona (name + tone + length), what it knows about
 * the product it represents, how it should assist customers (guidance), and the facts it answers from
 * (adaptive knowledge). It was previously buried at the bottom of the Widget tab, which is why it read as
 * "missing" — the Widget tab is described as embed/appearance, so nobody looked there for AI config. This
 * tab surfaces it directly (mirrors Sales Coach's dedicated "Coaching" tab).
 *
 * Scoped save: this page PATCHes ONLY the AI-persona fields (aiName / aiProductContext / aiTone /
 * aiResponseLength). The Widget tab owns appearance/branding/channels and PATCHes only its own fields.
 * Both hit /api/care/agent/tenant with a partial patch, so the two Saves never clobber each other.
 * The guidance + knowledge panels are self-contained (their own endpoints), unchanged by this page's Save.
 */

type AiDraft = {
  ai_name: string;
  ai_product_context: string | null;
  ai_tone: "warm" | "formal" | "casual" | "direct";
  ai_response_length: "short" | "medium" | "long";
};

export default function CareAiSettingsPage() {
  const toast = useToast();
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [saved, setSaved] = useState<AiDraft | null>(null);
  const [productContextManagedInCode, setProductContextManagedInCode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/care/agent/tenant");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error ?? `Couldn't load your AI settings (HTTP ${res.status}).`);
        return;
      }
      const data = await res.json();
      const c = data.config ?? {};
      const next: AiDraft = {
        ai_name: c.ai_name ?? "Jeff",
        ai_product_context: c.ai_product_context ?? null,
        ai_tone: (c.ai_tone as AiDraft["ai_tone"]) ?? "warm",
        ai_response_length: (c.ai_response_length as AiDraft["ai_response_length"]) ?? "medium",
      };
      setDraft(next);
      setSaved(next);
      setProductContextManagedInCode(!!data.productContextManagedInCode);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    !!draft &&
    !!saved &&
    (draft.ai_name.trim() !== saved.ai_name.trim() ||
      (draft.ai_product_context ?? "") !== (saved.ai_product_context ?? "") ||
      draft.ai_tone !== saved.ai_tone ||
      draft.ai_response_length !== saved.ai_response_length);

  const save = async () => {
    if (!draft || saving || !dirty) return;
    setSaving(true);
    try {
      const res = await fetch("/api/care/agent/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiName: draft.ai_name,
          aiProductContext: draft.ai_product_context,
          aiTone: draft.ai_tone,
          aiResponseLength: draft.ai_response_length,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const c = data.config ?? {};
        const next: AiDraft = {
          ai_name: c.ai_name ?? draft.ai_name,
          ai_product_context: c.ai_product_context ?? null,
          ai_tone: (c.ai_tone as AiDraft["ai_tone"]) ?? draft.ai_tone,
          ai_response_length:
            (c.ai_response_length as AiDraft["ai_response_length"]) ?? draft.ai_response_length,
        };
        setDraft(next);
        setSaved(next);
        toast.success("Saved", "AI personality updated.");
      } else {
        toast.error("Couldn't save.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">AI &amp; Personality</p>
      </header>
      <SettingsTabs />

      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-16 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
          </div>
        ) : !draft ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-xs text-red-700 dark:text-red-300 max-w-sm">
              {error ?? "Couldn't load your AI settings."}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="text-xs font-semibold text-brand border border-ember-400/40 hover:border-ember-400/70 bg-ember-400/5 hover:bg-ember-400/10 px-3 py-1.5 rounded-md"
            >
              Try again
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand" aria-hidden />
              <p className="text-xs text-secondary leading-relaxed">
                This is where you make the AI <b className="text-primary">yours</b> — its persona, what it
                knows about your product, how you want it to assist, and the facts it answers from.
              </p>
            </div>

            {/* Persona: name, product context, tone, length — moved here from the Widget tab. */}
            <Section
              title="AI personality"
              subtitle="How the AI represents your product and speaks to customers."
            >
              <div className="space-y-3">
                <LearningHint
                  as="block"
                  category="C.A.R.E · Settings"
                  title="Agent name"
                  whatItIs="The name the AI introduces itself as and signs its messages with — its persona on your widget."
                  why="A named responder feels like a someone, not a bot, which changes how customers engage. It appears in the greeting and every AI message, so it's part of your brand voice. Line breaks and control characters are stripped so what you type is what customers see."
                  how="Enter 1–50 characters, no line breaks. Pick a name that fits your brand's tone."
                  principle="A name turns a bot into a first responder customers will actually talk to."
                >
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                      Agent name
                    </label>
                    <input
                      type="text"
                      value={draft.ai_name}
                      onChange={(e) =>
                        // Strip control + Unicode line/paragraph separators client-side, mirroring the
                        // server's \p{C}\p{Zl}\p{Zp} transform + the DB CHECK (0066) — WYSIWYG.
                        setDraft({
                          ...draft,
                          ai_name: e.target.value.replace(/[\p{C}\p{Zl}\p{Zp}]/gu, "").slice(0, 50),
                        })
                      }
                      maxLength={50}
                      placeholder="Jeff"
                      className="w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong"
                    />
                    <p className="text-[11px] text-muted mt-1">
                      What your AI introduces itself as. Shows up in the widget greeting and in every message
                      the AI sends. 1–50 characters; no line breaks.
                    </p>
                  </div>
                </LearningHint>

                <LearningHint
                  as="block"
                  category="C.A.R.E · Settings"
                  title="Product context"
                  whatItIs="A briefing the AI reads before answering — what your product is, its features by name, pricing/access, and what to hand off to a human."
                  why="This is the single biggest lever on whether the AI helps or hurts. When it's uncertain about a feature it defaults to 'no' — telling a customer you can't do something you can, and losing them. Naming features here makes 'yes, we have that' its safe default, and anything you don't name gets handed to a human by design rather than guessed at."
                  how="List features by the names customers use, state pricing/access plainly, and be explicit about what the AI must hand off (billing, refunds, account data). Be thorough — the AI only knows what's written here."
                  principle="An AI that doesn't know your product will confidently misdescribe it — name what's real so it never has to guess."
                >
                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                      Product context
                    </label>
                    {productContextManagedInCode && (
                      <div className="mb-2 rounded-md border border-default bg-base px-3 py-2 text-[11px] text-secondary leading-relaxed">
                        <strong className="text-primary">Managed in code for this account.</strong> This
                        account&apos;s product knowledge is maintained in the codebase and kept current with
                        every feature, so it&apos;s always authoritative. Edits to this field have no effect
                        here — it&apos;s shown for reference only.
                      </div>
                    )}
                    {!productContextManagedInCode && (
                      <div className="flex items-center justify-end mb-1.5">
                        <DocUploadButton
                          onExtracted={(t) => setDraft({ ...draft, ai_product_context: t || null })}
                          targetLabel="the product context"
                          endpoint="/api/care/agent/acms/extract"
                          maxChars={8000}
                        />
                      </div>
                    )}
                    <textarea
                      value={draft.ai_product_context ?? ""}
                      onChange={(e) =>
                        setDraft({ ...draft, ai_product_context: e.target.value || null })
                      }
                      disabled={productContextManagedInCode}
                      rows={10}
                      placeholder={`What your product actually is:
[one sentence — the product in plain terms]

Features the AI should know about (use these names when customers ask):
- [Feature 1] — [one sentence: what it does, when to mention it]
- [Feature 2] — [...]

Pricing & access:
[how customers can buy / what tier they get / what to hand off]

Always hand off to a human for:
[account-specific data, billing, refunds, anything you don't want the AI deciding]`}
                      className={`w-full bg-base border border-default rounded-md px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-y leading-relaxed font-mono${
                        productContextManagedInCode ? " opacity-60 cursor-not-allowed" : ""
                      }`}
                    />
                    <div className="text-[11px] text-muted mt-1.5 space-y-1">
                      <p>
                        <strong className="text-secondary">Why this matters:</strong> When the AI is
                        uncertain about a feature, it defaults to &quot;no&quot; — telling the customer your
                        product can&apos;t do something it actually does. Listing features by name here makes
                        &quot;yes, we have that&quot; the AI&apos;s safe default for things you actually offer.
                      </p>
                      <p>
                        Anything you don&apos;t name here, the AI hands off to a human rather than guess —
                        that&apos;s the design.
                      </p>
                    </div>
                  </div>
                </LearningHint>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <LearningHint
                    as="block"
                    category="C.A.R.E · Settings"
                    title="Tone"
                    whatItIs="The register the AI writes in — warm, formal, casual, or direct."
                    why="Tone is how the AI's answers feel, and it should match your brand. A luxury service reads formal; a dev tool reads direct. A mismatch makes even correct answers feel off-brand."
                    how="Pick the register closest to how your team already talks to customers. Save to apply it to every AI reply."
                    principle="Correct and off-brand still feels wrong — match the voice to your brand."
                  >
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                        Tone
                      </label>
                      <select
                        value={draft.ai_tone}
                        onChange={(e) =>
                          setDraft({ ...draft, ai_tone: e.target.value as AiDraft["ai_tone"] })
                        }
                        className="w-full bg-base border border-default rounded-md px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
                      >
                        <option value="warm">Warm</option>
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                        <option value="direct">Direct</option>
                      </select>
                    </div>
                  </LearningHint>
                  <LearningHint
                    as="block"
                    category="C.A.R.E · Settings"
                    title="Response length"
                    whatItIs="How long the AI's answers run — short (1–2 sentences), medium, or long (up to ~6)."
                    why="Length is a trade-off between speed and completeness. Short suits simple, high-volume questions; long suits products where a thin answer just creates a follow-up. Set it to how much your customers actually need."
                    how="Choose based on your typical question. If customers keep replying 'and…?', go longer; if they skim, go shorter."
                    principle="Answer at the length the question deserves — not every reply needs to be a paragraph."
                  >
                    <div>
                      <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                        Response length
                      </label>
                      <select
                        value={draft.ai_response_length}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            ai_response_length: e.target.value as AiDraft["ai_response_length"],
                          })
                        }
                        className="w-full bg-base border border-default rounded-md px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
                      >
                        <option value="short">Short (1-2 sentences)</option>
                        <option value="medium">Medium (1-4 sentences)</option>
                        <option value="long">Long (up to ~6 sentences)</option>
                      </select>
                    </div>
                  </LearningHint>
                </div>
              </div>
            </Section>

            {/* Save — persona fields only. */}
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => void save()}
                disabled={!dirty || saving}
                className="inline-flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
                {saving ? "Saving…" : "Save personality"}
              </button>
            </div>

            {/* Self-contained panels (own endpoints + own Save). */}
            <JeffGuidancePanel />
            <AdaptiveKnowledgePanel />
          </>
        )}
      </div>
    </>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white/[0.02] border border-default rounded-xl p-5">
      <h2 className="text-sm font-semibold text-primary mb-1">{title}</h2>
      {subtitle && <p className="text-[11px] text-muted mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}
