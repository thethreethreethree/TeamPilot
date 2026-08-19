/**
 * Schedule Management System — the schedule_employee row shape + column list + mapper, shared by the roster
 * routes (list/create and the [id] update). One source so the DB column set + the row→Employee mapping can't
 * drift between the routes that read and write staff.
 */
import type { Employee } from "./types";

export type EmployeeRow = {
  id: string;
  company_id: string;
  name: string;
  role: string | null;
  employment_type: string | null;
  skills: string[] | null;
  certifications: string[] | null;
  max_hours_week: number | null;
  min_hours_week: number | null;
  status: string;
};

/** The column list to select for a full Employee. */
export const EMPLOYEE_COLUMNS =
  "id, company_id, name, role, employment_type, skills, certifications, max_hours_week, min_hours_week, status";

export function rowToEmployee(r: EmployeeRow): Employee {
  return {
    id: r.id,
    companyId: r.company_id,
    name: r.name,
    role: r.role,
    employmentType: r.employment_type,
    skills: r.skills ?? [],
    certifications: r.certifications ?? [],
    maxHoursWeek: r.max_hours_week,
    minHoursWeek: r.min_hours_week,
    status: r.status === "inactive" ? "inactive" : "active",
  };
}
