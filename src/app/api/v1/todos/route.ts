import { readResource } from "@/lib/api/publicApiRead";

/** GET /api/v1/todos — the public read API (Engage plan E16; Gong F31.3 / F24.7). Key auth ("read"), company-pinned. */
export async function GET(req: Request) {
  return readResource(req, "todos");
}
