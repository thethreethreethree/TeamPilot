/** F31.8 - signed outbound webhooks. HMAC-SHA256 over `${timestamp}.${body}`. */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const WEBHOOK_EVENTS = ['session.scored', 'session.closed', 'deal.closed'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export const MAX_SKEW_SECONDS = 300;

export function sign(secret: string, timestamp: number, body: string): string {
  if (!secret) throw new Error('RSS_WEBHOOK_SIGNING_SECRET is not set');
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

export function verify(secret: string, timestamp: number, body: string, signature: string, nowSec: number): boolean {
  if (Math.abs(nowSec - timestamp) > MAX_SKEW_SECONDS) return false;
  const expected = Buffer.from(sign(secret, timestamp, body), 'hex');
  const got = Buffer.from(signature, 'hex');
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function assertEndpointUrl(url: string): void {
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error('Webhook endpoints must use https');
  if (['localhost', '127.0.0.1', '0.0.0.0'].includes(u.hostname)) throw new Error('Webhook endpoint cannot be local');
}
