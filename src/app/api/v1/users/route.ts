import { readResource } from "@/lib/api/publicApiRead";

/** GET /api/v1/users — the public read API (Engage plan E7; Gong F31.2). Key auth ("read"), company-pinned. */
export async function GET(req: Request) {
  return readResource(req, "users");
}
