import { readResource } from "@/lib/api/publicApiRead";

/** GET /api/v1/calls — the public read API (Engage plan E3, 0378; Gong M31). Key auth, company-pinned, paged (?limit, ?page). */
export async function GET(req: Request) {
  return readResource(req, "calls");
}
