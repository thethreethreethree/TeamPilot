"use client";

import { useEffect, useRef, useState } from "react";
import TopBar from "@/components/layout/TopBar";
import {
  DeckCard,
  DeckButton,
  DeckGhostButton,
  SectionLabel,
} from "@/components/sales-coach/ui/deck";
import { LearningHint } from "@/components/learning/LearningHint";
import {
  Target,
  Video,
  DoorOpen,
  Send,
  Loader2,
  CheckCircle2,
  Quote,
  RotateCcw,
  Sparkles,
  ArrowRight,
} from "lucide-react";

/**
 * Sales Coach → Roleplay Practice (founder 2026-07-05; text-first per the
 * 2026-07-06 decision). Setup → chat (AI plays the prospect) → review.
 * Ephemeral by design — practice, not a recorded call (see the API route).
 */

type Msg = { role: "rep" | "prospect"; text: string };
type Review = {
  summary: string;
  whatWorked: string[];
  toImprove: string[];
  correctLine: { line: string; why: string } | null;
};
type Phase = "setup" | "chat" | "review";

const PERSONAS: { label: string; hint: string }[] = [
  { label: "Skeptical & guarded", hint: "Slow to trust, needs convincing" },
  { label: "Busy & rushed", hint: "Little time, wants it fast" },
  { label: "Price-focused", hint: "Objects on cost and value" },
  { label: "Friendly but non-committal", hint: "Pleasant, won't commit" },
];

const STORAGE_KEY = "sc-roleplay-inprogress";

export default function SalesCoachRoleplayPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [context, setContext] = useState<"in_person" | "video">("in_person");
  const [persona, setPersona] = useState<string>(
    PERSONAS[0]?.label ?? "Skeptical & guarded"
  );
  const [custom, setCustom] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  // In-progress recovery (audit F2, AMD-006 L3): keep the live conversation in
  // sessionStorage so an accidental bottom-tab tap or a reload doesn't destroy
  // the practice. This is transient session recovery, NOT a stored history —
  // it's cleared when the roleplay ends or restarts, so it stays consistent
  // with the deliberate "ephemeral, not persisted" design.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as {
        context?: "in_person" | "video";
        persona?: string;
        custom?: string;
        messages?: Msg[];
      };
      if (Array.isArray(s.messages) && s.messages.length > 0) {
        if (s.context) setContext(s.context);
        if (s.persona) setPersona(s.persona);
        if (typeof s.custom === "string") setCustom(s.custom);
        setMessages(s.messages);
        setPhase("chat");
      }
    } catch {
      /* ignore — recovery is best-effort */
    }
  }, []);

  useEffect(() => {
    try {
      if (phase === "chat" && messages.length > 0) {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ context, persona, custom, messages })
        );
      }
    } catch {
      /* ignore */
    }
  }, [phase, messages, context, persona, custom]);

  const start = () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setMessages([]);
    setReview(null);
    setError(null);
    setInput("");
    setPhase("chat");
  };

  const post = async (phaseArg: "turn" | "review", msgs: Msg[]) => {
    const res = await fetch("/api/coach/sales-session/roleplay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase: phaseArg,
        context,
        persona,
        customPrompt: custom.trim() || undefined,
        messages: msgs,
      }),
    });
    if (!res.ok) {
      const b = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(b?.error ?? `Couldn't reach the coach (HTTP ${res.status})`);
    }
    return res.json();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    const next: Msg[] = [...messages, { role: "rep", text }];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);
    try {
      const { reply } = await post("turn", next);
      setMessages((m) => [...m, { role: "prospect", text: reply as string }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      // Roll back the optimistic rep turn — a failed send must not strand an
      // unanswered message in the thread (which would also push two rep turns
      // in a row to the prospect on the next attempt). Restore the text to the
      // input so retry is one tap, clean. (L2 error-path robustness.)
      setMessages((m) => m.slice(0, -1));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const endReview = async () => {
    if (reviewing) return;
    setReviewing(true);
    setError(null);
    try {
      const { review: rev } = await post("review", messages);
      setReview(rev as Review);
      setPhase("review");
      // Roleplay is done — drop the in-progress recovery copy.
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setReviewing(false);
    }
  };

  const canReview = messages.filter((m) => m.role === "rep").length >= 1;

  return (
    <>
      <TopBar title="Roleplay Practice" subtitle="Simulated pitches" />
      <div className="flex-1 min-h-0 flex flex-col bg-base">
        {/* ── Setup ───────────────────────────────────────────────── */}
        {phase === "setup" && (
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-2xl mx-auto w-full space-y-4">
            <DeckCard className="p-4 flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl border border-ember-400/40 bg-white/[0.02] flex items-center justify-center shrink-0">
                <Target className="w-5 h-5 text-brand" strokeWidth={1.5} aria-hidden />
              </div>
              <p className="text-xs text-secondary leading-relaxed">
                Practice a pitch against an AI prospect — pick who you&apos;re
                selling to, run the conversation, then get a quick review. It&apos;s
                practice, so nothing here counts against your real sessions.
              </p>
            </DeckCard>

            <LearningHint
              as="block"
              category="Sales Coach · Roleplay"
              title="Channel"
              whatItIs="Whether you're practicing an in-person doorstep conversation or a remote video call."
              why="The two are pitched differently — the prospect reacts to doorstep timing in person, and to pacing and framing on video. Practice the one you're about to do for real."
              how="Pick the channel, then choose who you're up against."
              principle="Practice the channel you're actually in."
            >
              <div>
                <SectionLabel icon={Target}>Channel</SectionLabel>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <DeckGhostButton
                    active={context === "in_person"}
                    onClick={() => setContext("in_person")}
                  >
                    <DoorOpen className="w-3.5 h-3.5" aria-hidden />
                    In-person
                  </DeckGhostButton>
                  <DeckGhostButton
                    active={context === "video"}
                    onClick={() => setContext("video")}
                  >
                    <Video className="w-3.5 h-3.5" aria-hidden />
                    Video
                  </DeckGhostButton>
                </div>
              </div>
            </LearningHint>

            <LearningHint
              as="block"
              category="Sales Coach · Roleplay"
              title="Who you're pitching"
              whatItIs="The prospect persona the AI will play — each reacts and objects differently."
              why="Reps get comfortable pitching the easy prospect and freeze on the hard one. Choosing the persona lets you drill the exact kind of buyer you struggle with, safely, before it's a real door."
              how="Pick a persona, or add your own description below for a specific situation."
              principle="Rehearse the hard room, not the easy one."
            >
              <div>
                <SectionLabel icon={Target}>Who you&apos;re pitching</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                  {PERSONAS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPersona(p.label)}
                      className={`text-left rounded-xl border px-3 py-2.5 transition-colors ${
                        persona === p.label
                          ? "border-ember-400/60 bg-ember-400/10"
                          : "border-white/10 bg-black/20 hover:border-white/20"
                      }`}
                    >
                      <span className="block text-sm text-primary font-medium">
                        {p.label}
                      </span>
                      <span className="block text-[11px] text-muted mt-0.5">
                        {p.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  aria-label="Describe the situation (optional)"
                  placeholder="Optional: describe the situation (e.g. 'renewing homeowner, burned by last vendor')"
                  className="w-full text-xs bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 mt-2.5"
                />
              </div>
            </LearningHint>

            <DeckButton
              onClick={start}
              icon={<ArrowRight className="w-4 h-4" aria-hidden />}
              className="w-full"
            >
              Start roleplay
            </DeckButton>
          </div>
        )}

        {/* ── Chat ────────────────────────────────────────────────── */}
        {phase === "chat" && (
          <>
            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-y-auto px-4 md:px-8 py-4 max-w-2xl mx-auto w-full space-y-3"
            >
              <p className="text-[11px] text-muted text-center">
                Playing: <span className="text-brand">{persona}</span> ·{" "}
                {context === "in_person" ? "In-person" : "Video"}
              </p>
              {messages.length === 0 && (
                <p className="text-xs text-muted text-center py-8 leading-relaxed">
                  Open your pitch — type your first line the way you&apos;d say
                  it at the door.
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === "rep" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      m.role === "rep"
                        ? "bg-ember-400 text-[#09090B] rounded-br-sm"
                        : "bg-white/[0.06] text-primary rounded-bl-sm"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-white/[0.06] text-muted rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                  </div>
                </div>
              )}
              {error && (
                <p className="text-[11px] text-amber-300 text-center">{error}</p>
              )}
            </div>

            <div className="flex-shrink-0 border-t border-white/[0.08] bg-[#0B1620] px-3 md:px-8 py-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))]">
              <div className="max-w-2xl mx-auto w-full flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void endReview()}
                  disabled={!canReview || reviewing || sending}
                  className="text-[11px] text-muted hover:text-brand disabled:opacity-40 shrink-0 whitespace-nowrap px-1"
                  title="End the roleplay and get a review"
                >
                  {reviewing ? "Reviewing…" : "End & review"}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send();
                    }
                  }}
                  aria-label="Your line to the prospect"
                  placeholder="Your line…"
                  disabled={sending || reviewing}
                  className="flex-1 min-w-0 text-sm bg-black/30 border border-white/10 rounded-xl px-3 py-2.5 text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
                />
                <button
                  type="button"
                  onClick={() => void send()}
                  disabled={!input.trim() || sending || reviewing}
                  aria-label="Send"
                  className="shrink-0 w-10 h-10 rounded-xl bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] flex items-center justify-center transition-colors"
                >
                  <Send className="w-4 h-4" aria-hidden />
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Review ──────────────────────────────────────────────── */}
        {phase === "review" && review && (
          <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-2xl mx-auto w-full space-y-4">
            <SectionLabel icon={Sparkles}>Practice review</SectionLabel>
            {/* F4 (A21): honestly mark this as the lighter practice review —
                a roleplay has no diarized/timed call, so it can't produce the
                real After Pitch timeline + scores. */}
            <p className="text-[11px] text-muted -mt-1.5">
              A quick practice read. Your real calls get the full timeline and
              score in the After Pitch Summary.
            </p>

            {review.summary ? (
              <DeckCard className="p-4">
                <p className="text-sm text-primary leading-relaxed">
                  {review.summary}
                </p>
              </DeckCard>
            ) : (
              <DeckCard className="p-4">
                <p className="text-xs text-muted leading-relaxed">
                  That was a short one — run a longer roleplay to get a fuller
                  read.
                </p>
              </DeckCard>
            )}

            {review.whatWorked.length > 0 && (
              <div className="space-y-2">
                <SectionLabel icon={CheckCircle2}>What worked</SectionLabel>
                <DeckCard className="divide-y divide-white/[0.06] overflow-hidden">
                  {review.whatWorked.map((w, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                      <CheckCircle2
                        className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <p className="text-xs text-secondary leading-relaxed">{w}</p>
                    </div>
                  ))}
                </DeckCard>
              </div>
            )}

            {review.toImprove.length > 0 && (
              <div className="space-y-2">
                <SectionLabel icon={Target}>To work on</SectionLabel>
                <DeckCard className="divide-y divide-white/[0.06] overflow-hidden">
                  {review.toImprove.map((t, i) => (
                    <div key={i} className="flex items-start gap-2.5 px-4 py-3">
                      <Target
                        className="w-4 h-4 text-amber-400 shrink-0 mt-0.5"
                        aria-hidden
                      />
                      <p className="text-xs text-secondary leading-relaxed">{t}</p>
                    </div>
                  ))}
                </DeckCard>
              </div>
            )}

            {review.correctLine && (
              <div className="space-y-2">
                <SectionLabel icon={Quote}>A stronger line</SectionLabel>
                <DeckCard className="p-4">
                  <p className="text-sm text-primary leading-relaxed font-medium">
                    &ldquo;{review.correctLine.line}&rdquo;
                  </p>
                  <p className="text-xs text-secondary leading-relaxed mt-1.5">
                    {review.correctLine.why}
                  </p>
                </DeckCard>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <DeckButton
                onClick={() => setPhase("setup")}
                icon={<RotateCcw className="w-4 h-4" aria-hidden />}
                className="flex-1"
              >
                Practice again
              </DeckButton>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
