"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { FileDropzone } from "./FileDropzone";
import { FileCard, type FileCardData } from "./FileCard";
import {
  ClassificationModal,
  type ClassificationDept,
  type ClassificationTask,
  type ClassificationDraft,
} from "./ClassificationModal";
import { useToast } from "@/components/ui/toast";

/**
 * Asset System v1 — Tasks integration.
 *
 * Per AMD-006 §1.5.1 layer 3 (composition): the user is in
 * the task context. The dropzone here pre-fills the
 * classification modal with THIS task as the related task —
 * the user doesn't have to re-pick what's already obvious.
 *
 * 2026-06-26 (AMD-006 re-application): the upload now CLASSIFIES
 * BEFORE uploading — the classify modal opens on file-pick with
 * this task pre-filled, the user adds a department + description,
 * and the file uploads classified. Previously the file uploaded
 * first and landed casual (no description), which tripped the
 * 3/day casual cap and DEAD-ENDED the user with no way to enter
 * the information — a layer-2 (effectivity) + layer-3
 * (composition) failure. The cap was never the bug; the upload
 * not letting the user classify was.
 */

type ApiFile = {
  id: string;
  title: string;
  description: string | null;
  mimeType: string;
  sizeBytes: number;
  classificationLane: "classified" | "casual";
  accessRole: "everyone" | "admins" | "ceo_admins" | "specific_people";
  uploaderId: string | null;
  createdAt: string;
  departmentIds: string[];
  taskIds: string[];
  tags: string[];
};

export function TaskAssetsSection({
  taskId,
  taskTitle,
}: {
  taskId: string;
  taskTitle: string;
}) {
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [departments, setDepartments] = useState<ClassificationDept[]>([]);
  const [tasks, setTasks] = useState<ClassificationTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [casualRemaining, setCasualRemaining] = useState(3);
  const toast = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [filesRes, depsRes, tasksRes] = await Promise.all([
        fetch(`/api/files?task=${taskId}`),
        fetch("/api/departments"),
        fetch("/api/tasks"),
      ]);
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.files ?? []);
        setCasualRemaining(data.casual?.remaining ?? 3);
      }
      if (depsRes.ok) {
        const data = await depsRes.json();
        setDepartments(
          (data.departments ?? []).map((d: { id: string; name: string }) => ({
            id: d.id,
            name: d.name,
          }))
        );
      }
      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(
          (data.tasks ?? []).map((t: { id: string; title: string }) => ({
            id: t.id,
            title: t.title,
          }))
        );
      }
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Upload the held file WITH the classification collected by the
  // pre-upload modal. This task is always included in the task_ids
  // so the file links to it; providing department + description
  // makes it classified, so it never falls into casual / trips the
  // cap. Throws on failure so the modal surfaces the error inline.
  const uploadDraft = async (draft: ClassificationDraft) => {
    if (!pendingFile) return;
    const taskIds = draft.taskIds.includes(taskId)
      ? draft.taskIds
      : [taskId, ...draft.taskIds];
    const form = new FormData();
    form.append("file", pendingFile);
    form.append("title", draft.title || pendingFile.name);
    form.append("linked_task_id", taskId);
    form.append("task_ids", taskIds.join(","));
    if (draft.description) form.append("description", draft.description);
    if (draft.departmentIds.length)
      form.append("department_ids", draft.departmentIds.join(","));
    if (draft.tags.length) form.append("tags", draft.tags.join(","));
    form.append("access_role", draft.accessRole);
    const res = await fetch("/api/files", { method: "POST", body: form });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw new Error(data?.error ?? `Upload failed (${res.status}).`);
    }
    const classified =
      draft.departmentIds.length > 0 && draft.description.trim().length > 0;
    toast.success(
      "Attached",
      classified
        ? "Classified — it's a team asset now."
        : "Attached to the task (casual)."
    );
    await refresh();
  };

  const openFile = async (id: string) => {
    const res = await fetch(`/api/files/${id}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error("Couldn't open file", data?.error ?? "Please try again.");
      return;
    }
    const data = await res.json();
    if (data.downloadUrl) {
      window.open(data.downloadUrl, "_blank", "noopener");
    } else {
      toast.error("Couldn't open file", "No download link was returned.");
    }
  };

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <FolderOpen className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h3 className="text-xs font-semibold text-primary">
          Assets ({files.length})
        </h3>
      </div>

      <FileDropzone
        compact
        contextHint="Drop a file — you'll add a department + description so it becomes a searchable team asset on this task."
        linkedTaskId={taskId}
        onFileSelected={(f) => setPendingFile(f)}
      />

      {loading ? (
        <div className="flex items-center justify-center py-6 text-muted text-xs">
          <Loader2 className="w-3 h-3 animate-spin mr-1.5" aria-hidden />
          Loading…
        </div>
      ) : files.length === 0 ? (
        <p className="text-[11px] text-muted text-center py-3 mt-2">
          No files attached yet.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {files.map((f) => (
            <FileCard
              key={f.id}
              file={{
                id: f.id,
                title: f.title,
                description: f.description,
                mimeType: f.mimeType,
                sizeBytes: f.sizeBytes,
                classificationLane: f.classificationLane,
                accessRole: f.accessRole,
                uploaderId: f.uploaderId,
                createdAt: f.createdAt,
                departmentNames: f.departmentIds
                  .map((id) => departments.find((d) => d.id === id)?.name)
                  .filter(Boolean) as string[],
                taskTitles: f.taskIds
                  .map((id) => tasks.find((t) => t.id === id)?.title)
                  .filter(Boolean) as string[],
                tags: f.tags,
              }}
              onOpen={() => openFile(f.id)}
              onEdit={() => setClassifyingId(f.id)}
              canEdit
            />
          ))}
        </div>
      )}

      {classifyingId && (() => {
        const f = files.find((x) => x.id === classifyingId);
        if (!f) return null;
        return (
          <ClassificationModal
            open
            onClose={() => setClassifyingId(null)}
            fileId={f.id}
            initial={{
              title: f.title,
              description: f.description ?? "",
              departmentIds: f.departmentIds,
              taskIds: f.taskIds.includes(taskId)
                ? f.taskIds
                : [taskId, ...f.taskIds],
              tags: f.tags,
              accessRole: f.accessRole,
            }}
            departments={departments}
            tasks={tasks}
            onSaved={() => {
              setClassifyingId(null);
              void refresh();
            }}
            casualRemaining={casualRemaining}
          />
        );
      })()}

      {/* Pre-upload classify (AMD-006 re-application). The picked file
          is held in pendingFile; the modal — pre-filled with THIS task
          — collects department + description BEFORE upload so the file
          lands classified and never trips the casual cap. */}
      {pendingFile && (
        <ClassificationModal
          open
          onClose={() => setPendingFile(null)}
          initial={{
            title: pendingFile.name.replace(/\.[^.]+$/, ""),
            taskIds: [taskId],
          }}
          departments={departments}
          tasks={tasks}
          onSaved={() => {}}
          casualRemaining={casualRemaining}
          onSubmitDraft={uploadDraft}
        />
      )}
    </div>
  );
}
