import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/rcd/[id] — one captured RCD conversation: its messages in order, each with its
 * media. Media BYTES live in the private care-rcd-media bucket; we return a short-lived SIGNED
 * download URL per media (never a public URL — the bucket is private, PII). Spec:
 * docs/feature-specs/RCD-RAW-CONVERSATION-DATA.md.
 *
 * Session-authed; the RLS SELECT policy (0194) + an explicit company match scope everything to the
 * caller's tenant. A cross-tenant id returns 404 (the RLS read yields nothing). DEGRADE (A34): a
 * missing table (0194 unapplied) surfaces as 404, not a 500.
 */

export const runtime = "nodejs";

const BUCKET = "care-rcd-media";
const SIGNED_TTL = 300; // seconds — long enough to render the panel; re-fetch to refresh

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const { id } = await context.params;

  const { data: conv, error: convErr } = await auth.sb
    .from("care_rcd_conversations")
    .select("id, channel, source_url, message_count, captured_at, captured_by")
    .eq("id", id)
    .maybeSingle();
  if (convErr || !conv) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const [{ data: messages }, { data: media }] = await Promise.all([
    auth.sb
      .from("care_rcd_messages")
      .select("id, seq, role, sender, body")
      .eq("conversation_id", id)
      .order("seq", { ascending: true }),
    auth.sb
      .from("care_rcd_media")
      .select("id, message_id, media_type, storage_path, filename, alt, content_type, byte_size")
      .eq("conversation_id", id),
  ]);

  // Sign all media paths in ONE batch round-trip (createSignedUrls), not N sequential ones — until
  // Phase 2c lands, EVERY media is byte-less, so a per-media loop would be N failing storage calls on
  // every conversation view. A missing object / failed sign yields url:null → the panel shows the
  // filename placeholder rather than a broken image (§3.4 degrade).
  const mediaList = media ?? [];
  const signedByPath = new Map<string, string>();
  if (mediaList.length > 0) {
    try {
      const paths = mediaList.map((m) => m.storage_path as string);
      const { data: signedArr } = await auth.sb.storage.from(BUCKET).createSignedUrls(paths, SIGNED_TTL);
      for (const s of signedArr ?? []) {
        if (s && !s.error && s.signedUrl && s.path) signedByPath.set(s.path, s.signedUrl);
      }
    } catch {
      /* leave all urls null → placeholders */
    }
  }

  const mediaByMessage = new Map<string, Array<Record<string, unknown>>>();
  for (const m of mediaList) {
    const list = mediaByMessage.get(m.message_id as string) ?? [];
    list.push({
      id: m.id,
      type: m.media_type,
      filename: m.filename,
      alt: m.alt,
      contentType: m.content_type,
      byteSize: m.byte_size,
      url: signedByPath.get(m.storage_path as string) ?? null,
    });
    mediaByMessage.set(m.message_id as string, list);
  }

  const withMedia = (messages ?? []).map((msg) => ({
    id: msg.id,
    seq: msg.seq,
    role: msg.role,
    sender: msg.sender,
    body: msg.body,
    media: mediaByMessage.get(msg.id as string) ?? [],
  }));

  return NextResponse.json({ conversation: conv, messages: withMedia });
}
