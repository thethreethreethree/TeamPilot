"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { FileDropzone, type UploadResult } from "@/components/files/FileDropzone";
import { FileCard, type FileCardData } from "@/components/files/FileCard";
import {
  ClassificationModal,
  type ClassificationDept,
  type ClassificationTask,
  type ClassificationPerson,
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

  const onUploadComplete = (result: UploadResult) => {
    if (result.ok && result.file) {
      setClassifyingId(result.file.id as string);
      void refresh();
    }
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
        createdAt: f.createdAt,
        departmentNames: f.departmentIds
          .map((id) => departments.find((d) => d.id === id)?.name)
          .filter(Boolean) as string[],
        taskTitles: f.taskIds
          .map((id) => tasks.find((t) => t.id === id)?.title)
          .filter(Boolean) as string[],
        tags: f.tags,
      })),
    [files, departments, tasks]
  );

  const openFile = async (id: string) => {
    const res = await fetch(`/api/files/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.downloadUrl) {
      window.open(data.downloadUrl, "_blank", "noopener");
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
            <FileDropzone onUploadComplete={onUploadComplete} />
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
    </>
  );
}
