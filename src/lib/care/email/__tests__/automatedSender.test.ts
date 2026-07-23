import { describe, it, expect } from "vitest";
import { detectAutomatedSender } from "../automatedSender";

/**
 * The detector's whole job is to say "don't AI-reply to a machine" WITHOUT ever silencing a real
 * customer. So the tests come in two halves: every recognised automated signal must fire (with a
 * greppable reason for the suppression event), and a normal human email must pass through untouched.
 * A false positive here means a paying customer emails in and never hears back — the highest-severity
 * failure this guard can have — so the human-passthrough cases are the load-bearing ones.
 */
describe("detectAutomatedSender — fires on automated signals", () => {
  it("RFC 3834 Auto-Submitted with any value other than 'no'", () => {
    for (const v of ["auto-generated", "auto-replied", "auto-notified"]) {
      const r = detectAutomatedSender([{ Name: "Auto-Submitted", Value: v }], "x@y.com");
      expect(r.automated).toBe(true);
      expect(r.reason).toBe(`auto-submitted:${v}`);
    }
  });

  it("Auto-Submitted is case-insensitive on the header NAME", () => {
    const r = detectAutomatedSender([{ Name: "auto-submitted", Value: "auto-generated" }], "x@y.com");
    expect(r.automated).toBe(true);
  });

  it("Precedence: bulk / list / junk", () => {
    for (const v of ["bulk", "list", "junk", "BULK"]) {
      expect(detectAutomatedSender([{ Name: "Precedence", Value: v }], "x@y.com").automated).toBe(true);
    }
  });

  it("mailing-list markers (List-Id, List-Unsubscribe)", () => {
    expect(detectAutomatedSender([{ Name: "List-Id", Value: "<news.acme.com>" }], "x@y.com").reason).toBe("list-id");
    expect(
      detectAutomatedSender([{ Name: "List-Unsubscribe", Value: "<https://…>" }], "x@y.com").reason
    ).toBe("list-unsubscribe");
  });

  it("non-monitored From mailboxes (daemon / no-reply / bounce)", () => {
    for (const from of [
      "mailer-daemon@host.com",
      "MAILER-DAEMON@Host.com",
      "no-reply@brand.com",
      "noreply@brand.com",
      "do-not-reply@brand.com",
      "bounces@brand.com",
      "postmaster@host.com",
    ]) {
      const r = detectAutomatedSender([], from);
      expect(r.automated, from).toBe(true);
      expect(r.reason, from).toContain("no-reply-sender:");
    }
  });
});

describe("detectAutomatedSender — NEVER silences a human (the load-bearing half)", () => {
  it("a plain human email with normal threading headers passes through", () => {
    const r = detectAutomatedSender(
      [
        { Name: "In-Reply-To", Value: "<abc@mail>" },
        { Name: "References", Value: "<abc@mail>" },
        { Name: "Auto-Submitted", Value: "no" }, // explicit 'no' must NOT trip
      ],
      "jane.doe@customer.com"
    );
    expect(r.automated).toBe(false);
    expect(r.reason).toBeNull();
  });

  it("no headers at all → treated as human (fail-open toward answering the customer)", () => {
    expect(detectAutomatedSender(undefined, "jane@customer.com").automated).toBe(false);
    expect(detectAutomatedSender([], "jane@customer.com").automated).toBe(false);
  });

  it("a From that merely CONTAINS a trigger word but isn't that mailbox is not suppressed", () => {
    // "noreply" as a substring of a real name-based local part must not match the exact-set check.
    expect(detectAutomatedSender([], "jenny.noreplyson@customer.com").automated).toBe(false);
    expect(detectAutomatedSender([], "bounceback.sam@customer.com").automated).toBe(false);
  });

  it("Precedence values that are not bulk/list/junk pass through", () => {
    expect(detectAutomatedSender([{ Name: "Precedence", Value: "first-class" }], "x@customer.com").automated).toBe(
      false
    );
  });
});
