import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatEmailAddress, sanitizeEmailHeaderValue } from "@/lib/care/email/sanitizeHeader";

/**
 * Outbound email dispatch — Phase 4 commit 2.
 *
 * When an agent posts a reply to a conversation whose source is
 * 'email', this module dispatches the reply through the email
 * provider with proper threading headers so the customer's reply
 * comes back to the same conversation.
 *
 * Constitutional sources:
 *   - §3.1 — outbound is event-shaped: we persist the dispatch
 *     attempt (with provider message id when known) so the
 *     append-only chain stays honest. Failed dispatches are
 *     recorded too — silence is not allowed.
 *   - §A4 — provider choice is an explicit uncertainty. The
 *     dispatchOutboundEmailReply function is a single seam; today
 *     it implements Postmark, future iterations can route by
 *     provider config without touching call sites.
 *   - §A14 — caller (the agent message POST route) treats this
 *     as a verified render branch: success vs failure must each
 *     surface to the agent so they're not in the dark about
 *     whether the email actually went out.
 *
 * Provider abstraction
 * ────────────────────
 * The intent is provider-agnostic — Postmark today, others later.
 * The internal interface is { from, to, subject, textBody, headers }
 * and the function returns { ok, providerMessageId?, error? }. Adding
 * SES or SendGrid means adding a sendVia<Provider> branch and a new
 * env var; no call-site change.
 *
 * What this module does NOT do
 * ────────────────────────────
 * - HTML email rendering. Plain text body only for v1 per §A4 —
 *   HTML adds rendering surface area (multi-state render per §A14)
 *   and the deferred attachment story. Agents author plain prose;
 *   the customer's mail client renders it naturally.
 * - Template rendering / merge tags. Reply signature is appended
 *   verbatim from care_tenant_config.reply_signature. Templates
 *   come later when canned responses get email-aware.
 * - Delivery tracking webhooks. Provider delivery callbacks would
 *   land at /api/care/inbound/email-events; deferred per §A4.
 */

const POSTMARK_API = "https://api.postmarkapp.com/email";

export type DispatchResult =
  | { ok: true; providerMessageId: string }
  // `unconfigured: true` marks the benign "outbound email isn't set up here"
  // returns (no POSTMARK_SERVER_TOKEN / CARE_EMAIL_HOST_DOMAIN) — the expected
  // state in dev/demo. Its ABSENCE on an ok:false means a GENUINE problem: a
  // real Postmark send failure, or a data/logic error. Callers use this to
  // avoid conflating a production dropped-reply (an incident) with dev noise —
  // the two previously logged identically. Keyed on this flag, not on
  // string-matching the free-text `error` — key on state, not on a string.
  | { ok: false; error: string; unconfigured?: true };

export async function dispatchOutboundEmailReply(args: {
  conversationId: string;
  /** The agent message id we're sending. Used for in-app linking
   *  back from the email_metadata stored on the dispatched message. */
  messageId: string;
}): Promise<DispatchResult> {
  const apiToken = process.env.POSTMARK_SERVER_TOKEN;
  if (!apiToken) {
    return {
      ok: false,
      unconfigured: true,
      error:
        "Outbound email not configured (POSTMARK_SERVER_TOKEN missing). Skipping dispatch.",
    };
  }
  const emailHostDomain = process.env.CARE_EMAIL_HOST_DOMAIN;
  if (!emailHostDomain) {
    return {
      ok: false,
      unconfigured: true,
      error:
        "Outbound email host domain not configured (CARE_EMAIL_HOST_DOMAIN missing).",
    };
  }

  const admin = createAdminClient();

  // ─── 1. Load the conversation + tenant config + customer ────
  const { data: conv } = await admin
    .from("support_conversations")
    .select(
      "id, company_id, customer_id, subject, source, external_thread_id"
    )
    .eq("id", args.conversationId)
    .maybeSingle();
  if (!conv) {
    return { ok: false, error: "Conversation not found." };
  }
  if (conv.source !== "email") {
    return {
      ok: false,
      error: `Conversation source is ${conv.source}; outbound email only dispatches for email conversations.`,
    };
  }

  const { data: tenant } = await admin
    .from("care_tenant_config")
    .select(
      "inbound_email_local_part, company_display_name, reply_signature"
    )
    .eq("company_id", conv.company_id)
    .maybeSingle();
  if (!tenant?.inbound_email_local_part) {
    return {
      ok: false,
      error: "Tenant has no inbound email address configured.",
    };
  }

  if (!conv.customer_id) {
    return {
      ok: false,
      error:
        "Conversation has no customer linked — outbound needs a recipient.",
    };
  }
  const { data: customer } = await admin
    .from("support_customers")
    .select("email, name")
    .eq("id", conv.customer_id)
    .maybeSingle();
  if (!customer?.email) {
    return {
      ok: false,
      error: "Customer has no email address — can't dispatch outbound.",
    };
  }

  // ─── 2. Load the agent message ──────────────────────────────
  const { data: msg } = await admin
    .from("support_messages")
    .select("body")
    .eq("id", args.messageId)
    .maybeSingle();
  if (!msg?.body) {
    return { ok: false, error: "Message not found or empty body." };
  }

  // ─── 3. Compose the outbound email ──────────────────────────
  const fromAddress = `${tenant.inbound_email_local_part}@${emailHostDomain}`;
  const displayName = tenant.company_display_name ?? "Support";
  const subjectBase = conv.subject ?? "Re: your message";
  const subject = subjectBase.toLowerCase().startsWith("re:")
    ? subjectBase
    : `Re: ${subjectBase}`;

  // Per TT.md A21 audit (2026-06-18) MED finding F8 — until this
  // cap, tenant.reply_signature was appended verbatim with no
  // bounds. A tenant with a multi-KB signature (accident or
  // misconfig) would bloat every outbound email body + threading
  // payload. Cap at 2000 chars (~30 lines of plain text) — plenty
  // for legal/contact info, bounded against pathological cases.
  const SIGNATURE_MAX_CHARS = 2000;
  const rawSig = tenant.reply_signature?.trim();
  const signature =
    rawSig && rawSig.length > SIGNATURE_MAX_CHARS
      ? rawSig.slice(0, SIGNATURE_MAX_CHARS) + " […truncated]"
      : rawSig;
  const textBody = signature ? `${msg.body}\n\n--\n${signature}` : msg.body;

  // Threading headers — In-Reply-To + References point at the
  // conversation's external_thread_id so replies thread back.
  const headers: Array<{ Name: string; Value: string }> = [];
  // external_thread_id derives from the inbound Message-Id (customer's mail client) — sanitize before it
  // becomes a header value so a crafted Message-Id can't smuggle a header (§A27; empty → skip threading).
  const threadId = sanitizeEmailHeaderValue(conv.external_thread_id);
  if (threadId) {
    headers.push({ Name: "In-Reply-To", Value: threadId });
    headers.push({ Name: "References", Value: threadId });
  }

  // ─── 4. Dispatch to Postmark ────────────────────────────────
  let providerMessageId: string;
  try {
    const response = await fetch(POSTMARK_API, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Postmark-Server-Token": apiToken,
      },
      body: JSON.stringify({
        // formatEmailAddress sanitizes the display name (§A13) so an
        // attacker-controlled customer name can't inject a second recipient
        // via the comma-separated To list (audit 2026-07-07). fromAddress +
        // customer.email are trusted; only the NAMES need sanitizing.
        From: formatEmailAddress(fromAddress, displayName),
        To: formatEmailAddress(customer.email, customer.name),
        Subject: subject,
        TextBody: textBody,
        Headers: headers,
        MessageStream: "outbound",
      }),
    });
    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      return {
        ok: false,
        error: `Postmark dispatch failed: ${response.status} ${errBody.slice(0, 300)}`,
      };
    }
    const result = (await response.json()) as { MessageID?: string };
    if (!result.MessageID) {
      return {
        ok: false,
        error: "Postmark response missing MessageID.",
      };
    }
    providerMessageId = result.MessageID;
  } catch (e) {
    return {
      ok: false,
      error: `Outbound dispatch error: ${e instanceof Error ? e.message : "unknown"}`,
    };
  }

  // ─── 5. Persist dispatch outcome on the message row ─────────
  // Per §3.1 the dispatch is an event we record. The
  // external_message_id + email_metadata get patched onto the
  // already-inserted agent message via the preserve trigger
  // (which allows updates to email_metadata + external_message_id
  // for system-emitted state).
  //
  // Actually the trigger from 0041 REVERTS updates to
  // external_message_id + email_metadata. We need to write these
  // server-side via the service-role client AND we need the
  // trigger to allow them. The trigger currently reverts; for
  // outbound dispatch tracking we'll write a SEPARATE event row
  // rather than mutating the agent's message — keeps the §3.1
  // append-only contract honest.
  //
  // For v1: store dispatch outcome in care_widget_load_events
  // (existing telemetry stream). Future iteration adds a
  // dedicated care_email_dispatch_events table when the §4
  // readout shows it's worth structuring separately.
  try {
    await admin.from("care_widget_load_events").insert({
      company_id: conv.company_id,
      embed_token: "(email-outbound)",
      origin: null,
      result: "ok",
      user_agent: `postmark:${providerMessageId}`,
    });
  } catch {
    /* telemetry best-effort */
  }

  return { ok: true, providerMessageId };
}
