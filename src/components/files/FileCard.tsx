"use client";

import {
  Download,
  FileText,
  Image as ImageIcon,
  Lock,
  Music,
  Pencil,
  Trash2,
} from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * Asset System v1 — compact file card.
 *
 * Per AMD-006 §1.5.1 layer 4 (Surface): the card MUST show
 * the 3 classification fields at a glance — that is the
 * founder's red-pen requirement. Casual files get a distinct
 * treatment so the reader knows asset value is intentionally
 * not tracked.
 *
 * Per §A10: the uploader's name + upload time are always
 * shown (no shadow identity).
 */

export type FileCardData = {
  id: string;
  title: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  classificationLane: "classified" | "casual";
  accessRole: "everyone" | "admins" | "ceo_admins" | "specific_people";
  uploaderId: string | null;
  uploaderName?: string | null;
  createdAt: string;
  departmentNames?: string[];
  taskTitles?: string[];
  tags: string[];
};

function fileIcon(mime: string) {
  if (mime.startsWith("image/")) return ImageIcon;
  if (mime.startsWith("audio/")) return Music;
  return FileText;
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function FileCard({
  file,
  onOpen,
  onEdit,
  onDelete,
  canEdit,
}: {
  file: FileCardData;
  onOpen: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  canEdit: boolean;
}) {
  const Icon = fileIcon(file.mimeType);
  const casual = file.classificationLane === "casual";
  return (
    <div
      className={`rounded-lg border p-3 flex flex-col gap-2 transition-all hover:border-strong ${
        casual
          ? "border-default bg-white/[0.01]"
          : "border-ember-400/30 bg-ember-400/[0.03]"
      }`}
    >
      <div className="flex items-start gap-2.5 cursor-pointer" onClick={onOpen}>
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
          <p
            className="text-sm font-medium text-primary truncate"
            title={file.title}
          >
            {file.title}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="text-[10px] uppercase tracking-widest text-muted">
              {file.classificationLane}
            </span>
            <span className="text-muted text-[10px]">·</span>
            <span className="text-[10px] text-muted">
              {humanSize(file.sizeBytes)}
            </span>
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
        </div>
      </div>
      {file.description && (
        <p className="text-[11px] text-secondary line-clamp-2">
          {file.description}
        </p>
      )}
      {!casual && (
        <div className="flex items-start gap-1 flex-wrap">
          {(file.departmentNames ?? []).map((d) => (
            <span
              key={d}
              className="text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border border-ember-400/30 text-brand bg-ember-400/[0.06]"
            >
              {d}
            </span>
          ))}
          {(file.taskTitles ?? []).slice(0, 2).map((t) => (
            <span
              key={t}
              className="text-[10px] text-secondary px-1.5 py-0.5 rounded border border-default truncate max-w-[160px]"
            >
              {t}
            </span>
          ))}
          {file.tags.slice(0, 3).map((tg) => (
            <span
              key={tg}
              className="text-[10px] text-muted px-1.5 py-0.5 rounded bg-surface"
            >
              #{tg}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-default/50">
        <div className="text-[10px] text-muted">
          {file.uploaderName ?? "Unknown"} ·{" "}
          {new Date(file.createdAt).toLocaleDateString()}
        </div>
        <LearningHint
          as="inline-block"
          category="Files · File actions"
          title="File actions"
          whatItIs="Per-file controls: open/download, edit classification, and delete. The card above shows the file's lane, size, access, and its department, task, and tag chips at a glance."
          why="Editing classification after the fact is how a casual file gets promoted to a real asset, and how a mis-filed one gets corrected — the gate isn't a one-shot at upload. Delete is a soft-delete; the record is preserved for the event history."
          how="Download to open, the pencil to reclassify, the trash to deprecate. Reclassify anything that landed casual but turned out worth keeping."
          principle="Classification is editable — a file's asset value can be recognized late."
        >
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpen}
            aria-label="Open / download"
            title="Open / download"
            className="text-muted hover:text-primary p-1 rounded hover:bg-white/[0.04]"
          >
            <Download className="w-3.5 h-3.5" aria-hidden />
          </button>
          {canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              aria-label="Edit classification"
              title="Edit classification"
              className="text-muted hover:text-primary p-1 rounded hover:bg-white/[0.04]"
            >
              <Pencil className="w-3.5 h-3.5" aria-hidden />
            </button>
          )}
          {canEdit && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete file"
              title="Delete file"
              className="text-muted hover:text-red-300 p-1 rounded hover:bg-white/[0.04]"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden />
            </button>
          )}
        </div>
        </LearningHint>
      </div>
    </div>
  );
}
