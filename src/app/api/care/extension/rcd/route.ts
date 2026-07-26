import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/care/extension/rcd — ingest RAW CONVERSATION DATA (RCD) captured by the C.A.R.E
 * browser extension from a third-party channel. Spec: docs/feature-specs/RCD-RAW-CONVERSATION-DATA.md.
 *
 * DESIGN (why JSON + signed upload URLs, not multipart bytes): Vercel serverless functions cap the
 * request body at ~4.5 MB. Media bytes cannot ride inside one request. So this route takes only the
 * STRUCTURE (text + per-message attribution + media METADATA) as small JSON, creates the rows, and
 * returns a SIGNED UPLOAD URL per media. The extension then PUTs each media's bytes DIRECTLY to the
 * private care-rcd-media bucket — bypassing the function-body limit entirely, and keeping the bytes
 * off our compute path. The extension downloads those bytes in its page context, where the customer's
 * session / blob: URL is still valid (RCD capture-audit finding #1).
 *
 * DATA GOVERNANCE: writes go through the service-role admin client, tenant-scoped by the AUTHED
 * agent's companyId (never a client-supplied id — same discipline as care_visitor_presence). The
 * bucket is private; source_url is stored as provenance only and never returned to a browser.
 *
 * GATES: guardExtensionRequest (per-IP flood guard → Bearer + entitlement → per-user rate limit →
 * strict schema). Content is immutable once written (§3.1 triggers, migration 0194).
 *
 * DEGRADE (A34): if 0194 isn't applied yet, the tables/bucket don't exist — we return 503 with a
 * clear reason rather than a 500, so the extension can surface "capture not enabled yet".
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const BUCKET = "care-rcd-media";
const MAX_TOTAL_MEDIA = 200; // bound per capture — a conversation shouldn't upload thousands of files

const MediaSchema = z.object({
  ref: z.string().min(1).max(40), // client-side handle so the extension knows which upload URL is which
  type: z.enum(["image", "file", "video", "audio"]),
  filename: z.string().max(300).optional().nullable(),
  alt: z.string().max(2000).optional().nullable(),
  contentType: z.string().max(200).optional().nullable(),
  sourceUrl: z.string().max(4000).optional().nullable(),
});

const MessageSchema = z.object({
  seq: z.number().int().min(0).max(100_000),
  role: z.enum(["agent", "customer", "unknown"]).default("unknown"),
  sender: z.string().max(300).optional().nullable(),
  text: z.string().max(20_000).default(""),
  media: z.array(MediaSchema).max(50).optional().default([]),
});

const Schema = z
  .object({
    channel: z.string().min(1).max(60),
    sourceUrl: z.string().max(4000).optional().nullable(),
    externalRef: z.string().max(400).optional().nullable(),
    messages: z.array(MessageSchema).min(1).max(500),
  })
  .strict();

/**
 * The 0194 migration hasn't been applied yet — the care_rcd_* tables don't exist. Postgres reports
 * this as 42P01 ("undefined_table"); PostgREST (Supabase's REST layer, which these writes go through)
 * reports it as PGRST205 with "Could not find the table '…' in the schema cache". Built NOT to depend
 * on the code being right (same discipline as isMissingColumnError): a known code OR the canonical
 * phrasing identifies it, so a wrong/missing code still degrades to the honest "apply the migration"
 * message instead of a generic 500.
 */
function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === "42P01" || e.code === "PGRST205") return true;
  return /relation ".*" does not exist|undefined table|schema cache|could not find the table/i.test(
    e.message ?? ""
  );
}

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "rcd", perUserMax: 30, schema: Schema });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  const totalMedia = body.messages.reduce((n, m) => n + (m.media?.length ?? 0), 0);
  if (totalMedia > MAX_TOTAL_MEDIA) {
    return NextResponse.json(
      { error: `Too many attachments in one capture (${totalMedia} > ${MAX_TOTAL_MEDIA}).` },
      { status: 413 }
    );
  }

  const admin = createAdminClient();

  try {
    // 1. Conversation row (service-role; company from the authed agent, never the client).
    const { data: conv, error: convErr } = await admin
      .from("care_rcd_conversations")
      .insert({
        company_id: user.companyId,
        channel: body.channel,
        source_url: body.sourceUrl ?? null,
        external_ref: body.externalRef ?? null,
        message_count: body.messages.length,
        captured_by: user.userId,
      })
      .select("id")
      .single();
    if (convErr || !conv) {
      if (isMissingTable(convErr)) {
        return NextResponse.json(
          { error: "RCD isn't enabled on this deployment yet (pending migration)." },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: "Couldn't start the capture." }, { status: 500 });
    }
    const conversationId = conv.id as string;

    // 2. Messages (bulk). Keep the returned ids aligned to seq so media attaches correctly.
    const { data: msgRows, error: msgErr } = await admin
      .from("care_rcd_messages")
      .insert(
        body.messages.map((m) => ({
          conversation_id: conversationId,
          company_id: user.companyId,
          seq: m.seq,
          role: m.role,
          sender: m.sender ?? null,
          body: m.text ?? "",
        }))
      )
      .select("id, seq");
    if (msgErr || !msgRows) {
      return NextResponse.json({ error: "Couldn't store the messages." }, { status: 500 });
    }
    const idBySeq = new Map<number, string>(msgRows.map((r) => [r.seq as number, r.id as string]));

    // 3. Media rows + a signed upload URL each. The extension PUTs bytes to signedUrl directly.
    const uploads: Array<{ ref: string; mediaId: string; path: string; signedUrl: string; token: string }> = [];
    for (const m of body.messages) {
      const messageId = idBySeq.get(m.seq);
      if (!messageId) continue;
      for (const media of m.media ?? []) {
        // Pre-generate the id so the deterministic storage path is known BEFORE insert — the row is
        // immutable (trigger), so storage_path must be correct on the first write, not patched later.
        const mediaId = crypto.randomUUID();
        const path = `${user.companyId}/${conversationId}/${mediaId}`;
        const { error: mediaErr } = await admin.from("care_rcd_media").insert({
          id: mediaId,
          message_id: messageId,
          conversation_id: conversationId,
          company_id: user.companyId,
          media_type: media.type,
          storage_path: path,
          filename: media.filename ?? null,
          alt: media.alt ?? null,
          content_type: media.contentType ?? null,
          source_url: media.sourceUrl ?? null,
        });
        if (mediaErr) continue; // best-effort: a failed media row doesn't sink the whole capture
        const { data: signed, error: signErr } = await admin.storage
          .from(BUCKET)
          .createSignedUploadUrl(path);
        if (signErr || !signed) continue;
        uploads.push({ ref: media.ref, mediaId, path, signedUrl: signed.signedUrl, token: signed.token });
      }
    }

    return NextResponse.json({ conversationId, uploads });
  } catch (err) {
    if (isMissingTable(err)) {
      return NextResponse.json(
        { error: "RCD isn't enabled on this deployment yet (pending migration)." },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: "Couldn't ingest the conversation." }, { status: 500 });
  }
}
