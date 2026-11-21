"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";

/**
 * "Assigned to you" — the practice scenarios a manager gave this rep, with due date and status in words (RSS Phase 7,
 * Gong F17.10). Each opens the role-play seeded with the scenario (?assignment=), and the attempt is recorded for the
 * rep and the manager. Renders nothing when there is nothing assigned (or before migration 0282).
 */
type Item = {
  id: string;
  dueAt: string;
  state: "due" | "overdue" | "attempted" | "passed" | "not_passed_yet";
  best: number | null;
  assignedByName: string | null;
  scenario: { title: string; channel: string; difficulty: string; pass_score: number | null } | null;
};
const STATE: Record<Item["state"], string> = {
  due: "Due",
  overdue: "Overdue",
  attempted: "Done",
  passed: "Passed",
  not_passed_yet: "Not passed yet",
};
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function AssignedPractice() {
  const [items, setItems] = useState<Item[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/coach/remote/assignments")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { available?: boolean; assignments?: Item[] } | null) => {
        if (live) setItems(j?.available ? (j.assignments ?? []) : []);
      })
      .catch(() => live && setItems([]));
    return () => {
      live = false;
    };
  }, []);
  if (!items || items.length === 0) return null;
  const open = items.filter((i) => i.state === "due" || i.state === "overdue" || i.state === "not_passed_yet");
  const done = items.filter((i) => !open.includes(i));
  return (
    <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Assigned to you">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <ClipboardList className="h-4 w-4 text-brand" aria-hidden /> Assigned to you
      </p>
      <ul className="space-y-1.5">
        {[...open, ...done].map((i) => (
          <li key={i.id} className="flex flex-wrap items-center gap-2 text-xs">
            <Link href={`/dashboard/remote-sales/practice?assignment=${i.id}`} className="font-semibold text-brand hover:underline">
              {i.scenario?.title ?? "Practice"}
            </Link>
            <span className="text-muted">
              {i.scenario ? `${i.scenario.channel === "in_person" ? "In person" : i.scenario.channel === "phone" ? "Phone" : "Video"} · ${i.scenario.difficulty}` : ""}
              {i.assignedByName ? ` · from ${i.assignedByName}` : ""}
            </span>
            <span className={`ml-auto ${i.state === "overdue" ? "font-semibold text-primary" : "text-secondary"}`}>
              {STATE[i.state]}
              {i.state === "due" || i.state === "overdue" ? ` ${when(i.dueAt)}` : ""}
              {i.best !== null ? ` · best ${i.best}/100` : ""}
              {i.scenario?.pass_score != null ? ` (pass ${i.scenario.pass_score})` : ""}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
