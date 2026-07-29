"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save, MessageCircleHeart } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { DocUploadButton } from "@/components/sales-coach/DocUploadButton";

const MAX_CHARS = 8000;

/**
 * Jeff customer-assistance GUIDANCE editor (founder 2026-07-30).
 *
 * The company's OWN rules for HOW Jeff should assist their customers — the methodology-equivalent for
 * support (escalation, do's/don'ts, brand posture), distinct from the product context (WHAT you sell) and
 * the Adaptive Knowledge (FACTS). It is injected into Jeff's system prompt for every reply, within his
 * core identity + honesty rules. Fillable by typing or by uploading a document (PDF/Word/etc.).
 *
 * Loads/saves via /api/care/agent/tenant (admin-gated). Degrades honestly if migration 0202 is pending.
 */
export function JeffGuidancePanel() {
  const toast = useToast();
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/care/agent/tenant");
      if (res.ok) {
        const d = await res.json();
        const g = String(d?.config?.ai_assistance_guidance ?? "");
        setText(g);
        setSaved(g);
      }
    } catch {
      /* offline — the editor still works, save will surface the error */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = text.trim() !== saved.trim();

  const save = async () => {
    if (saving || !dirty || text.length > MAX_CHARS) return;
    setSaving(true);
    try {
      const res = await fetch("/api/care/agent/tenant", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aiAssistanceGuidance: text.trim() || null }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error ?? "Save failed.");
      if (d?.assistanceGuidanceDeferred) {
        toast.error(
          "Saved everything else — guidance needs a migration",
          "The customer-assistance guidance field isn't available yet (migration 0202 pending)."
        );
      } else {
        setSaved(text);
        toast.success("Guidance saved", "Jeff now follows it on every reply.");
      }
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <MessageCircleHeart className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">Customer-assistance guidance</h2>
      </div>
      <p className="text-xs text-secondary leading-relaxed">
        How you want Jeff to handle your customers — your approach, escalation rules, do&apos;s and
        don&apos;ts, and brand posture. This shapes <em>how</em> Jeff assists (distinct from the facts he
        answers from). Jeff follows it within his core honesty rules — he never pretends to be human or
        invents facts.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-[11px] text-muted">
              Have it in a document? Upload a file to fill this, then review.
            </p>
            <DocUploadButton
              onExtracted={setText}
              targetLabel="Jeff's guidance"
              endpoint="/api/care/agent/acms/extract"
              maxChars={MAX_CHARS}
            />
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="e.g. Always acknowledge the customer's frustration first. Offer a refund within 30 days without escalating. If they ask about enterprise pricing, hand off to a human. Keep a warm, concise tone."
            className="w-full bg-surface border border-default rounded-lg px-3 py-2.5 text-xs text-primary placeholder:text-muted font-mono leading-relaxed focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-y"
          />

          <div className="flex items-center justify-between gap-3">
            <p className={`text-[10px] ${text.length > MAX_CHARS ? "text-brand" : "text-muted"}`}>
              {text.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} characters
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={!dirty || saving || text.length > MAX_CHARS}
              className="inline-flex items-center gap-1.5 bg-gradient-to-br from-ember-300 via-ember-400 to-ember-500 hover:shadow-[0_0_26px_-6px_rgba(250,204,21,0.65)] disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Save className="w-3.5 h-3.5" aria-hidden />}
              Save guidance
            </button>
          </div>
        </>
      )}
    </section>
  );
}
