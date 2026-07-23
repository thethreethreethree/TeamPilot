import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { routeNewConversation, listCareMessagesForCustomer } from "@/lib/data/care";
import { notifyAssignedAgentOfCustomerMessage } from "@/lib/notifications/careNotify";
import {
  getProductContextForTenant,
  getCareTenantConfigByCompanyId,
} from "@/lib/care/config";
import {
  buildCareSystemPrompt,
  buildCareUserMessage,
  detectHandoffSignal,
  stripHandoffSentinel,
} from "@/lib/care/prompt";
import { generateCareReply } from "@/lib/claude";
import { buildRecentTurns } from "@/lib/care/recentTurns";
import { dispatchOutboundEmailReply } from "@/lib/care/email/outbound";
import { HANDOFF_NOTICE } from "@/lib/care/handoverNotice";
import { resolveEmailReplyBody } from "@/lib/care/emailReplyDelivery";
import { LlmError } from "@/lib/llm/errors";
import { constantTimeEqual } from "@/lib/api/constantTime";

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
  // Bounded like every other field (defense-in-depth — the webhook is secret-
  // gated so only the trusted provider sends, but real emails carry a bounded
  // header set; caps keep a compromised/buggy provider from sending an unbounded
  // payload). Generous vs. real email: message-id headers run well under 4000.
  Headers: z
    .array(
      z.object({
        Name: z.string().max(200),
        Value: z.string().max(4000),
      })
    )
    .max(100)
    .optional()
    .default([]),
  Date: z.string().optional(),
});

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

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
  if (!constantTimeEqual(incomingSecret, expectedSecret)) {
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
    if (newCustomer) {
      customerId = newCustomer.id;
    } else {
      // Insert returned nothing — almost always a concurrent first-email from the
      // SAME customer won the unique(company_id, email) race (23505). Re-select the
      // now-existing row so this email still links to the customer instead of
      // orphaning with customer_id=null.
      const { data: raced } = await admin
        .from("support_customers")
        .select("id")
        .eq("company_id", tenant.company_id)
        .eq("email", customerEmail)
        .maybeSingle();
      customerId = raced?.id ?? null;
    }
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
    //
    // AWAITED, not fire-and-forget (§3.3/§A21). routeNewConversation
    // sets assigned_agent_id AND flips ai_responding=false on a
    // successful assign. Two steps BELOW read that exact state:
    //   - step 7's notifyAssignedAgentOfCustomerMessage reads
    //     assigned_agent_id (a null read = no push to the agent), and
    //   - step 8's runAiFirstResponder reads ai_responding (a stale
    //     true read = the AI answers over an assigned human, §3.3).
    // Fire-and-forget raced both: the reads landed before routing's
    // write, so a fresh email's assigned agent got NO push and the AI
    // proceeded anyway. Awaiting here (routing still best-effort via
    // .catch) guarantees both reads see the post-routing state. The
    // added latency lands on a machine webhook (Postmark), not a
    // waiting human, so it's free. Do NOT revert to void.
    await routeNewConversation({
      conversationId: freshConversationId,
      companyId: tenant.company_id,
      source: "email",
    }).catch(() => {
      /* routing best-effort — a routing failure must not 500 the webhook */
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

  // Queue #2: push the assigned agent that the customer replied.
  // `after()` (not bare void): this runs AFTER the 200 is sent, but Vercel keeps
  // the function alive until it settles — a bare `void` promise would be abandoned
  // when the serverless instance freezes post-response, silently dropping the push.
  if (conversationId) {
    after(() =>
      notifyAssignedAgentOfCustomerMessage({
        conversationId,
        body: body.TextBody,
      })
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
  // `after()` so the LLM call survives past the 200 — a bare `void` would be
  // frozen with the instance post-response and the AI reply would never generate.
  after(() =>
    runAiFirstResponder({
      conversationId,
      companyId: tenant.company_id,
      customerId,
      customerMessage: body.TextBody,
      customerMessageId: insertedMsg.id,
    })
  );

  return NextResponse.json(
    { ok: true, conversationId, messageId: insertedMsg.id },
    { status: 200 }
  );
}

/**
 * Extract the local part from an email address. Strips display
 * name wrappers ("Jane <jane@x.com>" → "jane"), strips angle
 * brackets, lowercases. Exported for unit tests — tenant routing
 * depends on this, so a parsing regression silently drops mail.
 */
export function extractLocalPart(to: string): string | null {
  const match = to.match(/<([^>]+)>/);
  const address = (match?.[1] ?? to).trim().toLowerCase();
  const at = address.indexOf("@");
  if (at <= 0) return null;
  return address.slice(0, at);
}

// Loop breaker window + threshold. A machine auto-responder ping-pong
// fires far faster than a human can round-trip an email, so a small
// count inside a short window is a reliable loop signal with near-zero
// false positives on real threads.
const AI_LOOP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const AI_LOOP_BREAKER_MAX = 5; // ≥5 AI replies in the window = loop, not a human
// Per-sender flood guard — a spammer opening many DISTINCT threads to one
// tenant address isn't caught by the per-conversation loop breaker (each new
// thread gets its own count). This bounds total AI replies to one sender
// across all their threads inside a wider window.
const AI_SENDER_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const AI_SENDER_MAX = 12; // ≥12 AI replies to one sender in the window = flood

/**
 * AI first responder for email. Best-effort. If anything fails
 * the customer doesn't see an auto-reply, but an agent picks
 * up the conversation from the inbox same as a widget message.
 */
async function runAiFirstResponder(args: {
  conversationId: string;
  companyId: string;
  customerId: string | null;
  customerMessage: string;
  /** The just-inserted customer message — excluded from history (it goes in as newMessage). */
  customerMessageId: string;
}): Promise<void> {
  const admin = createAdminClient();
  try {
    // Respect the human-takeover flag — parity with the widget
    // messages route, which gates the AI reply on
    // conversation.aiResponding (§A21). If an agent claimed this
    // conversation (ai_responding=false), or a prior handoff / loop
    // breaker already flipped it, the AI must stay silent and let the
    // human reply from the inbox (§3.3 — guide, don't overtake). The
    // email route previously skipped this check, so the AI kept
    // auto-replying over an agent who had already taken the thread.
    const { data: conv } = await admin
      .from("support_conversations")
      .select("ai_responding")
      .eq("id", args.conversationId)
      .maybeSingle();
    if (!conv || conv.ai_responding === false) return;

    // Honest hand-off detection — if the customer asked for a
    // human, don't AI-reply. The agent inbox surfaces it.
    if (detectHandoffSignal(args.customerMessage)) {
      await admin
        .from("support_conversations")
        .update({ ai_responding: false })
        .eq("id", args.conversationId);
      return;
    }

    // Loop breaker — email is machine-to-machine and can ping-pong
    // with the sender's own auto-responder (out-of-office, another
    // bot): our AI reply → their auto-reply → our inbound → our AI
    // reply, each hop costing an LLM call. Count AI replies already
    // sent in this conversation inside a short window; past a small
    // threshold it's a loop, not a human. Flip the AI off so a human
    // takes over and the spend stops (§3.4 — don't pretend to keep
    // answering a machine; §A16 — an email-specific guard the live
    // widget doesn't need).
    const since = new Date(Date.now() - AI_LOOP_WINDOW_MS).toISOString();
    const { count: recentAiReplies } = await admin
      .from("support_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", args.conversationId)
      .eq("author_type", "ai")
      .gte("created_at", since);
    if ((recentAiReplies ?? 0) >= AI_LOOP_BREAKER_MAX) {
      await admin
        .from("support_conversations")
        .update({ ai_responding: false })
        .eq("id", args.conversationId);
      // Always log — a tripped loop breaker means a customer just stopped
      // getting AI replies; an operator must be able to see WHY in prod, not
      // only in dev (§3.6 make-learning-visible). Fires once per conversation
      // (we just flipped ai_responding off), so it can't spam. A structured
      // §3.1 event is the follow-up; a greppable warn is the floor.
      console.warn(
        `[care] email AI loop breaker tripped conv=${args.conversationId} recentAiReplies=${recentAiReplies}`
      );
      // Durable record in the conversation timeline (§3.1 append-only) so an
      // agent viewing the thread sees WHY the AI went quiet, not just an
      // unexplained silence. actor_type=system (no human silenced it).
      await admin.from("support_conversation_events").insert({
        conversation_id: args.conversationId,
        actor_id: null,
        actor_type: "system",
        event_type: "ai_suppressed_loop",
        metadata: {
          recent_ai_replies: recentAiReplies ?? 0,
          window_ms: AI_LOOP_WINDOW_MS,
        },
      });
      return;
    }

    // Per-sender flood guard — the loop breaker above is per-conversation, so
    // a spammer opening many DISTINCT threads to one tenant address slips past
    // it (each new thread starts its own count). Bound total AI replies to one
    // sender across ALL their threads in a wider window; past the cap, stop
    // auto-replying to this sender. Their messages still land in the agent
    // inbox — we suppress the AI, not the intake (§A16 composes with the loop
    // breaker; §3.4 — don't burn LLM spend pretending a flood is a customer).
    if (args.customerId) {
      const { data: senderConvos } = await admin
        .from("support_conversations")
        .select("id")
        .eq("customer_id", args.customerId);
      const senderConvoIds = (senderConvos ?? []).map((c) => c.id);
      if (senderConvoIds.length > 0) {
        const senderSince = new Date(
          Date.now() - AI_SENDER_WINDOW_MS
        ).toISOString();
        const { count: senderAiReplies } = await admin
          .from("support_messages")
          .select("id", { count: "exact", head: true })
          .in("conversation_id", senderConvoIds)
          .eq("author_type", "ai")
          .gte("created_at", senderSince);
        if ((senderAiReplies ?? 0) >= AI_SENDER_MAX) {
          // Always log (§3.6) — a flood is a cost/abuse event operators need
          // visible in prod. Unlike the loop breaker this doesn't flip a flag
          // (it's cross-conversation), so it can recur as the window slides;
          // that intermittence IS the signal of an ongoing flood. Sampling is
          // the follow-up if a sustained flood ever makes this noisy.
          console.warn(
            `[care] email AI sender-flood guard tripped customer=${args.customerId} senderAiReplies=${senderAiReplies}`
          );
          // §3.1 record on the current thread. Each suppression is a real
          // event; append-only means the flood leaves an honest trail an
          // agent (and any later analysis) can read.
          await admin.from("support_conversation_events").insert({
            conversation_id: args.conversationId,
            actor_id: null,
            actor_type: "system",
            event_type: "ai_suppressed_flood",
            metadata: {
              sender_ai_replies: senderAiReplies ?? 0,
              window_ms: AI_SENDER_WINDOW_MS,
              customer_id: args.customerId,
            },
          });
          return;
        }
      }
    }

    const productContext = await getProductContextForTenant(args.companyId);
    // Per the 2026-06-24 audit (H2): email-channel customers were
    // always getting "Jeff" because this caller didn't pass the
    // per-tenant agent name. Load the tenant config and thread the
    // name through, same as the messages route. Falls back to 'Jeff'
    // inside buildCareSystemPrompt if config is null.
    const tenant = await getCareTenantConfigByCompanyId(args.companyId);
    const systemPrompt = buildCareSystemPrompt({
      productContext,
      agentName: tenant?.aiName,
      // F2 (founder 2026-07-22): honour the per-tenant voice settings (previously loaded but unused).
      aiTone: tenant?.aiTone,
      aiResponseLength: tenant?.aiResponseLength,
    });
    // Pull the visible thread so the email AI sees the conversation context — its own prior
    // replies AND the customer's earlier emails — via the SAME shared helper the widget messages
    // route uses (buildRecentTurns). Previously this was `recentTurns: []`, so on a multi-email
    // thread the AI replied context-blind (re-introduced itself every time). The just-inserted
    // customer message is excluded (it goes in as newMessage).
    const priorMessages = await listCareMessagesForCustomer(args.conversationId);
    const recentTurns = buildRecentTurns(priorMessages, args.customerMessageId);

    const userMessage = buildCareUserMessage({
      newMessage: args.customerMessage,
      context: {
        productContext,
        recentTurns,
      },
    });

    const reply = await generateCareReply({
      systemPrompt,
      userMessage,
    });

    // Mirror the widget's AI-reply handoff handling (audit 2026-07-23 — §1.2 class-check of the widget
    // blank-bubble/leak fix). Before this, the email path inserted reply.text RAW: (1) the [[HANDOFF]]
    // sentinel LEAKED into the customer's email, and (2) when the AI itself handed off it did NOT flip
    // ai_responding, so the AI kept auto-replying to the next email instead of ceding to a human (§3.3).
    const aiHandsOff = detectHandoffSignal(reply.text);
    const body = stripHandoffSentinel(reply.text);

    // On a handoff where the AI emitted ONLY the sentinel (empty after strip), the customer would
    // otherwise get silence on email — the widget posts HANDOFF_NOTICE regardless, so email must too.
    // Fall back to the notice so a handoff ALWAYS tells the customer a human is coming (§3.3 req #1).
    // A non-empty reply already says it warmly, so we don't ALSO send the notice — that would
    // double-email the customer. Empty + no-handoff → send nothing (nothing to say; not a handoff).
    const outboundBody = resolveEmailReplyBody(body, aiHandsOff, HANDOFF_NOTICE);

    let insertedAiId: string | null = null;
    if (outboundBody) {
      const { data: aiMsg } = await admin
        .from("support_messages")
        .insert({
          conversation_id: args.conversationId,
          author_type: "ai",
          author_id: null,
          body: outboundBody,
          is_internal_note: false,
        })
        .select("id")
        .single();
      insertedAiId = aiMsg?.id ?? null;
    }

    // §3.3 — when the AI says it's bringing in a human, it must actually cede the thread so the next
    // inbound email routes to the agent inbox, not another AI reply. (Same flip the pre-check uses.)
    if (aiHandsOff) {
      await admin
        .from("support_conversations")
        .update({ ai_responding: false })
        .eq("id", args.conversationId);
    }

    // DELIVER the AI reply to the customer's inbox. On the EMAIL channel, STORING the message is not
    // delivery (unlike the widget, which the customer polls) — without this dispatch the customer who
    // emailed in never receives the AI first-responder's reply (they get silence). Mirrors the agent
    // messages route's outbound dispatch (A28). SAFE: dispatchOutboundEmailReply returns {ok:false}
    // (logged, sends nothing) when POSTMARK_SERVER_TOKEN / CARE_EMAIL_HOST_DOMAIN are unset, so it
    // only sends real email once outbound is actually configured — the same gate the agent route uses.
    if (insertedAiId) {
      const dispatch = await dispatchOutboundEmailReply({
        conversationId: args.conversationId,
        messageId: insertedAiId,
      });
      if (!dispatch.ok) {
        // eslint-disable-next-line no-console
        console.error(
          `[care] email AI reply outbound dispatch NOT sent conv=${args.conversationId} msg=${insertedAiId}: ${dispatch.error}`
        );
      }
    }
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
