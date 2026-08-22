"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Target, ListChecks, Paperclip, X, FileText, Image as ImageIcon, Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * Prep-up (Team-Sync / Meeting Coach — founder 2026-08-22). Pre-meeting context the facilitator loads BEFORE a
 * meeting so the AI coach is agenda-aware: the ultimate GOAL, the must-discuss TOPICS, and supporting DOCUMENTS
 * (images with notes, text/pdf/docx). Phase 2 (this UI): collect + autosave the prep. "Start Meeting" hands the
 * prepId to the caller (Phase 5 wires it to session creation). Works the same on web + mobile webapp; uploads go
 * direct-to-storage (signed URL) so a large doc doesn't hit the body cap.
 */

const AUDIO_BUCKET = "assets-v1"; // shared assets bucket (same as the recording/upload paths)

type PrepTopic = { id: string; text: string; covered: boolean };
type PrepDocument = { id: string; filename: string; kind: "image" | "text" | "pdf"; note: string; extractedText: string };

const newId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

function kindOf(file: File): "image" | "text" | "pdf" {
  if (file.type.startsWith("image/")) return "image";
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) return "pdf";
  return "text";
}

export function MeetingPrepUp({ onStart }: { onStart?: (prepId: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [prepId, setPrepId] = useState<string | null>(null);
  const [initError, setInitError] = useState(false);
  const [goal, setGoal] = useState("");
  const [topics, setTopics] = useState<PrepTopic[]>([]);
  const [topicDraft, setTopicDraft] = useState("");
  const [documents, setDocuments] = useState<PrepDocument[]>([]);
  const [pending, setPending] = useState<{ file: File; note: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedTick, setSavedTick] = useState(false);

  // Create a draft prep on mount (the fields autosave against it).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/coach/meeting-prep", { method: "POST" });
        if (!res.ok) throw new Error("create failed");
        const { prep } = await res.json();
        if (!cancelled) setPrepId(prep.id as string);
      } catch {
        if (!cancelled) setInitError(true);
      }
    })();
    return () => {
      cancelled = true;
      if (savedTimer.current) clearTimeout(savedTimer.current);
    };
  }, []);

  // Debounced autosave of goal + topics (PATCH). A failed save is surfaced, never silently dropped.
  const scheduleSave = useCallback(
    (nextGoal: string, nextTopics: PrepTopic[]) => {
      if (!prepId) return;
      if (savedTimer.current) clearTimeout(savedTimer.current);
      savedTimer.current = setTimeout(() => {
        void fetch(`/api/coach/meeting-prep/${prepId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ goal: nextGoal, topics: nextTopics }),
        })
          .then((r) => {
            if (r.ok) {
              setSavedTick(true);
              setTimeout(() => setSavedTick(false), 1500);
            }
          })
          .catch(() => {
            /* transient; the next edit reschedules a save */
          });
      }, 700);
    },
    [prepId]
  );

  const updateGoal = (v: string) => {
    setGoal(v);
    scheduleSave(v, topics);
  };
  const addTopic = () => {
    const text = topicDraft.trim();
    if (!text) return;
    const next = [...topics, { id: newId(), text, covered: false }];
    setTopics(next);
    setTopicDraft("");
    scheduleSave(goal, next);
  };
  const removeTopic = (id: string) => {
    const next = topics.filter((t) => t.id !== id);
    setTopics(next);
    scheduleSave(goal, next);
  };

  const uploadDoc = useCallback(
    async (file: File, note: string) => {
      if (!prepId) return;
      setUploading(true);
      setUploadError(null);
      try {
        const base = `/api/coach/meeting-prep/${prepId}/document`;
        const signRes = await fetch(base, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "sign", filename: file.name, mimeType: file.type }),
        });
        if (!signRes.ok) throw new Error("unsupported or sign failed");
        const { storagePath, token } = await signRes.json();
        const up = await supabase.storage.from(AUDIO_BUCKET).uploadToSignedUrl(storagePath, token, file);
        if (up.error) throw new Error("upload failed");
        const confirmRes = await fetch(base, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "confirm", storagePath, filename: file.name, mimeType: file.type, note }),
        });
        if (!confirmRes.ok) throw new Error("save failed");
        const { document } = await confirmRes.json();
        setDocuments((d) => [...d, document as PrepDocument]);
        setPending(null);
      } catch {
        setUploadError("Couldn't add that file. Check the type (image, text, or PDF) and try again.");
      } finally {
        setUploading(false);
      }
    },
    [prepId, supabase]
  );

  const onPickFile = (file: File | null) => {
    if (!file) return;
    setUploadError(null);
    // Images get a note step (the AI reads the note alongside the OCR); text/pdf upload straight away.
    if (kindOf(file) === "image") setPending({ file, note: "" });
    else void uploadDoc(file, "");
  };

  if (initError) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 bg-base">
        <p className="text-sm text-red-300 text-center">
          Couldn&apos;t start a prep. Check your connection and reload.
        </p>
      </div>
    );
  }
  if (!prepId) {
    return (
      <div className="flex-1 flex items-center justify-center gap-2 text-muted bg-base">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> Setting up your prep…
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-base flex flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-8 max-w-2xl mx-auto w-full">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-primary">Prep-up</h1>
          <p className="text-xs text-muted">Set the goal, the must-discuss topics, and any documents — the coach uses these live.</p>
        </div>
        {savedTick && (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Check className="w-3.5 h-3.5" aria-hidden /> Saved
          </span>
        )}
      </header>

      {/* GOAL */}
      <section className="flex flex-col gap-2">
        <label htmlFor="prep-goal" className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Target className="w-4 h-4 text-brand" aria-hidden /> The goal of this meeting
        </label>
        <textarea
          id="prep-goal"
          value={goal}
          onChange={(e) => updateGoal(e.target.value)}
          rows={2}
          placeholder="e.g. Agree the Q3 launch date and unblock the API work"
          className="w-full bg-surface border border-default rounded-xl px-4 py-3 text-primary text-base focus:outline-none focus:border-ember-400/50 resize-none"
        />
      </section>

      {/* TOPICS */}
      <section className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-primary">
          <ListChecks className="w-4 h-4 text-brand" aria-hidden /> Must-discuss topics
        </span>
        <div className="flex gap-2">
          <input
            value={topicDraft}
            onChange={(e) => setTopicDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTopic();
              }
            }}
            placeholder="Add a topic and press Enter"
            className="flex-1 bg-surface border border-default rounded-xl px-4 py-2.5 text-primary text-base focus:outline-none focus:border-ember-400/50"
          />
          <button
            type="button"
            onClick={addTopic}
            className="rounded-xl bg-ember-400 text-[#09090B] px-4 py-2.5 text-sm font-bold active:scale-[0.98] transition-transform"
          >
            Add
          </button>
        </div>
        {topics.length > 0 && (
          <ul className="flex flex-col gap-1.5 mt-1">
            {topics.map((t, i) => (
              <li key={t.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
                <span className="text-xs text-muted tabular-nums w-5">{i + 1}.</span>
                <span className="flex-1 text-sm text-primary">{t.text}</span>
                <button type="button" onClick={() => removeTopic(t.id)} aria-label={`Remove ${t.text}`} className="text-muted hover:text-red-400">
                  <X className="w-4 h-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* DOCUMENTS */}
      <section className="flex flex-col gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Paperclip className="w-4 h-4 text-brand" aria-hidden /> Documents
        </span>
        <p className="text-xs text-muted -mt-1">Images (add a note), text files, or PDFs. The coach reads their content.</p>

        {documents.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {documents.map((d) => (
              <li key={d.id} className="rounded-lg bg-white/[0.03] border border-white/10 px-3 py-2">
                <div className="flex items-center gap-2">
                  {d.kind === "image" ? <ImageIcon className="w-4 h-4 text-brand/70" aria-hidden /> : <FileText className="w-4 h-4 text-brand/70" aria-hidden />}
                  <span className="flex-1 text-sm text-primary truncate">{d.filename}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted">{d.kind}</span>
                </div>
                {d.note && <p className="text-xs text-secondary mt-1">Note: {d.note}</p>}
                {d.extractedText && <p className="text-xs text-muted mt-1 line-clamp-2">{d.extractedText.slice(0, 160)}</p>}
              </li>
            ))}
          </ul>
        )}

        {pending ? (
          <div className="rounded-xl border border-ember-400/30 bg-ember-400/[0.06] p-3 flex flex-col gap-2">
            <p className="text-sm text-primary flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-brand" aria-hidden /> {pending.file.name}
            </p>
            <textarea
              value={pending.note}
              onChange={(e) => setPending((p) => (p ? { ...p, note: e.target.value } : p))}
              rows={2}
              placeholder="Add a note describing what this image shows (the coach reads this)"
              className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-primary text-sm focus:outline-none focus:border-ember-400/50 resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={uploading}
                onClick={() => void uploadDoc(pending.file, pending.note)}
                className="rounded-lg bg-ember-400 text-[#09090B] px-4 py-2 text-sm font-bold disabled:opacity-60 active:scale-[0.98] transition-transform"
              >
                {uploading ? "Adding…" : "Add image"}
              </button>
              <button type="button" onClick={() => setPending(null)} className="rounded-lg border border-default px-4 py-2 text-sm text-secondary">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <label className="w-full cursor-pointer rounded-xl border border-dashed border-white/20 bg-white/[0.02] px-4 py-4 text-center text-sm text-secondary hover:border-ember-400/40 transition-colors">
            {uploading ? "Uploading…" : "Tap to add a document"}
            <input
              type="file"
              accept="image/*,.txt,.md,.csv,.rtf,.html,.pdf,.docx,.odt,.epub"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                onPickFile(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
          </label>
        )}
        {uploadError && <p className="text-xs text-red-300">{uploadError}</p>}
      </section>

      {/* START */}
      <button
        type="button"
        onClick={() => onStart?.(prepId)}
        className="w-full min-h-[64px] rounded-2xl bg-ember-400 text-[#09090B] text-lg font-bold active:scale-[0.98] transition-transform shadow-glow mt-2"
      >
        Start Meeting
      </button>
    </div>
  );
}
