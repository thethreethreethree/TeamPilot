import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeNewConversation } from "@/lib/data/care";
import { getProductContextForTenant } from "@/lib/care/config";
import {
  buildCareSystemPrompt,
  buildCareUserMessage,
  detectHandoffSignal,
} from "@/lib/care/prompt";
import { generateCareReply } from "@/lib/claude";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/care/inbound/email
 *
 * Phase 4 commit 1 — inbound email ingestion endpoint.
 *
 * Constitutional sources:
 *   - §3.1 — every inbound email creates an append-only event.
 *     external_message_id dedup makes webhook retries §3.1-honest.
 *   - §A16 — composition from day one. The AI first-responder
 *     here is the SAME path as the widget. Coach grades email
 *     agent replies on the same rubric. Co-Pilot drafts email
 *     replies using the same precedent search.
 *   - §A14 — multi-state ingestion verified. Render branches:
 *     unknown tenant, known tenant + new thread, known tenant +
 *     existing thread, duplicate webhook retry. All four
 *     verified before this commit's claim of "shipped."
 *   - §A4 — provider choice (Postmark / SES / SendGrid) is an
 *     uncertainty deferred. This endpoint accepts the Postmark
 *     inbound webhook shape as the baseline because it's the
 *     cleanest schema; other providers can be adapted via a
 *     transform layer once the §4 readout names a preferred
 *     provider.
 *
 * Authentication:
 *   Webhook secret in the X-Care-Webhook-Secret header. Verified
 *   server-side against CARE_INBOUND_EMAIL_SECRET env var. The
 *   secret is set on the provider side when configuring the
 *   webhook URL.
 *
 * Postmark inbound webhook shape (the subset we read):
 *   {
 *     "MessageID": "uuid",
 *     "From": "customer@example.com",
 *     "FromName": "Jane Doe",
 *     "To": "t-abc123@care.elostate.com",
 *     "Subject": "Refund question",
 *     "TextBody": "Hi, I'd like a refund...",
 *     "Headers": [{"Name": "In-Reply-To", "Value": "<...>"},
 *                 {"Name": "References", "Value": "<...>"}],
 *     "MessageStream": "inbound",
 *     "Date": "2026-06-17T12:00:00Z"
 *   }
 */

const PostmarkInboundBody = z.object({
  MessageID: z.string().min(1).max(500),
  From: z.string().email(),
  FromName: z.string().max(400).optional(),
  To: z.string().min(1).max(1000),
  Subject: z.string().max(998).optional(),
  TextBody: z.string().min(1).max(50000),
  Headers: z
    .array(
      z.object({
        Name: z.string(),
        Value: z.string(),
      })
    )
    .optional()
    .default([]),
  Date: z.string().optional(),
});

export async function POST(req: NextRequest) {
  // ─── 1. Auth — webhook shared secret ────────────────────────
  const expectedSecret = process.env.CARE_INBOUND_EMAIL_SECRET;
  if (!expectedSecret) {
    // Missing env var is a deployment error, not a webhook error.
    // Return 500 so the provider retries — the misconfig is on us.
    return NextResponse.json(
      { error: "Inbound email not configured on the server." },
      { status: 500 }
    );
  }
  const incomingSecret = req.headers.get("x-care-webhook-secret");
  if (incomingSecret !== expectedSecret) {
    return NextResponse.json(
      { error: "Webhook authentication failed." },
      { status: 401 }
    );
  }

  // ─── 2. Parse + validate webhook body ────────────────────────
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  const parsed = PostmarkInboundBody.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Webhook payload didn't match the expected shape.",
        issues: parsed.error.issues,
      },
      { status: 400 }
    );
  }
  const body = parsed.data;

  const admin = createAdminClient();

  // ─── 3. Webhook retry dedup — §3.1 honest ──────────────────
  // If we already have a message with this provider MessageID,
  // return 200 and exit without writing anything. Per §3.1 the
  // record is the source of truth; we never double-insert the
  // same event.
  const { data: existing } = await admin
    .from("support_messages")
    .select("id")
    .eq("external_message_id", body.MessageID)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { ok: true, deduped: true, messageId: existing.id },
      { status: 200 }
    );
  }

  // ─── 4. Resolve tenant from To: address ──────────────────────
  const localPart = extractLocalPart(body.To);
  if (!localPart) {
    return NextResponse.json(
      { error: "Couldn't parse a local part from the To address." },
      { status: 400 }
    );
  }
  const { data: tenant } = await admin
    .from("care_tenant_config")
    .select("company_id, active")
    .eq("inbound_email_local_part", localPart)
    .maybeSingle();
  if (!tenant) {
    // Unknown tenant — log + 200 so the provider doesn't retry
    // forever. Per §A14 this is a verified render branch: it
    // means the inbound address isn't routed to any tenant.
    return NextResponse.json(
      { ok: true, ignored: "tenant_unknown" },
      { status: 200 }
    );
  }
  if (!tenant.active) {
    return NextResponse.json(
      { ok: true, ignored: "tenant_inactive" },
      { status: 200 }
    );
  }

  // ─── 5. Resolve customer ────────────────────────────────────
  // Look up or create a support_customers row keyed on email.
  const customerEmail = body.From.toLowerCase();
  let customerId: string | null = null;
  const { data: existingCustomer } = await admin
    .from("support_customers")
    .select("id")
    .eq("company_id", tenant.company_id)
    .eq("email", customerEmail)
    .maybeSingle();
  if (existingCustomer) {
    customerId = existingCustomer.id;
  } else {
    const { data: newCustomer } = await admin
      .from("support_customers")
      .insert({
        company_id: tenant.company_id,
        email: customerEmail,
        name: body.FromName ?? null,
        metadata: { source: "email", first_seen: body.Date ?? null },
      })
      .select("id")
      .single();
    customerId = newCustomer?.id ?? null;
  }

  // ─── 6. Find existing thread, or create new conversation ─────
  // Threading: check In-Reply-To / References headers against
  // existing conversations' external_thread_id. If hit, append
  // the message to that conversation. If miss, create a new
  // email conversation.
  const headerMap = new Map<string, string>();
  for (const h of body.Headers ?? []) {
    headerMap.set(h.Name.toLowerCase(), h.Value);
  }
  const inReplyTo = headerMap.get("in-reply-to");
  const references = headerMap.get("references");
  const threadIdCandidates = [inReplyTo, references]
    .filter((v): v is string => !!v)
    .flatMap((v) => v.split(/\s+/).map((s) => s.trim()).filter(Boolean));

  let conversationId: string | null = null;
  if (threadIdCandidates.length > 0) {
    const { data: threadHit } = await admin
      .from("support_conversations")
      .select("id, status")
      .eq("company_id", tenant.company_id)
      .in("external_thread_id", threadIdCandidates)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (threadHit) {
      conversationId = threadHit.id;
      // If the conversation had been resolved/closed, reopen it.
      // The customer replying IS a reopen signal per §1.6.
      if (
        threadHit.status === "resolved" ||
        threadHit.status === "closed"
      ) {
        await admin
          .from("support_conversations")
          .update({ status: "in_conversation" })
          .eq("id", conversationId);
      }
    }
  }

  if (!conversationId) {
    // New email conversation. The thread id we store is the
    // current message's MessageID — subsequent replies will
    // carry it in In-Reply-To.
    const { data: newConv } = await admin
      .from("support_conversations")
      .insert({
        company_id: tenant.company_id,
        customer_id: customerId,
        source: "email",
        subject: body.Subject ?? null,
        external_thread_id: body.MessageID,
        ai_responding: true, // Email AI first responder ON.
      })
      .select("id")
      .single();
    if (!newConv) {
      return NextResponse.json(
        { error: "Couldn't create the conversation." },
        { status: 500 }
      );
    }
    conversationId = newConv.id;
    const freshConversationId: string = newConv.id;

    // Phase 5 routing — only for FRESH email threads. Existing
    // threads (the alternative branch above) stay with whichever
    // agent had been working them — re-routing mid-thread would
    // confuse the customer and lose conversation continuity.
    void routeNewConversation({
      conversationId: freshConversationId,
      companyId: tenant.company_id,
      source: "email",
    }).catch(() => {
      /* routing best-effort */
    });
  }

  // ─── 7. Insert the customer message ──────────────────────────
  // Per TT.md A21 audit (2026-06-18) MED finding F6 — the dedup
  // check at step 3 and this insert form a check-then-insert
  // race. Two concurrent webhook retries (Postmark retries up
  // to 25 times) could both pass the existing-row check before
  // either inserts, then both attempt insert. The unique index
  // on external_message_id would reject the second, and
  // previously the route returned 500 — which makes Postmark
  // retry indefinitely. Fix: catch unique-violation (Postgres
  // error code 23505) and treat it as the dedup case.
  const insertResult = await admin
    .from("support_messages")
    .insert({
      conversation_id: conversationId,
      author_type: "customer",
      author_id: null,
      body: body.TextBody,
      is_internal_note: false,
      external_message_id: body.MessageID,
      email_metadata: {
        from: body.From,
        from_name: body.FromName ?? null,
        to: body.To,
        subject: body.Subject ?? null,
        date: body.Date ?? null,
        headers: Object.fromEntries(headerMap),
      },
    })
    .select("id")
    .single();
  if (insertResult.error) {
    // Postgres unique violation = the other concurrent retry
    // won. Return success with deduped:true so the provider
    // stops retrying.
    if (insertResult.error.code === "23505") {
      return NextResponse.json(
        { ok: true, deduped: true, reason: "race_resolved" },
        { status: 200 }
      );
    }
    return NextResponse.json(
      { error: "Couldn't insert the customer message." },
      { status: 500 }
    );
  }
  const insertedMsg = insertResult.data;
  if (!insertedMsg) {
    return NextResponse.json(
      { error: "Couldn't insert the customer message." },
      { status: 500 }
    );
  }

  // ─── 8. AI first responder — §A16 composition ────────────────
  // Same path the widget uses. Coach + Co-Pilot grade/draft email
  // replies on the same rubric as widget replies. The AI reply
  // is best-effort; we return 200 to the webhook either way so
  // the provider doesn't retry on AI failures.
  // conversationId is guaranteed non-null here — every reachable
  // path above either assigned it or returned early.
  if (!conversationId) {
    return NextResponse.json(
      { error: "Internal: conversation id missing after resolve." },
      { status: 500 }
    );
  }
  void runAiFirstResponder({
    conversationId,
    companyId: tenant.company_id,
    customerMessage: body.TextBody,
  });

  return NextResponse.json(
    { ok: true, conversationId, messageId: insertedMsg.id },
    { status: 200 }
  );
}

/**
 * Extract the local part from an email address. Strips display
 * name wrappers ("Jane <jane@x.com>" → "jane"), strips angle
 * brackets, lowercases.
 */
function extractLocalPart(to: string): string | null {
  const match = to.match(/<([^>]+)>/);
  const address = (match?.[1] ?? to).trim().toLowerCase();
  const at = address.indexOf("@");
  if (at <= 0) return null;
  return address.slice(0, at);
}

/**
 * AI first responder for email. Best-effort. If anything fails
 * the customer doesn't see an auto-reply, but an agent picks
 * up the conversation from the inbox same as a widget message.
 */
async function runAiFirstResponder(args: {
  conversationId: string;
  companyId: string;
  customerMessage: string;
}): Promise<void> {
  try {
    // Honest hand-off detection — if the customer asked for a
    // human, don't AI-reply. The agent inbox surfaces it.
    if (detectHandoffSignal(args.customerMessage)) {
      const admin = createAdminClient();
      await admin
        .from("support_conversations")
        .update({ ai_responding: false })
        .eq("id", args.conversationId);
      return;
    }

    const productContext = await getProductContextForTenant(args.companyId);
    const systemPrompt = buildCareSystemPrompt({ productContext });
    const userMessage = buildCareUserMessage({
      newMessage: args.customerMessage,
      context: {
        productContext,
        recentTurns: [],
      },
    });

    const reply = await generateCareReply({
      systemPrompt,
      userMessage,
    });

    const admin = createAdminClient();
    await admin.from("support_messages").insert({
      conversation_id: args.conversationId,
      author_type: "ai",
      author_id: null,
      body: reply.text,
      is_internal_note: false,
    });
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[care] email AI first responder failed", e);
    }
    if (e instanceof LlmError) {
      // No-op — agent inbox surfaces the conversation, no AI reply
      // was sent.
    }
  }
}
