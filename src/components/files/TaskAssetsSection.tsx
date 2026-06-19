"use client";

import { useCallback, useEffect, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { FileDropzone, type UploadResult } from "./FileDropzone";
import { FileCard, type FileCardData } from "./FileCard";
import {
  ClassificationModal,
  type ClassificationDept,
  type ClassificationTask,
} from "./ClassificationModal";

/**
 * Asset System v1 — Tasks integration.
 *
 * Per AMD-006 §1.5.1 layer 3 (composition): the user is in
 * the task context. The dropzone here pre-fills the
 * classification modal with THIS task as the related task —
 * the user doesn't have to re-pick what's already obvious.
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
  const [casualRemaining, setCasualRemaining] = useState(3);

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

  const onUploadComplete = async (result: UploadResult) => {
    if (result.ok && result.file) {
      // Auto-attach the file to this task before opening
      // the classification modal so even if the user
      // dismisses, the task link is preserved.
      await fetch(`/api/files/${result.file.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: result.file.title,
          taskIds: [taskId],
        }),
      });
      setClassifyingId(result.file.id as string);
      void refresh();
    }
  };

  const openFile = async (id: string) => {
    const res = await fetch(`/api/files/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.downloadUrl) {
      window.open(data.downloadUrl, "_blank", "noopener");
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
        contextHint="Attached files auto-link to this task. Add a description + department to classify them as team assets."
        onUploadComplete={onUploadComplete}
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
    </div>
  );
}
