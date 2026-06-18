"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AlertTriangle,
  Bug,
  Camera,
  CheckCircle2,
  HelpCircle,
  Lightbulb,
  Loader2,
  Send,
  Sparkles,
  ThumbsUp,
  X,
} from "lucide-react";
import { captureScreenshot } from "@/lib/feedback/screenshot";
import { useToast } from "@/components/ui/toast";
import { FeedbackScreenshotEditor } from "./FeedbackScreenshotEditor";
import { MentionInput, type MentionMember } from "@/components/ui/MentionInput";
import { fetchTeam } from "@/lib/data/team";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";
import type { CoachContextPayload } from "@/lib/coach/v5/types";

/**
 * FeedbackPanel — slide-out form for submitting feedback.
 *
 * Constitutional shape:
 *   - kind picker frames the input deliberately (§3.3 — the user
 *     names what they're saying before the System interprets it)
 *   - context capture is automatic — viewport, path, theme, user agent
 *     — so the feedback row has everything needed to reproduce
 *   - screenshot toggle uses the hybrid getDisplayMedia → html2canvas
 *     path. The user clicks once; the tool tries the high-accuracy
 *     path and falls back silently.
 *
 * The submit hits POST /api/feedback which inserts an immutable row
 * and emits a feedback.submitted event into the §3.1 chain.
 */

type FeedbackKind = "bug" | "idea" | "question" | "friction" | "praise";

const KIND_OPTIONS: ReadonlyArray<{
  value: FeedbackKind;
  label: string;
  hint: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    value: "bug",
    label: "Bug",
    hint: "Something is broken or wrong.",
    Icon: Bug,
  },
  {
    value: "friction",
    label: "Friction",
    hint: "It works but feels confusing or slow.",
    Icon: AlertTriangle,
  },
  {
    value: "idea",
    label: "Idea",
    hint: "Suggestion for something new or different.",
    Icon: Lightbulb,
  },
  {
    value: "question",
    label: "Question",
    hint: "Not sure how this should work.",
    Icon: HelpCircle,
  },
  {
    value: "praise",
    label: "Praise",
    hint: "Worked exactly how it should.",
    Icon: ThumbsUp,
  },
];

export function FeedbackPanel({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const pathname = usePathname() ?? "/";

  const [kind, setKind] = useState<FeedbackKind>("bug");
  // Coach v5 Ask-Coach token for the feedback composer.
  const [askCoachToken, setAskCoachToken] = useState(0);
  // Coach v5 contextPayload — the Coach reads feedbackKind so it can
  // tailor which Knowledge Base layer to apply (friction/bug → NVC;
  // praise → Crucial Conv. Start with Heart + Cialdini Liking; idea
  // → Heath Brothers Simplicity; etc.).
  const coachV5Payload = useMemo<CoachContextPayload>(
    () => ({ feedbackKind: kind }),
    [kind]
  );
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [screenshot, setScreenshot] = useState<{
    dataUrl: string;
    method: string;
    bytes: number;
    annotations?: number;
  } | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [editingScreenshot, setEditingScreenshot] = useState(false);
  const [members, setMembers] = useState<MentionMember[]>([]);
  const { enabled: coachEnabled } = useCoachEnabled();
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Pull the company roster once on open so @-autocomplete has the
  // candidate list ready before the tester starts typing.
  useEffect(() => {
    let cancelled = false;
    void fetchTeam().then((snap) => {
      if (cancelled) return;
      setMembers(
        snap.members
          .filter((m) => m.status === "active" && m.fullName)
          .map((m) => ({ id: m.id, fullName: m.fullName as string }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Esc to close + focus trap-ish behavior. We keep this minimal —
  // shared Modal would be heavier; this panel is its own surface.
  // While the screenshot editor is open, the editor owns Esc — let it
  // handle the key and skip our own handler so we don't tear down the
  // whole panel when the user just wants out of annotation mode.
  // Body scroll lock — runs once on mount / cleans up on unmount.
  // Don't bind to onClose / editingScreenshot deps; doing so was
  // the same bug class as the Modal (parent passing a new onClose
  // reference every render thrashed the scroll lock).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc handler — rebound when onClose / editingScreenshot change
  // so we always read the latest values. No scroll-lock side effects
  // here; those belong to the mount effect above.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editingScreenshot) return;
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, editingScreenshot]);

  // Clipboard paste handler — Ctrl+V (Windows/Linux) or Cmd+V (macOS)
  // anywhere in the panel pulls an image off the clipboard and sets it
  // as the screenshot. The browser fires the `paste` event whenever
  // the modifier-combo lands in our window, so we don't need a custom
  // keydown listener — we just consume the event. This lets a tester
  // paste an image they captured with Snipping Tool / Cmd+Shift+4 /
  // any other native screenshot tool, side-stepping html2canvas
  // entirely when they want absolute pixel control. Skips when the
  // annotation editor is open so its own keys keep working.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (editingScreenshot || done) return;
      if (!e.clipboardData) return;
      const imageItem = Array.from(e.clipboardData.items).find((item) =>
        item.type.startsWith("image/")
      );
      if (!imageItem) return;
      const blob = imageItem.getAsFile();
      if (!blob) return;
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string") return;
        setScreenshot({
          dataUrl,
          method: "clipboard",
          bytes: blob.size,
        });
        toast.success("Screenshot pasted", "From your clipboard — annotate below.");
      };
      reader.readAsDataURL(blob);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [editingScreenshot, done, toast]);

  const captureNow = async () => {
    if (capturing) return;
    setCapturing(true);
    try {
      const result = await captureScreenshot();
      if (!result) {
        toast.warn(
          "Couldn't capture screenshot",
          "The page render returned nothing. Try again, or submit without a screenshot."
        );
        return;
      }
      setScreenshot({
        dataUrl: result.dataUrl,
        method: result.method,
        bytes: result.bytes,
      });
    } finally {
      setCapturing(false);
    }
  };

  const submit = async () => {
    if (submitting || !title.trim()) return;
    setSubmitting(true);
    try {
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        theme: document.documentElement.getAttribute("data-theme") ?? null,
        userAgent: navigator.userAgent,
      };
      const payload: Record<string, unknown> = {};
      if (screenshot) {
        // Inline base64 in payload for now. A future migration can
        // move this to Supabase Storage if size becomes an issue.
        // See `src/lib/feedback/screenshot.ts` for rationale.
        payload.screenshot_data_url = screenshot.dataUrl;
        payload.screenshot_method = screenshot.method;
        payload.screenshot_bytes = screenshot.bytes;
        if (screenshot.annotations) {
          payload.screenshot_annotations = screenshot.annotations;
        }
      }
      // Per TT.md A21 audit (2026-06-18) MED finding — surface the
      // origin context in the payload so admin triage can tell
      // smoke-test-spawned feedback from floating-button feedback.
      // Closes the §1.6 close-the-loop gap that auditors flagged.
      const sourceContext = pathname.startsWith("/dashboard/smoke-test")
        ? "smoke_test"
        : "floating_button";
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: title.trim(),
          body: body.trim(),
          page_path: pathname,
          viewport,
          payload: { ...payload, source_context: sourceContext },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error("Couldn't submit", data.error ?? `HTTP ${res.status}`);
        return;
      }
      // Coach v2 (mirror, A11) — log per-heuristic observations on the
      // final feedback body. Subject is the feedback id when the API
      // returns it; otherwise stays generic. Async, non-blocking.
      const submitted = (await res.json().catch(() => ({}))) as {
        id?: string;
      };
      const fbSubject = submitted.id
        ? `feedback:${submitted.id}`
        : "feedback:draft";
      void import("@/lib/coach/observe").then(({ observePatterns }) =>
        observePatterns({ subject: fbSubject, bodyText: body.trim() })
      );
      setDone(true);
      toast.success("Feedback received", "Thanks — it's now on the record.");
    } catch (err) {
      toast.error(
        "Network error",
        err instanceof Error ? err.message : "Try again"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex"
      role="dialog"
      aria-modal="true"
      aria-label="Send feedback"
      data-feedback-ignore
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Dismiss feedback"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-sm"
      />
      {/* Panel */}
      <div
        ref={dialogRef}
        className="w-full max-w-md bg-base border-l border-default shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-base border-b border-default">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand" aria-hidden />
            <h2 className="text-sm font-semibold text-primary">Send feedback</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted hover:text-primary p-1 rounded"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {done ? (
          <div className="p-6 flex flex-col items-center text-center gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" aria-hidden />
            <p className="text-sm text-primary">
              Thanks — your feedback is on the §3.1 record.
            </p>
            <p className="text-xs text-muted leading-relaxed max-w-xs">
              You&apos;ll see the journey of this report (triaged → in progress
              → resolved) in your feedback history.
            </p>
            <button
              onClick={onClose}
              className="mt-2 text-xs text-brand hover:text-primary px-3 py-1.5"
            >
              Close
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted leading-relaxed">
              Submitting from <code className="font-mono text-brand">{pathname}</code>.
              Every report becomes a permanent §3.1 asset; patterns earn
              problem status via §3.2.
            </p>

            {/* Kind picker */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-2">
                Kind
              </label>
              <div className="grid grid-cols-1 gap-1.5">
                {KIND_OPTIONS.map((opt) => {
                  const Icon = opt.Icon;
                  const active = kind === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setKind(opt.value)}
                      className={`flex items-start gap-2.5 text-left p-2.5 rounded-lg border transition-colors ${
                        active
                          ? "border-brand bg-ember-400/8"
                          : "border-default bg-surface hover:border-strong"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                          active ? "text-brand" : "text-muted"
                        }`}
                        aria-hidden
                      />
                      <div>
                        <p className="text-xs font-semibold text-primary">
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-muted">{opt.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
                Title <span className="text-brand">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="One sentence — what happened or what you noticed"
                maxLength={200}
                className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30"
              />
            </div>

            {/* Body — MentionInput supports @-tagging teammates. Type
                "@" + name to insert a styled mention; on submit the
                server emits mention.created events into the §3.1 chain
                so the tag is on the record. */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
                Details
                <span className="ml-2 text-muted/70 font-normal normal-case tracking-normal">
                  · type <kbd className="font-mono text-brand">@</kbd> to tag a
                  teammate
                </span>
              </label>
              {/* Coach surface — v5 (LLM-primary, conversational) when
                  the migration flag is on; v4 chip as fallback. The v5
                  Coach reads the feedbackKind as the surface context so
                  it knows whether to apply NVC (for friction/bug),
                  Crucial Conversations (high-stakes), or Heath Brothers
                  Simplicity (for ideas / questions). */}
              {coachEnabled && (
                <>
                  <CoachPanelV5
                    draft={body}
                    contextType="feedback"
                    contextPayload={coachV5Payload}
                    askCoachToken={askCoachToken}
                    onAcceptRevision={(revised) => setBody(revised)}
                  />
                  <div className="mb-2 flex justify-end">
                    <AskCoachButton
                      disabled={!body.trim()}
                      onAsk={() => setAskCoachToken((t) => t + 1)}
                    />
                  </div>
                </>
              )}
              <MentionInput
                value={body}
                onChange={setBody}
                members={members}
                rows={5}
                placeholder="What you expected, what actually happened, anything that helps reproduce…"
                className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 resize-none leading-relaxed"
              />
            </div>

            {/* Screenshot */}
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1.5">
                Screenshot (optional)
              </label>
              {!screenshot ? (
                <button
                  type="button"
                  onClick={captureNow}
                  disabled={capturing}
                  className="w-full flex items-center justify-center gap-2 border border-default hover:border-strong bg-surface text-secondary hover:text-primary px-3 py-2.5 rounded-lg text-xs disabled:opacity-50"
                >
                  {capturing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                      Capturing…
                    </>
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" aria-hidden />
                      Capture screenshot
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setEditingScreenshot(true)}
                    title="Open annotation editor"
                    className="block w-full rounded-lg border border-default overflow-hidden hover:border-strong transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshot.dataUrl}
                      alt="Captured screenshot — click to annotate"
                      className="w-full h-auto"
                    />
                  </button>
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span className="font-mono">
                      via {screenshot.method} · {Math.round(screenshot.bytes / 1024)} KB
                      {screenshot.annotations
                        ? ` · ${screenshot.annotations} mark${screenshot.annotations === 1 ? "" : "s"}`
                        : ""}
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditingScreenshot(true)}
                        className="text-brand hover:text-primary font-semibold"
                      >
                        Annotate
                      </button>
                      <button
                        onClick={() => setScreenshot(null)}
                        className="text-brand hover:text-primary"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <p className="mt-1.5 text-[10px] text-muted leading-relaxed">
                Captures the current page silently — no permission prompt.
                Click the captured image (or &ldquo;Annotate&rdquo;) to point
                at the thing you&apos;re reporting — arrow, text, highlight,
                box, or circle. You can also paste an image from your
                clipboard with{" "}
                <kbd className="font-mono text-brand">Ctrl/Cmd+V</kbd> (handy
                if you grabbed a region with Snipping Tool or{" "}
                <kbd className="font-mono text-brand">Cmd+Shift+4</kbd>).
              </p>
            </div>

            {editingScreenshot && screenshot && (
              <FeedbackScreenshotEditor
                dataUrl={screenshot.dataUrl}
                onCancel={() => setEditingScreenshot(false)}
                onDone={(newDataUrl, annotationCount, bytes) => {
                  // Keep the existing method label intact, append a
                  // suffix only when marks were actually baked in so the
                  // metadata distinguishes annotated from raw captures.
                  const baseMethod = screenshot.method.replace(/\+annotated$/, "");
                  setScreenshot({
                    dataUrl: newDataUrl,
                    method:
                      annotationCount > 0 ? `${baseMethod}+annotated` : baseMethod,
                    bytes,
                    ...(annotationCount > 0
                      ? { annotations: (screenshot.annotations ?? 0) + annotationCount }
                      : {}),
                  });
                  setEditingScreenshot(false);
                }}
              />
            )}

            {/* Submit */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-default">
              <button
                onClick={onClose}
                disabled={submitting}
                className="text-xs text-muted hover:text-primary px-3 py-2 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting || !title.trim()}
                className="flex items-center gap-2 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                    Sending…
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" aria-hidden />
                    Submit
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
