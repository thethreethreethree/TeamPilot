"use client";

import { TrainingManager } from "@/components/sales-coach/TrainingManager";
import { AssignedPractice } from "@/components/sales-coach/AssignedPractice";
import { AssignedCourses } from "@/components/sales-coach/AssignedCourses";
import { CourseManager } from "@/components/sales-coach/CourseManager";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";

/**
 * Remote Sales → Training (plan Phase 7): managers turn a call into a scenario and assign it with a due date; reps
 * see "Assigned to you" and practise in the role-play screen. Placement only — D18 (Bootcamp or a Training tab) kept
 * the screen unplaced; the founder asked for the module to show every built part (2026-11-22), and moving it is one
 * import. Bootcamp is unchanged. Courses (2026-11-26, F17.1, 0355): reps see "Your courses" first; managers write and
 * assign them above the practice scenarios.
 */
export default function RemoteSalesTrainingPage() {
  const isManager = useIsSalesCoachManager();
  return (
    <div className="space-y-6">
      <AssignedCourses />
      <AssignedPractice />
      {isManager && <CourseManager />}
      {isManager && <TrainingManager />}
    </div>
  );
}
