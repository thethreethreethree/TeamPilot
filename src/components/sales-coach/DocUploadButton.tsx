"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

const ACCEPT = ".txt,.md,.markdown,.html,.htm,.rtf,.docx,.odt,.epub,.pdf";
const ACCEPT_LABEL = "PDF, Word (.docx), .txt, .md, .rtf, .odt, .epub, .html";
// F3: mirror the server's 4 MB cap client-side so an oversized file is rejected instantly instead of
// being sent and bounced by the platform's serverless body limit with an opaque error.
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/**
 * Upload a document and fill an editor's draft with its extracted text (founder 2026-07-30).
 * Non-destructive: it replaces the DRAFT for review; the saved version isn't touched until the manager
 * clicks Save. Extraction happens server-side (/api/coach/sales-session/extract); this component only
 * posts the file and hands the text back via onExtracted.
 */
export function DocUploadButton({
  onExtracted,
  targetLabel,
  endpoint = "/api/coach/sales-session/extract",
  maxChars,
}: {
  onExtracted: (text: string) => void;
  targetLabel: string;
  /** Extraction endpoint. Defaults to the sales-coach route; C.A.R.E surfaces pass the care route. */
  endpoint?: string;
  /** The target field's char cap, sent so extraction never exceeds what the field will save (F5). */
  maxChars?: number;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const pick = () => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input so re-selecting the same file fires change again.
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_FILE_BYTES) {
      toast.error(
        "That file is too large",
        "Uploads are limited to 4 MB. Export just the text (or a smaller PDF/DOCX) and try again."
      );
      return;
    }

    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (maxChars) fd.append("maxChars", String(maxChars));
      const res = await fetch(endpoint, { method: "POST", body: fd });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error ?? "Couldn't read that file.");
      }
      const text = String(data?.text ?? "");
      if (!text.trim()) {
        throw new Error("No readable text was found in that document.");
      }
      onExtracted(text);
      toast.success(
        `Loaded ${file.name} into ${targetLabel}`,
        data?.truncated
          ? "The document was long — it was trimmed to fit. Review and Save when ready."
          : "Review the text, then Save when ready."
      );
    } catch (err) {
      toast.error(
        "Couldn't import that file",
        err instanceof Error ? err.message : "Try exporting it as PDF, DOCX, or TXT."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={onFile}
        className="hidden"
        aria-hidden
      />
      <button
        type="button"
        onClick={pick}
        disabled={busy}
        title={`Upload a file to fill this from a document. Supported: ${ACCEPT_LABEL}.`}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-secondary hover:text-primary border border-default hover:border-ember-400/50 rounded-md px-2.5 py-1.5 transition-colors disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
        ) : (
          <Upload className="w-3.5 h-3.5" aria-hidden />
        )}
        {busy ? "Reading…" : "Upload a file"}
      </button>
    </>
  );
}
