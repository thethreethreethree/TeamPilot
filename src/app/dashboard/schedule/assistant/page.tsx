"use client";

import Link from "next/link";
import { Sparkles, Upload, CalendarDays } from "lucide-react";
import { ScheduleNav } from "@/components/schedule/ScheduleNav";
import { AssistantPanel } from "@/components/schedule/AssistantPanel";

/**
 * Schedule Management System — the conversational AI assistant tab (headline feature). Thin page wrapper: the
 * chat + command box live in the reusable <AssistantPanel/> (also embedded in the Import flow), so there is
 * ONE assistant, not two. Manager-only (the schedule layout gate + the route enforce it).
 */
export default function ScheduleAssistantPage() {
  return (
    <div className="flex-1 min-h-0 flex flex-col bg-base px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 max-w-3xl mx-auto w-full">
      <ScheduleNav />
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-6 h-6 text-brand" aria-hidden />
        <h1 className="text-xl font-bold text-primary">AI Assistant</h1>
      </div>
      <p className="text-xs text-muted mb-3">
        Tell me how to arrange the schedule in plain language, or ask about it. I&apos;ll propose the changes for you to confirm.{" "}
        <Link href="/dashboard/schedule/import" className="text-brand hover:underline inline-flex items-center gap-1"><Upload className="w-3 h-3" aria-hidden />Import a file</Link>
        {" · "}
        <Link href="/dashboard/schedule/grid" className="text-brand hover:underline inline-flex items-center gap-1"><CalendarDays className="w-3 h-3" aria-hidden />View the schedule</Link>
      </p>
      <AssistantPanel variant="full" />
    </div>
  );
}
