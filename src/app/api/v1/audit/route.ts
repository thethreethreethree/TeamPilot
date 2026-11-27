import { readResource } from "@/lib/api/publicApiRead";

/**
 * GET /api/v1/audit — the company's audit log, newest first (0284; Gong F31.5). Key auth, company-pinned, paged
 * (?limit, ?page). Only while the key's maker is still a company admin (the audit log is theirs to read).
 */
export async function GET(req: Request) {
  return readResource(req, "audit");
}
