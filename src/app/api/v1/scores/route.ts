import { readResource } from "@/lib/api/publicApiRead";

/** GET /api/v1/scores — the public read API (Engage plan E13; Gong F15.19). Key auth ("read"), company-pinned. */
export async function GET(req: Request) {
  return readResource(req, "scores");
}
