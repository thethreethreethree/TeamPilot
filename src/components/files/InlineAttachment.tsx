"use client";

import { useEffect, useState } from "react";
import { Download, FileText, Image as ImageIcon, Loader2, Lock, Music } from "lucide-react";

/**
 * Inline attachment card — shown in chat thread + C.A.R.E
 * conversation when a message has kind='attachment'. Reads the
 * file pointer from media_url (assets-v1://{fileId}), fetches
 * the file row + signed URL on demand, renders title + size +
 * classification chips + download.
 *
 * Per §A14 (data path ≠ render path): the row exists; this is
 * the render branch that consumes it. Without this the
 * attachment message body just shows the title as text.
 */

const SCHEME = "assets-v1://";

export function InlineAttachment({
  mediaUrl,
  fallbackTitle,
  mediaType,
}: {
  mediaUrl: string;
  fallbackTitle?: string;
  mediaType?: string | null;
}) {
  const fileId = mediaUrl.startsWith(SCHEME) ? mediaUrl.slice(SCHEME.length) : null;
  const [loading, setLoading] = useState(true);
  const [file, setFile] = useState<{
    id: string;
    title: string;
    description: string | null;
    sizeBytes: number;
    mimeType: string;
    classificationLane: "classified" | "casual";
    accessRole: string;
    tags: string[];
  } | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!fileId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/files/${fileId}`);
        if (!res.ok) {
          if (!cancelled) setLoading(false);
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        setFile(data.file);
        setDownloadUrl(data.downloadUrl ?? null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  if (!fileId) {
    return (
      <span className="text-xs text-secondary italic">
        Attachment (legacy format)
      </span>
    );
  }

  if (loading) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
        Loading attachment…
      </div>
    );
  }

  if (!file) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs text-muted italic">
        Attachment unavailable {fallbackTitle ? `(${fallbackTitle})` : ""}
      </div>
    );
  }

  const mime = file.mimeType || mediaType || "";
  const Icon =
    mime.startsWith("image/")
      ? ImageIcon
      : mime.startsWith("audio/")
        ? Music
        : FileText;
  const casual = file.classificationLane === "casual";
  const sizeLabel =
    file.sizeBytes < 1024
      ? `${file.sizeBytes} B`
      : file.sizeBytes < 1024 * 1024
        ? `${(file.sizeBytes / 1024).toFixed(1)} KB`
        : `${(file.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  const isImage = mime.startsWith("image/");
  const open = () => {
    if (downloadUrl) window.open(downloadUrl, "_blank", "noopener");
  };

  return (
    <div
      className={`rounded-lg border p-2.5 flex items-start gap-2.5 max-w-md ${
        casual
          ? "border-default bg-white/[0.02]"
          : "border-ember-400/30 bg-ember-400/[0.04]"
      }`}
    >
      <div
        className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
          casual
            ? "bg-surface border border-default"
            : "bg-ember-400/10 border border-ember-400/30"
        }`}
      >
        <Icon
          className={`w-4 h-4 ${casual ? "text-muted" : "text-brand"}`}
          aria-hidden
        />
      </div>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={open}
          className="text-sm font-medium text-primary hover:text-brand text-left truncate block w-full"
          title={file.title}
        >
          {file.title}
        </button>
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span className="text-[10px] uppercase tracking-widest text-muted">
            {file.classificationLane}
          </span>
          <span className="text-muted text-[10px]">·</span>
          <span className="text-[10px] text-muted">{sizeLabel}</span>
          {file.accessRole !== "everyone" && (
            <>
              <span className="text-muted text-[10px]">·</span>
              <span className="text-[10px] text-amber-300 inline-flex items-center gap-0.5">
                <Lock className="w-2.5 h-2.5" aria-hidden />
                {file.accessRole.replace("_", " ")}
              </span>
            </>
          )}
        </div>
        {file.description && (
          <p className="text-[11px] text-secondary line-clamp-2 mt-1">
            {file.description}
          </p>
        )}
        {isImage && downloadUrl && (
          // Inline image preview — cheap and high-signal for
          // the screenshot-attached use case (the founder
          // explicitly mentioned screenshots in the C.A.R.E
          // workflow).
          <button
            type="button"
            onClick={open}
            className="mt-2 block w-full"
            aria-label="Open image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={downloadUrl}
              alt={file.title}
              className="max-h-48 rounded-md border border-default object-contain bg-base"
              loading="lazy"
            />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={open}
        aria-label="Download"
        title="Download"
        className="text-muted hover:text-primary p-1 rounded hover:bg-white/[0.04] flex-shrink-0"
      >
        <Download className="w-3.5 h-3.5" aria-hidden />
      </button>
    </div>
  );
}
