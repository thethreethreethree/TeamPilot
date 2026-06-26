"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Paperclip, X } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * Asset System v1 — drag/drop + click-to-pick zone.
 *
 * The dropzone is the universal entry point on every surface
 * (library page, tasks, chat composer, C.A.R.E composer).
 * Visual states per AMD-006 §1.5.1 layer 4:
 *   - Idle: thin dashed border (recessed)
 *   - Drag-over: brand ember border + bg
 *   - Uploading: progress with cancel
 *   - Error: red border + error message + retry
 */

export type UploadResult = {
  ok: boolean;
  file?: {
    id: string;
    title: string;
    [key: string]: unknown;
  };
  error?: string;
};

export function FileDropzone({
  onUploadComplete,
  contextHint,
  hiddenLabel,
  compact = false,
  linkedTopicId,
  linkedConversationId,
  linkedTaskId,
  endpoint,
  onFileSelected,
}: {
  onUploadComplete?: (result: UploadResult) => void;
  /** Label tweak for in-context dropzones (e.g. "Attach to this task"). */
  contextHint?: string;
  /** True to render only the small paperclip icon (composer mode). */
  hiddenLabel?: boolean;
  compact?: boolean;
  linkedTopicId?: string;
  linkedConversationId?: string;
  linkedTaskId?: string;
  /** Override the upload endpoint. Defaults to /api/files. C.A.R.E
   *  composer uses /api/care/conversations/{id}/agent-upload to
   *  combine the file row + an attachment-kind support_messages
   *  row in a single network round-trip. */
  endpoint?: string;
  /** Pre-upload classify hook (2026-06-26 audit Finding B). When
   *  provided, picking a file calls this with the File INSTEAD of
   *  uploading immediately — the parent opens a classify-before-upload
   *  modal and performs the upload itself (with classification, so the
   *  file lands classified and never burns the casual cap). When
   *  omitted, behaviour is unchanged: upload fires immediately. */
  onFileSelected?: (file: File) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      setProgress(10);
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      if (linkedTopicId) form.append("linked_topic_id", linkedTopicId);
      if (linkedConversationId)
        form.append("linked_conversation_id", linkedConversationId);
      if (linkedTaskId) form.append("linked_task_id", linkedTaskId);
      try {
        const res = await fetch(endpoint ?? "/api/files", {
          method: "POST",
          body: form,
        });
        setProgress(90);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error ?? `Upload failed (${res.status}).`);
          onUploadComplete?.({ ok: false, error: data?.error });
          setUploading(false);
          return;
        }
        setProgress(100);
        // Auto-routing transparency toast — per the inspection
        // closure 2026-06-19-deterministic-file-routing.md Finding 1.
        // When the deterministic router auto-classified the file
        // (lane = 'classified' AND the user did not open a modal
        // — silent uploads from chat / C.A.R.E composers), tell
        // the user so they can override. Library + Task uploads
        // open the modal so the user sees the pre-fill there;
        // for those we still toast but mute it.
        const lane = (data.file as { classificationLane?: string })
          ?.classificationLane;
        if (lane === "classified") {
          toast.success("Attached & routed — open library to edit");
        } else if (lane === "casual") {
          toast.success("Attached");
        }
        onUploadComplete?.({ ok: true, file: data.file });
        setTimeout(() => {
          setUploading(false);
          setProgress(0);
        }, 250);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Network error.";
        setError(msg);
        onUploadComplete?.({ ok: false, error: msg });
        setUploading(false);
      }
    },
    [linkedTopicId, linkedConversationId, linkedTaskId, onUploadComplete, endpoint]
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      // Pre-upload classify: defer to the parent instead of uploading.
      // One file at a time in this mode (the modal classifies one).
      if (onFileSelected) {
        const first = Array.from(files)[0];
        if (first) onFileSelected(first);
        return;
      }
      for (const f of Array.from(files)) {
        void upload(f);
      }
    },
    [upload, onFileSelected]
  );

  if (hiddenLabel) {
    return (
      <>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Attach a file"
          title="Attach a file"
          className="text-muted hover:text-primary p-1.5 rounded-md hover:bg-white/[0.04] transition-colors flex items-center gap-1.5 text-xs"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Paperclip className="w-3.5 h-3.5" aria-hidden />
          )}
          {uploading ? "Uploading…" : "Attach"}
        </button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {error && (
          <span className="text-[11px] text-red-300 ml-2">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss"
              className="ml-1 text-muted hover:text-primary"
            >
              <X className="w-3 h-3 inline" aria-hidden />
            </button>
          </span>
        )}
      </>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`relative border-2 border-dashed rounded-lg cursor-pointer transition-all ${
        compact ? "p-4" : "p-8"
      } ${
        dragOver
          ? "border-ember-400 bg-ember-400/10"
          : error
            ? "border-red-500/40 bg-red-500/[0.04]"
            : "border-default hover:border-ember-400/40 hover:bg-white/[0.02]"
      }`}
      role="button"
      tabIndex={0}
      aria-label="Drop a file or click to upload"
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex flex-col items-center text-center gap-2">
        {uploading ? (
          <>
            <Loader2 className="w-6 h-6 text-brand animate-spin" aria-hidden />
            <p className="text-sm text-primary font-medium">Uploading…</p>
            <div className="w-full max-w-xs h-1 bg-surface rounded-full overflow-hidden">
              <div
                className="h-full bg-ember-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        ) : (
          <>
            <Paperclip
              className={`w-6 h-6 ${dragOver ? "text-brand" : "text-muted"}`}
              aria-hidden
            />
            <p className="text-sm text-primary font-medium">
              {dragOver ? "Drop to upload" : "Drop a file or click to upload"}
            </p>
            <p className="text-[11px] text-muted max-w-md">
              {contextHint ??
                "25MB max. Images, PDF, docs. Videos and archives blocked. Files without department + task + description count toward your 3/day casual cap."}
            </p>
          </>
        )}
        {error && (
          <p className="text-xs text-red-300 mt-1">
            {error}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setError(null);
              }}
              className="ml-2 underline"
            >
              Dismiss
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
