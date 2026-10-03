/**
 * Whether outbound email can be sent: the one verdict (CLAUDE.md §2.2). sendTransactionalEmail and
 * dispatchOutboundEmailReply (outbound.ts) refuse without exactly these two, and every consumer that needs to say
 * "email is off" asks here instead of restating the condition.
 *
 * No imports on purpose: /api/health reads it, and that route must not pull in clients that validate env at load.
 *
 * 2026-10-03: production has neither, so the weekly digest the founder asked for on 2026-09-04 has never sent an
 * email (the 2026-09-28 run logged "Postmark not configured — no email sent"). Founder picker 2026-10-03: set up
 * Postmark. Steps: docs/CONFIG-PRECONDITIONS-AUDIT.md, 2026-10-03 section.
 */
export function emailConfigured(): boolean {
  return Boolean(process.env.POSTMARK_SERVER_TOKEN && process.env.CARE_EMAIL_HOST_DOMAIN);
}
