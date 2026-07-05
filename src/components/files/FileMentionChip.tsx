"use client";

import { useState } from "react";
import { Loader2, Paperclip } from "lucide-react";
import { useToast } from "@/components/ui/toast";

/**
 * Inline chip for an `@file[Title](UUID)` mention. Renders a
 * small icon + title; click opens the file via signed URL.
 *
 * Per §A11: the chip surfaces a fact (this message cites file X);
 * the user decides whether to click. No download happens until
 * they ask for it.
 */
export function FileMentionChip({
  fileId,
  title,
}: {
  fileId: string;
  title: string;
}) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  // Audit M3: surface failures instead of silently returning (same
  // class as the delete bug). A cited file the caller can no longer
  // access, or a deprecated file, otherwise produced a dead click.
  const open = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/files/${fileId}`);
      if (!res.ok) {
        toast.error(
          "Can't open file",
          res.status === 404
            ? "This file no longer exists."
            : "You may not have access to this file."
        );
        return;
      }
      const data = await res.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank", "noopener");
      } else {
        toast.error("Can't open file", "The download link is unavailable.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={open}
      className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded border border-ember-400/40 bg-ember-400/[0.08] text-brand hover:bg-ember-400/[0.16] hover:border-ember-400/60 align-baseline mx-0.5"
      title={`Open ${title}`}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin flex-shrink-0" aria-hidden />
      ) : (
        <Paperclip className="w-3 h-3 flex-shrink-0" aria-hidden />
      )}
      <span className="truncate max-w-[200px]">{title}</span>
    </button>
  );
}
