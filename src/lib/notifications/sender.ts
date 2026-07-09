import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Team Chat PWA — push notification sender (Phase 2.2).
 *
 * Fans out a Web Push payload to all enabled subscriptions of a given
 * set of user IDs. Used by the chat-message post path to notify
 * topic participants when a teammate sends a message.
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md adjacent — PWA notification UX.
 *
 * Failure handling:
 *   - 410 Gone / 404 Not Found from the push service → the subscription
 *     is stale (user uninstalled, browser cleared, etc.). We soft-
 *     disable the row (enabled=false) so future fan-outs skip it.
 *     We don't hard-delete because the user might re-register from
 *     the same browser, and we want to preserve the audit chain.
 *   - All other errors → logged but ignored. A push that fails to
 *     deliver MUST NOT block the chat message from being sent.
 *
 * Env vars required at runtime:
 *   VAPID_SUBJECT             — mailto:/https: URL identifying sender
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *
 * If these aren't set, sendPushToUsers() silently no-ops. Useful in
 * dev when you haven't generated VAPID keys yet — the message-post
 * path still works.
 */

let vapidConfigured = false;
function ensureVapidConfigured(): boolean {
  if (vapidConfigured) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) {
    return false;
  }
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export type PushPayload = {
  /** Notification title (shown bold at the top). Keep under ~50 chars
   *  for mobile lock-screen rendering. */
  title: string;
  /** Notification body (shown smaller, below title). Keep under ~120
   *  chars so iOS / Android don't truncate. */
  body: string;
  /** Path to navigate to when the user clicks the notification.
   *  e.g. "/dashboard/chats/<topic-id>". */
  url: string;
  /** Dedup tag — pushes with the same tag for the same user replace
   *  earlier ones rather than stacking. Use "topic:<id>" so all
   *  messages in a topic collapse into a single notification per
   *  device until acknowledged. */
  tag: string;
};

/**
 * Send a push payload to every enabled subscription belonging to
 * any of the given user IDs. Non-blocking from the caller's
 * perspective — errors are caught + logged + don't propagate.
 *
 * Uses the service-role client to read subscriptions across user
 * boundaries (the fan-out path doesn't have a single auth.uid()
 * since it's serving multiple recipients).
 */
export async function sendPushToUsers(args: {
  userIds: string[];
  payload: PushPayload;
}): Promise<{ sent: number; failed: number; skipped: number }> {
  const { userIds, payload } = args;
  if (userIds.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  if (!ensureVapidConfigured()) {
    // No VAPID config → can't send. A SILENT skip here is a debugging
    // black hole — it's exactly why "notifications didn't work" was
    // undiagnosable on 2026-06-27. Name the cause out loud.
    const present = {
      VAPID_SUBJECT: Boolean(process.env.VAPID_SUBJECT),
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: Boolean(
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
      ),
      VAPID_PRIVATE_KEY: Boolean(process.env.VAPID_PRIVATE_KEY),
    };
    // eslint-disable-next-line no-console
    console.warn(
      `[push-sender] SKIPPED ${userIds.length} recipient(s): VAPID not configured. ` +
        `Present? ${JSON.stringify(present)}`
    );
    return { sent: 0, failed: 0, skipped: userIds.length };
  }

  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from("notification_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", userIds)
    .eq("enabled", true);

  if (error || !subs || subs.length === 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[push-sender] no enabled subscriptions for ${userIds.length} user(s)` +
        (error ? ` (query error: ${error.message})` : " — none stored/enabled")
    );
    return { sent: 0, failed: 0, skipped: 0 };
  }

  const payloadString = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  // Track 403s specifically: a 403 is a GLOBAL config fault (the keypair),
  // not a per-subscription one, so counting them lets us name the actionable
  // cause once at the end instead of scattering N identical per-send lines
  // (matching this file's "name the cause out loud" philosophy above).
  let forbidden = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint as string,
            keys: {
              p256dh: sub.p256dh as string,
              auth: sub.auth as string,
            },
          },
          payloadString
        );
        sent += 1;
        // Best-effort last_used_at touch — failures here don't matter.
        await supabase
          .from("notification_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", sub.id as string)
          .then(() => undefined, () => undefined);
      } catch (err: unknown) {
        failed += 1;
        const statusCode =
          err && typeof err === "object" && "statusCode" in err
            ? Number((err as { statusCode: unknown }).statusCode)
            : null;
        // 404 / 410 → subscription is dead. Soft-disable so future
        // fan-outs skip it. Other errors → leave the row alone; could
        // be transient network / push service hiccup.
        if (statusCode === 404 || statusCode === 410) {
          await supabase
            .from("notification_subscriptions")
            .update({ enabled: false })
            .eq("id", sub.id as string)
            .then(() => undefined, () => undefined);
        }
        if (statusCode === 403) forbidden += 1;
        // Log in ALL environments — a production-only silent failure is
        // undebuggable. statusCode is the named cause: 403 = VAPID key
        // mismatch (the public key used to subscribe ≠ the keypair used
        // to send), 410/404 = dead subscription, 401 = bad VAPID auth.
        // eslint-disable-next-line no-console
        console.warn("[push-sender] send FAILED", {
          endpoint: (sub.endpoint as string).slice(0, 60) + "...",
          statusCode,
          message: err instanceof Error ? err.message : String(err),
        });
      }
    })
  );

  // eslint-disable-next-line no-console
  console.info(
    `[push-sender] result sent=${sent} failed=${failed} skipped=0 across ${subs.length} subscription(s)`
  );
  // Aggregated diagnosis for the OPEN "subscribes but doesn't deliver" issue:
  // if sends failed with 403, the single actionable cause is a VAPID keypair
  // mismatch. Named once, loudly, with the fix — so a reader doesn't have to
  // infer it from N scattered per-send 403 lines.
  if (forbidden > 0) {
    // eslint-disable-next-line no-console
    console.error(
      `[push-sender] ${forbidden}/${subs.length} send(s) returned 403 FORBIDDEN. ` +
        `This is almost certainly a VAPID KEYPAIR MISMATCH: the NEXT_PUBLIC_VAPID_PUBLIC_KEY ` +
        `the client SUBSCRIBED with (inlined into the client bundle at BUILD time) does not ` +
        `match the VAPID_PRIVATE_KEY the server SIGNS with at runtime. Fix: generate one keypair ` +
        `(npx web-push generate-vapid-keys), set NEXT_PUBLIC_VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY ` +
        `from THAT SAME pair in the deploy env (not just .env.local), REBUILD so the client picks ` +
        `up the public key, then have users re-subscribe.`
    );
  }
  return { sent, failed, skipped: 0 };
}
