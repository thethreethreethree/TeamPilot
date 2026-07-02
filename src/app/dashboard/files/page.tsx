"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { FileDropzone } from "@/components/files/FileDropzone";
import { createClient } from "@/lib/supabase/client";
import { FileCard, type FileCardData } from "@/components/files/FileCard";
import {
  ClassificationModal,
  type ClassificationDept,
  type ClassificationTask,
  type ClassificationPerson,
  type ClassificationDraft,
} from "@/components/files/ClassificationModal";
import { FolderTree } from "@/components/files/FolderTree";
import { useToast } from "@/components/ui/toast";
import { Loader2, Search } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

type ApiFile = {
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
  departmentIds: string[];
  taskIds: string[];
  tags: string[];
  storagePath: string;
};

type CasualSnap = { today: number; cap: number; remaining: number };

export default function FilesLibraryPage() {
  const companyName = useCompanyName();
  const [files, setFiles] = useState<ApiFile[]>([]);
  const [departments, setDepartments] = useState<ClassificationDept[]>([]);
  const [tasks, setTasks] = useState<ClassificationTask[]>([]);
  const [team, setTeam] = useState<ClassificationPerson[]>([]);
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [taskFilter, setTaskFilter] = useState<string>("");
  const [laneFilter, setLaneFilter] = useState<"" | "classified" | "casual">("");
  const [loading, setLoading] = useState(true);
  const [casual, setCasual] = useState<CasualSnap>({ today: 0, cap: 3, remaining: 3 });
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  // Pre-upload classify (2026-06-26 audit Finding B): the picked file is
  // held here while the classify-before-upload modal collects fields,
  // then uploaded WITH classification so it lands classified and never
  // burns the casual cap.
  // A batch (1 file, many files, or a folder) held for shared classify-then-
  // upload. Each file uploads DIRECT to storage via a signed URL (large-file
  // fix), then its record is created with the shared classification.
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const toast = useToast();

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (departmentFilter) params.set("department", departmentFilter);
    if (taskFilter) params.set("task", taskFilter);
    if (laneFilter) params.set("lane", laneFilter);
    try {
      const [filesRes, depsRes, tasksRes, teamRes] = await Promise.all([
        fetch(`/api/files?${params.toString()}`),
        fetch("/api/departments"),
        fetch("/api/tasks"),
        fetch("/api/team"),
      ]);
      if (filesRes.ok) {
        const data = await filesRes.json();
        setFiles(data.files ?? []);
        setCasual(data.casual ?? { today: 0, cap: 3, remaining: 3 });
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
      if (teamRes.ok) {
        const data = await teamRes.json();
        setTeam(
          (data.members ?? []).map(
            (m: { id: string; full_name: string | null; fullName?: string | null }) => ({
              id: m.id,
              fullName: m.fullName ?? m.full_name ?? null,
            })
          )
        );
      }
    } finally {
      setLoading(false);
    }
  }, [search, departmentFilter, taskFilter, laneFilter]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Upload the held file WITH the classification collected by the
  // pre-upload modal. Providing department + task + description means
  // the server skips the casual lane entirely — so a classified upload
  // never counts against (or is blocked by) the 3/day casual cap.
  // Throws on failure so the modal surfaces the error inline.
  const uploadDraft = async (draft: ClassificationDraft) => {
    if (pendingFiles.length === 0) return;
    const supabase = createClient();
    const batch = pendingFiles.length > 1;
    let uploaded = 0;
    // Throws on the first failure so the modal surfaces it inline; files
    // already uploaded before the failure are kept (partial success).
    for (const file of pendingFiles) {
      // Skip genuinely empty / system entries (folders often carry 0-byte
      // placeholders) — they can't be uploaded and would fail the batch.
      if (file.size <= 0) continue;
      // 1. Mint a signed upload target (validates size/type up front).
      const urlRes = await fetch("/api/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
        }),
      });
      if (!urlRes.ok) {
        const d = await urlRes.json().catch(() => null);
        throw new Error(d?.error ?? `Couldn't start "${file.name}" (${urlRes.status}).`);
      }
      const { bucket, storagePath, token } = await urlRes.json();
      // 2. Upload the bytes DIRECT to storage (bypasses the 4.5MB function cap).
      const { error: upErr } = await supabase.storage
        .from(bucket)
        .uploadToSignedUrl(storagePath, token, file);
      if (upErr) {
        throw new Error(`Storage upload failed for "${file.name}": ${upErr.message}`);
      }
      // 3. Create the record with the SHARED classification. In a batch each
      //    file keeps its own filename as its title.
      const metaRes = await fetch("/api/files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storagePath,
          originalFilename: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "application/octet-stream",
          title: batch ? file.name : draft.title || file.name,
          description: draft.description || undefined,
          department_ids: draft.departmentIds,
          task_ids: draft.taskIds,
          tags: draft.tags,
          access_role: draft.accessRole,
        }),
      });
      if (!metaRes.ok) {
        const d = await metaRes.json().catch(() => null);
        throw new Error(d?.error ?? `Save failed for "${file.name}" (${metaRes.status}).`);
      }
      uploaded += 1;
    }
    if (uploaded === 0) {
      throw new Error("No uploadable files — the selection was empty or 0-byte.");
    }
    const classified =
      draft.departmentIds.length > 0 &&
      draft.taskIds.length > 0 &&
      draft.description.trim().length > 0;
    toast.success(
      uploaded > 1 ? `Uploaded ${uploaded} files` : "Uploaded",
      classified ? "Classified — team assets now." : "Uploaded as casual."
    );
    await refresh();
  };

  const cardData = useMemo<FileCardData[]>(
    () =>
      files.map((f) => ({
        id: f.id,
        title: f.title,
        description: f.description,
        mimeType: f.mimeType,
        sizeBytes: f.sizeBytes,
        classificationLane: f.classificationLane,
        accessRole: f.accessRole,
        uploaderId: f.uploaderId,
        // Audit M2: the server now resolves the uploader name
        // (listFiles joins profiles), so every card shows it — including
        // departed members. Fall back to the team list only if the
        // server value is absent (older cached responses).
        uploaderName:
          f.uploaderName ??
          team.find((m) => m.id === f.uploaderId)?.fullName ??
          null,
        createdAt: f.createdAt,
        departmentNames: f.departmentIds
          .map((id) => departments.find((d) => d.id === id)?.name)
          .filter(Boolean) as string[],
        taskTitles: f.taskIds
          .map((id) => tasks.find((t) => t.id === id)?.title)
          .filter(Boolean) as string[],
        tags: f.tags,
      })),
    [files, departments, tasks, team]
  );

  const openFile = async (id: string) => {
    // Audit Finding D: surface failures instead of silently returning
    // (same silent-failure class as the delete bug).
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

  const deleteFile = async (id: string) => {
    if (!confirm("Deprecate this file? Soft-delete; the row is preserved for §3.1 record.")) {
      return;
    }
    // Per the 2026-06-26 audit (Finding A): check the response. The
    // prior code ignored it, so a failed delete (route error) looked
    // identical to success — the file just stayed and the user saw
    // nothing. Surface the real error now.
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      toast.error("Couldn't delete", data?.error ?? "Please try again.");
      return;
    }
    toast.success("Deleted", "File deprecated and removed from the library.");
    await refresh();
  };

  return (
    <>
      <TopBar
        title="Files · Asset library"
        subtitle={`${companyName ?? "Your team"} · §3.1 chain applied to assets`}
      />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-6xl mx-auto w-full">
        <LearningHint
          as="block"
          category="Files · §A6"
          title="Asset library"
          whatItIs="Every file uploaded by anyone on the team lands here. Classification fields (department + task + description) are the §3.2 Understanding Gate applied to assets — files with all three become 'classified' and team-searchable; files missing any one become 'casual' and count toward your 3/day cap."
          why="A file storage layer without a gate produces a file graveyard — most files uploaded once, never retrieved, never cited. The gate is the structural defense; the casual escape hatch is the honest acknowledgment that not all sharing has asset value."
          how="Drop a file or click to upload. Classify it (or accept the casual lane). Use the filters to find what the team already built up. Click a card to download."
          principle="The 3 fields are not metadata. They ARE the team's asset memory."
        >
          <div className="mb-6">
            <FileDropzone onFilesSelected={(files) => setPendingFiles(files)} />
          </div>
        </LearningHint>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2"
              aria-hidden
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title or description…"
              className="w-full bg-surface border border-default rounded-md pl-7 pr-2 py-1.5 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-strong"
            />
          </div>
          <span className="text-[11px] text-muted ml-auto">
            Casual today: <span className="text-brand font-semibold">{casual.today}</span>/
            {casual.cap}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
          {/* Folder tree — auto-derived from classification.
              Per founder Q1 = (a): the 3 fields ARE the folders. */}
          <aside className="rounded-lg border border-default p-2 bg-white/[0.01] h-fit max-h-[70vh] overflow-y-auto">
            <FolderTree
              files={files.map((f) => ({
                id: f.id,
                classificationLane: f.classificationLane,
                departmentIds: f.departmentIds,
                taskIds: f.taskIds,
              }))}
              departments={departments}
              tasks={tasks}
              selectedDepartmentId={departmentFilter}
              selectedTaskId={taskFilter}
              selectedLane={laneFilter}
              onSelectDepartment={(id) => {
                setDepartmentFilter(id);
                setLaneFilter("");
              }}
              onSelectTask={(id) => {
                setTaskFilter(id);
                setLaneFilter("");
              }}
              onSelectLane={(lane) => {
                setLaneFilter(lane);
                setDepartmentFilter("");
                setTaskFilter("");
              }}
            />
          </aside>

          <div>
            {loading ? (
              <div className="flex items-center justify-center py-16 text-muted text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />
                Loading files…
              </div>
            ) : cardData.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-sm text-primary mb-2">No assets yet.</p>
                <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                  Drop a file above to start building the team&apos;s asset base. The
                  files you classify now become the answers your team will find next
                  month. Empty libraries don&apos;t teach anyone anything.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cardData.map((f) => (
                  <FileCard
                    key={f.id}
                    file={f}
                    onOpen={() => openFile(f.id)}
                    onEdit={() => setClassifyingId(f.id)}
                    onDelete={() => deleteFile(f.id)}
                    canEdit={true}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {classifyingId && (() => {
        const file = files.find((f) => f.id === classifyingId);
        if (!file) return null;
        return (
          <ClassificationModal
            open
            onClose={() => setClassifyingId(null)}
            fileId={file.id}
            initial={{
              title: file.title,
              description: file.description ?? "",
              departmentIds: file.departmentIds,
              taskIds: file.taskIds,
              tags: file.tags,
              accessRole: file.accessRole,
            }}
            departments={departments}
            tasks={tasks}
            teamMembers={team}
            onSaved={() => {
              setClassifyingId(null);
              void refresh();
            }}
            casualRemaining={casual.remaining}
          />
        );
      })()}

      {/* Pre-upload classify (audit Finding B). The picked file is held
          in pendingFile; this modal collects classification BEFORE the
          upload, so a classified file never burns the casual cap and a
          capped user is never dead-ended. onSubmitDraft does the upload. */}
      {pendingFiles.length > 0 && (
        <ClassificationModal
          open
          onClose={() => setPendingFiles([])}
          initial={{
            title:
              pendingFiles.length === 1
                ? (pendingFiles[0]?.name.replace(/\.[^.]+$/, "") ?? "")
                : "",
          }}
          batchCount={pendingFiles.length}
          departments={departments}
          tasks={tasks}
          teamMembers={team}
          onSaved={() => {}}
          casualRemaining={casual.remaining}
          onSubmitDraft={uploadDraft}
        />
      )}
    </>
  );
}
