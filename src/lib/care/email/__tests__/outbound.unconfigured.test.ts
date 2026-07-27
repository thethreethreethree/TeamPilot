import { describe, it, expect, afterEach } from "vitest";
import { dispatchOutboundEmailReply } from "../outbound";

/**
 * Locks the finding-19 `unconfigured` discriminator: the two config-gate returns of
 * dispatchOutboundEmailReply must mark themselves `unconfigured: true`, so the inbound-email route can
 * distinguish a BENIGN "outbound not set up here" (dev/demo) from a GENUINE send failure (a real dropped
 * customer reply — an incident). If a regression dropped the flag, a genuine failure would log as benign
 * again and the 2-day-silent-drop would return. Both branches return BEFORE any network/DB IO, so no mocking
 * is needed — env vars alone drive them.
 */
describe("dispatchOutboundEmailReply — unconfigured discriminator (finding 19)", () => {
  const savedToken = process.env.POSTMARK_SERVER_TOKEN;
  const savedDomain = process.env.CARE_EMAIL_HOST_DOMAIN;
  afterEach(() => {
    if (savedToken === undefined) delete process.env.POSTMARK_SERVER_TOKEN;
    else process.env.POSTMARK_SERVER_TOKEN = savedToken;
    if (savedDomain === undefined) delete process.env.CARE_EMAIL_HOST_DOMAIN;
    else process.env.CARE_EMAIL_HOST_DOMAIN = savedDomain;
  });

  it("no POSTMARK_SERVER_TOKEN → ok:false AND unconfigured:true (benign, not a genuine failure)", async () => {
    delete process.env.POSTMARK_SERVER_TOKEN;
    const r = await dispatchOutboundEmailReply({ conversationId: "c1", messageId: "m1" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.unconfigured === true).toBe(true);
  });

  it("token set but no CARE_EMAIL_HOST_DOMAIN → ok:false AND unconfigured:true", async () => {
    process.env.POSTMARK_SERVER_TOKEN = "test-token-not-used-early-return";
    delete process.env.CARE_EMAIL_HOST_DOMAIN;
    const r = await dispatchOutboundEmailReply({ conversationId: "c1", messageId: "m1" });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.unconfigured === true).toBe(true);
  });
});
