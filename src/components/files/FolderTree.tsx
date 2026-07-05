"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ListChecks,
} from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * Auto-folder navigation derived from classification.
 *
 * Per founder Q1 = (a) Auto-folder by classification:
 * the 3 classification fields ARE the folders. No user-created
 * folders for v1. The hierarchy is:
 *
 *   Department/
 *     Task or "Unfiled"/
 *       (files matching both)
 *
 * Casual files live under "Casual (unclassified)".
 *
 * Per CLAUDE.md §1.5 holistic: the tree is a VIEW on the
 * existing data, not a separate storage layer. Clicking a node
 * filters the parent files list — no row movement, no folder
 * row, no drag-and-drop reorganization. The classification is
 * the truth.
 */

export type FolderTreeFile = {
  id: string;
  classificationLane: "classified" | "casual";
  departmentIds: string[];
  taskIds: string[];
};

export function FolderTree({
  files,
  departments,
  tasks,
  selectedDepartmentId,
  selectedTaskId,
  selectedLane,
  onSelectDepartment,
  onSelectTask,
  onSelectLane,
}: {
  files: FolderTreeFile[];
  departments: Array<{ id: string; name: string }>;
  tasks: Array<{ id: string; title: string }>;
  selectedDepartmentId: string;
  selectedTaskId: string;
  selectedLane: "" | "classified" | "casual";
  onSelectDepartment: (id: string) => void;
  onSelectTask: (id: string) => void;
  onSelectLane: (lane: "" | "classified" | "casual") => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const counts = useMemo(() => {
    const byDept = new Map<string, number>();
    const byDeptTask = new Map<string, number>(); // key: `${deptId}|${taskId}`
    let casual = 0;
    for (const f of files) {
      if (f.classificationLane === "casual") casual++;
      for (const d of f.departmentIds) {
        byDept.set(d, (byDept.get(d) ?? 0) + 1);
        for (const t of f.taskIds) {
          const key = `${d}|${t}`;
          byDeptTask.set(key, (byDeptTask.get(key) ?? 0) + 1);
        }
      }
    }
    return { byDept, byDeptTask, casual };
  }, [files]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <LearningHint
      as="block"
      category="Files · Navigation"
      title="Folder tree"
      whatItIs="A browsable tree derived entirely from classification: lane at the top, then Department › Task. Clicking a node filters the file list; nothing is moved or stored separately."
      why="The folders aren't a second place files live — they're a live view of the three classification fields. That's why classifying well is what makes browsing work; there are no manual folders to keep tidy."
      how="Click 'All files' or 'Casual' to filter by lane, or expand a department and pick a task to narrow down. The counts show how many files sit under each node."
      principle="Good classification IS good navigation — the tree only reflects it."
    >
    <div className="space-y-0.5 text-sm">
      {/* Lane filters at the top */}
      <button
        type="button"
        onClick={() => onSelectLane("")}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
          selectedLane === "" && !selectedDepartmentId && !selectedTaskId
            ? "bg-ember-400/10 text-brand"
            : "text-secondary hover:bg-white/[0.03]"
        }`}
      >
        <FolderOpen className="w-3.5 h-3.5" aria-hidden />
        All files
        <span className="ml-auto text-[10px] text-muted">{files.length}</span>
      </button>
      <button
        type="button"
        onClick={() => onSelectLane("casual")}
        className={`w-full flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
          selectedLane === "casual"
            ? "bg-ember-400/10 text-brand"
            : "text-secondary hover:bg-white/[0.03]"
        }`}
      >
        <FolderOpen className="w-3.5 h-3.5" aria-hidden />
        Casual (unclassified)
        <span className="ml-auto text-[10px] text-muted">{counts.casual}</span>
      </button>

      {/* Department tree */}
      <div className="pt-2 border-t border-default mt-2">
        <p className="text-[10px] uppercase tracking-widest text-muted px-2 py-1 font-bold">
          By department
        </p>
        {departments.length === 0 ? (
          <p className="text-[11px] text-muted italic px-2">
            No departments yet.
          </p>
        ) : (
          departments.map((d) => {
            const open = expanded.has(d.id);
            const count = counts.byDept.get(d.id) ?? 0;
            const isSelected =
              selectedDepartmentId === d.id && !selectedTaskId;
            return (
              <div key={d.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelectDepartment(d.id);
                    onSelectTask("");
                    toggle(d.id);
                  }}
                  className={`w-full flex items-center gap-1 px-2 py-1 rounded text-xs ${
                    isSelected
                      ? "bg-ember-400/10 text-brand"
                      : "text-secondary hover:bg-white/[0.03]"
                  }`}
                >
                  {open ? (
                    <ChevronDown className="w-3 h-3" aria-hidden />
                  ) : (
                    <ChevronRight className="w-3 h-3" aria-hidden />
                  )}
                  <Building2 className="w-3.5 h-3.5" aria-hidden />
                  <span className="truncate flex-1 text-left">{d.name}</span>
                  <span className="text-[10px] text-muted">{count}</span>
                </button>
                {open && (
                  <div className="pl-5 space-y-0.5">
                    {tasks.map((t) => {
                      const tcount =
                        counts.byDeptTask.get(`${d.id}|${t.id}`) ?? 0;
                      if (tcount === 0) return null;
                      const taskSelected =
                        selectedDepartmentId === d.id &&
                        selectedTaskId === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            onSelectDepartment(d.id);
                            onSelectTask(t.id);
                          }}
                          className={`w-full flex items-center gap-1 px-2 py-1 rounded text-xs ${
                            taskSelected
                              ? "bg-ember-400/10 text-brand"
                              : "text-secondary hover:bg-white/[0.03]"
                          }`}
                        >
                          <ListChecks className="w-3 h-3" aria-hidden />
                          <span className="truncate flex-1 text-left">
                            {t.title}
                          </span>
                          <span className="text-[10px] text-muted">
                            {tcount}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
    </LearningHint>
  );
}
