import { describe, it, expect, afterEach } from "vitest";
import { emailConfigured } from "../configured";

/**
 * The one "can email send" verdict (2026-10-03). Both terms on both sides: outbound.ts refuses without either, so
 * the verdict must be false without either. (The weekly digest has never sent: production has neither.)
 */
const keys = ["POSTMARK_SERVER_TOKEN", "CARE_EMAIL_HOST_DOMAIN"] as const;
const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});
const set = (token?: string, domain?: string) => {
  if (token === undefined) delete process.env.POSTMARK_SERVER_TOKEN;
  else process.env.POSTMARK_SERVER_TOKEN = token;
  if (domain === undefined) delete process.env.CARE_EMAIL_HOST_DOMAIN;
  else process.env.CARE_EMAIL_HOST_DOMAIN = domain;
};

describe("emailConfigured", () => {
  it.each([
    [undefined, undefined, false],
    ["pm-token", undefined, false],
    [undefined, "mail.elostate.com", false],
    ["", "mail.elostate.com", false],
    ["pm-token", "", false],
    ["pm-token", "mail.elostate.com", true],
  ] as const)("token=%s domain=%s -> %s", (token, domain, expected) => {
    set(token, domain);
    expect(emailConfigured()).toBe(expected);
  });
});
