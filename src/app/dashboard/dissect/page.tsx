"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Stethoscope,
  Loader2,
  Save,
  X,
  Send,
  Sparkles,
  Quote,
  Eye,
  Lightbulb,
  MessageCircleQuestion,
  Check,
  History,
} from "lucide-react";

/**
 * Dissect a Conversation (founder 2026-07-07).
 *
 * Paste any conversation → summarize → dissect the PROBLEM (Living Diagnosis
 * applied to a pasted conversation) → Ask Coach (§3.3 guide-don't-overtake).
 * Per-chat / ephemeral: nothing persists unless the user hits Save the topic.
 * Close discards an unsaved thread (never a DB delete — §3.1) and returns a
 * clean slate. A saved topic persists in the Saved list.
 */

type DissectEvidence = { observation: string; excerpt: string };
type DissectAngle = { angle: string; why: string };
type ConversationDissect = {
  hasSignal: boolean;
  summary: string;
  problem: { statement: string; whyItMatters: string };
  evidence: DissectEvidence[];
  rootCause: string;
  outsideView: string;
  anglesToConsider: DissectAngle[];
  guidingQuestion: string;
};

type CoachTurn = { role: "user" | "coach"; text: string };
type SavedItem = { id: string; title: string; createdAt: string };

export default function DissectPage() {
  const [sourceText, setSourceText] = useState("");
  const [dissect, setDissect] = useState<ConversationDissect | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeErr, setAnalyzeErr] = useState<string | null>(null);

  // Ask Coach thread (ephemeral).
  const [hypothesis, setHypothesis] = useState("");
  const [sharedHypothesis, setSharedHypothesis] = useState(false);
  const [question, setQuestion] = useState("");
  const [thread, setThread] = useState<CoachTurn[]>([]);
  const [asking, setAsking] = useState(false);

  // Save / list.
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [readonly, setReadonly] = useState(false); // viewing a loaded saved topic

  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const loadSavedList = useCallback(async () => {
    try {
      const res = await fetch("/api/dissect/topics");
      if (!res.ok) return;
      const d = await res.json();
      setSaved((d.topics ?? []) as SavedItem[]);
    } catch {
      /* non-fatal — the list just stays empty */
    }
  }, []);

  useEffect(() => {
    void loadSavedList();
  }, [loadSavedList]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [thread]);

  async function runDissect() {
    const content = sourceText.trim();
    if (content.length < 40) {
      setAnalyzeErr(
        "Paste a bit more of the conversation — there isn't enough here to diagnose honestly."
      );
      return;
    }
    setAnalyzing(true);
    setAnalyzeErr(null);
    setDissect(null);
    setThread([]);
    setSavedId(null);
    try {
      const res = await fetch("/api/dissect/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        setAnalyzeErr("Couldn't dissect that just now. Please try again.");
        return;
      }
      const d = await res.json();
      setDissect(d.dissect as ConversationDissect);
    } catch {
      setAnalyzeErr("Couldn't dissect that just now. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function askCoach(q: string) {
    const question = q.trim();
    if (!question || asking) return;
    // Capture the thread BEFORE appending this turn — it's the coach's memory of
    // the conversation so far (§3.3 dialogue needs it, or it loops on "what do
    // you think?"). Cap to the last 40 turns to bound payload.
    const priorThread = thread.slice(-40);
    setAsking(true);
    setThread((t) => [...t, { role: "user", text: question }]);
    setQuestion("");
    try {
      const res = await fetch("/api/dissect/ask-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: sourceText,
          question,
          userHypothesis: sharedHypothesis ? hypothesis.trim() : undefined,
          problemStatement: dissect?.problem?.statement ?? undefined,
          history: priorThread,
        }),
      });
      if (!res.ok) {
        setThread((t) => [
          ...t,
          { role: "coach", text: "I couldn't respond just now — try again in a moment." },
        ]);
        return;
      }
      const d = await res.json();
      setThread((t) => [...t, { role: "coach", text: d.reply as string }]);
    } catch {
      setThread((t) => [
        ...t,
        { role: "coach", text: "I couldn't respond just now — try again in a moment." },
      ]);
    } finally {
      setAsking(false);
    }
  }

  async function saveTopic() {
    if (saving || !dissect) return;
    const t = title.trim() || dissect.problem.statement.slice(0, 80) || "Untitled dissection";
    setSaving(true);
    try {
      const res = await fetch("/api/dissect/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: t,
          content: sourceText,
          summary: dissect.summary,
          dissect,
        }),
      });
      if (!res.ok) return; // stays unsaved; button remains actionable (§3.4)
      const d = await res.json();
      setSavedId(d.id as string);
      void loadSavedList();
    } catch {
      /* stays unsaved */
    } finally {
      setSaving(false);
    }
  }

  // Close the topic. An UNSAVED thread is discarded here (pure client state — no
  // server delete, §3.1). A saved topic persists in the list; Close just clears
  // the workspace so a fresh conversation can start.
  function closeTopic() {
    setSourceText("");
    setDissect(null);
    setThread([]);
    setHypothesis("");
    setSharedHypothesis(false);
    setQuestion("");
    setTitle("");
    setSavedId(null);
    setAnalyzeErr(null);
    setReadonly(false);
  }

  async function loadSaved(id: string) {
    try {
      const res = await fetch(`/api/dissect/topics/${id}`);
      if (!res.ok) return;
      const d = await res.json();
      const topic = d.topic as {
        sourceText: string;
        dissect: ConversationDissect | null;
      };
      setSourceText(topic.sourceText);
      setDissect(topic.dissect);
      setThread([]);
      setSavedId(id);
      setReadonly(true);
      setAnalyzeErr(null);
    } catch {
      /* non-fatal */
    }
  }

  const hasResult = !!dissect;
  const noSignal = hasResult && !dissect!.hasSignal;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-ember-400/30 bg-ember-400/[0.06] p-2.5">
          <Stethoscope className="w-5 h-5 text-ember-300" aria-hidden />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-primary">Dissect a Conversation</h1>
          <p className="text-sm text-secondary mt-0.5 max-w-2xl">
            Paste any conversation. The System summarizes it, then diagnoses the
            problem inside it — and a coach helps you solve it, starting from how{" "}
            <span className="text-primary">you</span> see it.
          </p>
        </div>
        {saved.length > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted">
            <History className="w-3.5 h-3.5" aria-hidden /> {saved.length} saved
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-6">
        <div className="space-y-6 min-w-0">
          {/* Paste + Dissect */}
          <section className="rounded-xl border border-default bg-surface/40 p-4">
            <label className="text-xs font-medium text-secondary uppercase tracking-wide">
              The conversation
            </label>
            <textarea
              value={sourceText}
              onChange={(e) => setSourceText(e.target.value)}
              readOnly={readonly}
              placeholder="Paste the conversation here — a chat thread, a transcript, an email exchange, anything with a problem in it."
              className="mt-2 w-full h-40 resize-y rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ember-400/40"
            />
            <div className="mt-3 flex items-center gap-2">
              {!readonly && (
                <button
                  type="button"
                  onClick={runDissect}
                  disabled={analyzing}
                  className="inline-flex items-center gap-2 rounded-lg bg-ember-500 px-4 py-2 text-sm font-semibold text-white hover:bg-ember-400 disabled:opacity-60"
                >
                  {analyzing ? (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  ) : (
                    <Stethoscope className="w-4 h-4" aria-hidden />
                  )}
                  {analyzing ? "Dissecting…" : "Dissect"}
                </button>
              )}
              {(hasResult || sourceText) && (
                <button
                  type="button"
                  onClick={closeTopic}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-2 text-sm text-secondary hover:text-primary"
                >
                  <X className="w-4 h-4" aria-hidden /> Close the topic
                </button>
              )}
            </div>
            {analyzeErr && (
              <p className="mt-2 text-[13px] text-amber-300">{analyzeErr}</p>
            )}
          </section>

          {/* Honest empty state (§3.4) */}
          {noSignal && (
            <section className="rounded-xl border border-default bg-surface/40 p-4">
              <p className="text-sm text-secondary">
                There isn&apos;t a clear problem to diagnose in what you pasted —
                or there wasn&apos;t enough to go on. (The System won&apos;t invent
                a problem that isn&apos;t there.) Add more of the conversation and
                dissect again — or just ask the coach about it below.
              </p>
            </section>
          )}

          {/* Dissection */}
          {hasResult && dissect!.hasSignal && (
            <section className="space-y-4">
              {dissect!.summary && (
                <div className="rounded-xl border border-default bg-surface/40 p-4">
                  <h2 className="text-xs font-medium text-secondary uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" aria-hidden /> Summary
                  </h2>
                  <p className="mt-1.5 text-sm text-primary leading-relaxed">
                    {dissect!.summary}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-ember-400/30 bg-ember-400/[0.05] p-4">
                <h2 className="text-xs font-medium text-ember-300 uppercase tracking-wide">
                  The problem
                </h2>
                <p className="mt-1.5 text-base font-semibold text-primary">
                  {dissect!.problem.statement}
                </p>
                {dissect!.problem.whyItMatters && (
                  <p className="mt-1 text-sm text-secondary">
                    {dissect!.problem.whyItMatters}
                  </p>
                )}
              </div>

              {dissect!.evidence.length > 0 && (
                <div className="rounded-xl border border-default bg-surface/40 p-4">
                  <h2 className="text-xs font-medium text-secondary uppercase tracking-wide flex items-center gap-1.5">
                    <Quote className="w-3.5 h-3.5" aria-hidden /> Evidence from the conversation
                  </h2>
                  <ul className="mt-2 space-y-2.5">
                    {dissect!.evidence.map((e, i) => (
                      <li key={i} className="text-sm">
                        <p className="text-primary">{e.observation}</p>
                        <p className="mt-0.5 text-[13px] text-muted border-l-2 border-default pl-2 italic">
                          &ldquo;{e.excerpt}&rdquo;
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dissect!.rootCause && (
                  <div className="rounded-xl border border-default bg-surface/40 p-4">
                    <h2 className="text-xs font-medium text-secondary uppercase tracking-wide">
                      Root cause
                    </h2>
                    <p className="mt-1.5 text-sm text-primary leading-relaxed">
                      {dissect!.rootCause}
                    </p>
                  </div>
                )}
                {dissect!.outsideView && (
                  <div className="rounded-xl border border-default bg-surface/40 p-4">
                    <h2 className="text-xs font-medium text-secondary uppercase tracking-wide flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5" aria-hidden /> Outside view
                    </h2>
                    <p className="mt-1.5 text-sm text-primary leading-relaxed">
                      {dissect!.outsideView}
                    </p>
                  </div>
                )}
              </div>

              {dissect!.anglesToConsider.length > 0 && (
                <div className="rounded-xl border border-default bg-surface/40 p-4">
                  <h2 className="text-xs font-medium text-secondary uppercase tracking-wide flex items-center gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5" aria-hidden /> Angles to consider
                  </h2>
                  <p className="text-[11px] text-muted mt-0.5">
                    Directions to weigh — not instructions. You decide.
                  </p>
                  <ul className="mt-2 space-y-2">
                    {dissect!.anglesToConsider.map((a, i) => (
                      <li key={i} className="text-sm">
                        <span className="text-primary font-medium">{a.angle}</span>
                        {a.why && <span className="text-secondary"> — {a.why}</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Save the topic */}
              <div className="rounded-xl border border-default bg-surface/40 p-4">
                {savedId ? (
                  <p className="text-sm text-emerald-300 inline-flex items-center gap-1.5">
                    <Check className="w-4 h-4" aria-hidden /> Saved to your dissections.
                  </p>
                ) : readonly ? (
                  <p className="text-[13px] text-muted">
                    Viewing a saved dissection.
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Name this topic (optional)"
                      className="flex-1 rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ember-400/40"
                    />
                    <button
                      type="button"
                      onClick={saveTopic}
                      disabled={saving}
                      className="inline-flex items-center justify-center gap-2 rounded-lg border border-ember-400/40 px-4 py-2 text-sm font-semibold text-ember-200 hover:bg-ember-400/10 disabled:opacity-60"
                    >
                      {saving ? (
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                      ) : (
                        <Save className="w-4 h-4" aria-hidden />
                      )}
                      Save the topic
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Ask Coach — available after ANY analyzed paste, even when no problem
              was diagnosed (founder 2026-07-07: "any questions pertaining to the
              context of the conversation"). Grounded in the paste regardless. */}
          {dissect && (
            <section className="space-y-4">
              <div className="rounded-xl border border-default bg-surface/40 p-4">
                <h2 className="text-sm font-semibold text-primary flex items-center gap-1.5">
                  <MessageCircleQuestion className="w-4 h-4 text-ember-300" aria-hidden />
                  Ask Coach
                </h2>
                <p className="text-[12px] text-muted mt-0.5">
                  {dissect!.guidingQuestion
                    ? dissect!.guidingQuestion
                    : dissect!.hasSignal
                      ? "How would you approach this? The coach starts from your thinking."
                      : "No clear problem was diagnosed — but you can still ask the coach anything about this conversation."}
                </p>

                {/* §3.3 — invite the user's own thinking first */}
                {!sharedHypothesis && thread.length === 0 && (
                  <div className="mt-3 rounded-lg border border-ember-400/20 bg-ember-400/[0.04] p-3">
                    <label className="text-[11px] font-medium text-ember-200 uppercase tracking-wide">
                      How would you solve it? (optional, but the coach builds on this)
                    </label>
                    <textarea
                      value={hypothesis}
                      onChange={(e) => setHypothesis(e.target.value)}
                      placeholder="Your read on the problem and how you'd tackle it…"
                      className="mt-1.5 w-full h-20 resize-y rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ember-400/40"
                    />
                    <button
                      type="button"
                      onClick={() => setSharedHypothesis(true)}
                      disabled={!hypothesis.trim()}
                      className="mt-2 text-[12px] font-medium text-ember-300 hover:text-ember-200 disabled:opacity-50"
                    >
                      Share my thinking with the coach →
                    </button>
                  </div>
                )}

                {/* Thread */}
                {thread.length > 0 && (
                  <div className="mt-3 space-y-3">
                    {thread.map((t, i) => (
                      <div
                        key={i}
                        className={t.role === "user" ? "text-right" : "text-left"}
                      >
                        <div
                          className={
                            t.role === "user"
                              ? "inline-block rounded-lg bg-ember-500/15 border border-ember-400/20 px-3 py-2 text-sm text-primary max-w-[85%] text-left"
                              : "inline-block rounded-lg bg-surface border border-default px-3 py-2 text-sm text-primary max-w-[90%]"
                          }
                        >
                          {t.role === "coach" && (
                            <span className="block text-[10px] uppercase tracking-wide text-ember-300 mb-0.5">
                              Coach
                            </span>
                          )}
                          <span className="whitespace-pre-wrap leading-relaxed">
                            {t.text}
                          </span>
                        </div>
                      </div>
                    ))}
                    <div ref={threadEndRef} />
                  </div>
                )}

                {/* Ask input */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void askCoach(question);
                  }}
                  className="mt-3 flex items-center gap-2"
                >
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask the coach how to solve it, or anything about the conversation…"
                    className="flex-1 rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-ember-400/40"
                  />
                  <button
                    type="submit"
                    disabled={asking || !question.trim()}
                    aria-label="Send to coach"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ember-500 px-3 py-2 text-sm font-semibold text-white hover:bg-ember-400 disabled:opacity-60"
                  >
                    {asking ? (
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                    ) : (
                      <Send className="w-4 h-4" aria-hidden />
                    )}
                  </button>
                </form>
              </div>
            </section>
          )}
        </div>

        {/* Saved dissections */}
        <aside className="space-y-2">
          <h2 className="text-xs font-medium text-secondary uppercase tracking-wide flex items-center gap-1.5">
            <History className="w-3.5 h-3.5" aria-hidden /> Saved dissections
          </h2>
          {saved.length === 0 ? (
            <p className="text-[12px] text-muted">
              Nothing saved yet. Dissect a conversation, then Save the topic to keep
              it here.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {saved.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => loadSaved(s.id)}
                    className={
                      "w-full text-left rounded-lg border px-3 py-2 text-[13px] hover:border-ember-400/40 " +
                      (savedId === s.id
                        ? "border-ember-400/40 bg-ember-400/[0.05] text-primary"
                        : "border-default text-secondary")
                    }
                  >
                    {s.title}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
