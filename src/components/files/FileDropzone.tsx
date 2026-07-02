"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

// Folder DRAG support: dataTransfer.files does NOT expand directories — a
// dragged folder arrives as a single 0-byte entry. These walk the dropped
// filesystem entries (webkitGetAsEntry) so a dragged folder yields its real
// files. webkitGetAsEntry must be called synchronously in the drop handler.
function readAllDirEntries(
  reader: FileSystemDirectoryReader
): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const out: FileSystemEntry[] = [];
    const read = () =>
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(out);
          return;
        }
        out.push(...batch);
        read();
      }, () => resolve(out));
    read();
  });
}

export type PickedFile = { file: File; path: string };

async function entryToFiles(entry: FileSystemEntry): Promise<PickedFile[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry).file(
        // fullPath is like "/folder/sub/file.js" — strip the leading slash so
        // the zip preserves the folder structure.
        (f) => resolve([{ file: f, path: entry.fullPath.replace(/^\//, "") }]),
        () => resolve([])
      );
    });
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const entries = await readAllDirEntries(reader);
    const nested = await Promise.all(entries.map(entryToFiles));
    return nested.flat();
  }
  return [];
}

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
  onFilesSelected,
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
  /** Batch variant of onFileSelected (large-file / folder upload): when
   *  provided, ALL picked files are handed to the parent at once (each with
   *  its relative PATH). `isFolder` is EXPLICIT intent — true when this came
   *  from the folder picker or a dropped directory — so the parent doesn't
   *  have to sniff paths to know it's a folder. Takes precedence over
   *  onFileSelected. */
  onFilesSelected?: (items: PickedFile[], isFolder: boolean) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const toast = useToast();

  // webkitdirectory (folder select) is non-standard + untyped by React — set
  // it on the folder input via the DOM once mounted.
  useEffect(() => {
    const el = folderInputRef.current;
    if (el) {
      el.setAttribute("webkitdirectory", "");
      el.setAttribute("directory", "");
    }
  });

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
    (files: FileList | null, isFolder = false) => {
      if (!files || files.length === 0) return;
      const all = Array.from(files);
      // Batch pre-upload classify (large files / folders): hand ALL files to
      // the parent with their relative paths. isFolder is explicit (folder
      // picker); also treat "any path has a subdirectory" as a folder.
      if (onFilesSelected) {
        const items = all.map((f) => ({
          file: f,
          path: f.webkitRelativePath || f.name,
        }));
        const folder = isFolder || items.some((i) => i.path.includes("/"));
        onFilesSelected(items, folder);
        return;
      }
      // Single pre-upload classify: defer one file to the parent's modal.
      if (onFileSelected) {
        if (all[0]) onFileSelected(all[0]);
        return;
      }
      for (const f of all) {
        void upload(f);
      }
    },
    [upload, onFileSelected, onFilesSelected]
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
        // Batch mode: expand any dropped FOLDERS via the filesystem-entry API
        // (dataTransfer.files gives a folder as one 0-byte entry). Capture the
        // entries SYNCHRONOUSLY (valid only during the event), then recurse.
        const items = e.dataTransfer.items;
        if (onFilesSelected && items && items.length) {
          const entries: FileSystemEntry[] = [];
          for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const entry = item?.webkitGetAsEntry?.();
            if (entry) entries.push(entry);
          }
          const fallback = e.dataTransfer.files;
          const hasDir = entries.some((en) => en.isDirectory);
          if (entries.length) {
            void (async () => {
              const files = (
                await Promise.all(entries.map(entryToFiles))
              ).flat();
              if (files.length) onFilesSelected(files, hasDir);
              else handleFiles(fallback);
            })();
            return;
          }
        }
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
        multiple={!!onFilesSelected}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {/* Folder picker (large-file/folder upload). webkitdirectory is set via
          ref — it's a non-standard attribute React doesn't type. */}
      {onFilesSelected && (
        <input
          ref={folderInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files, true)}
        />
      )}
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
                "25MB max per file. Images, PDF, docs. Videos and archives blocked. Files without department + task + description count toward your 3/day casual cap."}
            </p>
            {onFilesSelected && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  folderInputRef.current?.click();
                }}
                className="mt-1 text-[11px] text-brand hover:text-ember-400 underline"
              >
                or choose a folder
              </button>
            )}
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
