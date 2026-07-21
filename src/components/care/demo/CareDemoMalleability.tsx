"use client";

/**
 * C.A.R.E malleability demo — the "it adapts to your business" piece (ask 2).
 *
 * One interactive control (Business type: General ⇄ E-commerce) that
 * visibly reshapes the handoff capture card — the concern topics change
 * and the order-number field appears/disappears. Then a grid of the REAL
 * per-tenant knobs (from care_tenant_config / the tenant PATCH route):
 * AI name & tone, greeting, widget colour & position, white-label
 * branding, product grounding, origin allowlist, business type.
 *
 * The point a prospect should leave with: this isn't a fixed widget you
 * live with — it's configured to your business, and the SAME AI brain
 * grades, drafts, and learns behind it.
 */

import { useState } from "react";
import {
  Store,
  Building2,
  Bot,
  Palette,
  MessageSquareText,
  BadgeCheck,
  Globe,
  BookOpen,
  Sliders,
} from "lucide-react";

type BizType = "general" | "ecommerce";

const TOPICS: Record<BizType, string[]> = {
  general: [
    "Technical issue",
    "Outage / can't access",
    "Account & login",
    "Billing question",
    "How do I…",
    "Something's broken",
    "Other (describe it)",
  ],
  ecommerce: [
    "Order tracking",
    "Return or refund",
    "Cancel an order",
    "Wrong / damaged / missing item",
    "Product question",
    "Shipping & delivery",
    "Billing question",
    "Other (describe it)",
  ],
};

const KNOBS: { icon: typeof Bot; label: string; detail: string }[] = [
  { icon: Bot, label: "AI name & personality", detail: "Rename Jeff, set tone (warm / formal / casual / direct) and reply length." },
  { icon: BookOpen, label: "Product grounding", detail: "Paste what the AI should know about your business, so answers are yours — not generic." },
  { icon: Palette, label: "Widget colour & position", detail: "Match your brand accent; dock it bottom-left or bottom-right." },
  { icon: MessageSquareText, label: "Greeting & subtitle", detail: "First line the customer reads, and the reply-time promise beneath it." },
  { icon: BadgeCheck, label: "White-label branding", detail: "Your display name, reply signature, and logo — customers never see ours." },
  { icon: Globe, label: "Origin allowlist", detail: "Embed the widget only on domains you approve. Session-token traffic, keys off the client." },
];

export function CareDemoMalleability() {
  const [biz, setBiz] = useState<BizType>("ecommerce");
  const isEcom = biz === "ecommerce";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Left — interactive reshape */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Sliders className="w-4 h-4 text-brand" aria-hidden />
          <p className="text-[10px] uppercase tracking-widest text-muted">One setting, whole flow adapts</p>
        </div>
        <h3 className="text-lg font-bold text-primary mb-3">Business type</h3>

        {/* Toggle */}
        <div
          className="inline-flex rounded-lg border border-default p-0.5 bg-ink-900/60 mb-4"
          role="group"
          aria-label="Business type"
        >
          <button
            type="button"
            onClick={() => setBiz("general")}
            aria-pressed={!isEcom}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              !isEcom ? "bg-ember-400 text-[#09090B]" : "text-secondary hover:text-primary"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" aria-hidden /> General
          </button>
          <button
            type="button"
            onClick={() => setBiz("ecommerce")}
            aria-pressed={isEcom}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md transition-colors ${
              isEcom ? "bg-ember-400 text-[#09090B]" : "text-secondary hover:text-primary"
            }`}
          >
            <Store className="w-3.5 h-3.5" aria-hidden /> E-commerce
          </button>
        </div>

        {/* Reshaped capture card preview — a fixed-dark "product screen"
            (fixed colors, not theme tokens, so it never goes dark-on-dark
            in light mode). */}
        <div className="rounded-xl border border-ember-400/25 bg-ink-950 p-3">
          <p className="text-[11px] font-semibold text-zinc-100 mb-2">Handoff capture — what the customer sees</p>
          <div className="space-y-1">
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">What&apos;s this about?</p>
            <div className="flex flex-wrap gap-1.5">
              {TOPICS[biz].map((t) => (
                <span
                  key={t}
                  className="text-[10px] px-2 py-1 rounded-md border border-ink-700 bg-ink-900 text-zinc-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div
            className={`mt-3 transition-all ${
              isEcom ? "opacity-100" : "opacity-40"
            }`}
          >
            <p className="text-[9px] uppercase tracking-wider text-zinc-500">Order number</p>
            <div className="text-[11px] text-zinc-100 bg-ink-950 border border-ink-700 rounded px-2 py-1 mt-0.5 flex items-center justify-between">
              <span>{isEcom ? "10432" : "— hidden for general support —"}</span>
              {isEcom && (
                <span className="text-[9px] text-brand font-semibold">shown for order concerns</span>
              )}
            </div>
          </div>
        </div>
        <p className="text-[11px] text-secondary leading-relaxed mt-3">
          {isEcom
            ? "In e-commerce mode the topics are order-shaped and an order-number field appears on the concerns that need it — so the agent lands on the right order instantly."
            : "In general mode the topics are support-shaped and the order field disappears entirely. Same card, different business."}
        </p>
      </div>

      {/* Right — the knobs */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <Palette className="w-4 h-4 text-brand" aria-hidden />
          <p className="text-[10px] uppercase tracking-widest text-muted">Configured to you, not us</p>
        </div>
        <h3 className="text-lg font-bold text-primary mb-4">What you tune per company</h3>
        <div className="space-y-2.5">
          {KNOBS.map((k) => {
            const Icon = k.icon;
            return (
              <div key={k.label} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-ember-400/10 border border-ember-400/30 flex items-center justify-center shrink-0">
                  <Icon className="w-3.5 h-3.5 text-brand" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-primary">{k.label}</p>
                  <p className="text-[11px] text-secondary leading-relaxed">{k.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-muted italic leading-relaxed mt-4 pt-3 border-t border-default">
          Embed it white-labelled on your own site, or run it inside ELOSTATE — the same AI brain grades,
          drafts, and learns behind every configuration.
        </p>
      </div>
    </div>
  );
}
