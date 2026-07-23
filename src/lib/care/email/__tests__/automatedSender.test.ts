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

  it("Exchange/Outlook X-Auto-Response-Suppress marker (any value)", () => {
    for (const v of ["All", "OOF", "AutoReply", "DR, RN, NRN, OOF, AutoReply"]) {
      const r = detectAutomatedSender([{ Name: "X-Auto-Response-Suppress", Value: v }], "x@y.com");
      expect(r.automated, v).toBe(true);
      expect(r.reason).toBe("x-auto-response-suppress");
    }
  });

  it("out-of-office SUBJECT prefix (the dominant real-world OOO, often header-less)", () => {
    for (const s of [
      "Automatic reply: Re: your inquiry",
      "Auto-Reply: I'm away",
      "AutoReply: out until Monday",
      "Out of Office AutoReply: back next week",
      "Out of Office: on leave",
      "  automatic reply: (leading space, case-insensitive)",
    ]) {
      const r = detectAutomatedSender([], "jane@customer.com", s);
      expect(r.automated, s).toBe(true);
      expect(r.reason).toBe("ooo-subject");
    }
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

  it("a normal subject is NOT flagged as OOO (anchored at start AND requires the trailing colon)", () => {
    for (const s of [
      "Question about my order",
      "Re: refund status",
      "I need to reply to your automatic system", // contains 'automatic' but not as a prefix
      "Where is my out of office parcel?", // contains 'out of office' mid-subject, not a prefix
      // Load-bearing: a real customer ASKING about an auto-reply / OOO feature starts with the word but
      // has NO colon — must not be suppressed (the colon is what distinguishes the Outlook OOO subject).
      "Auto-reply not working on my account",
      "Automatic reply feature is broken",
      "Out of office setting won't save",
      undefined, // no subject at all
    ]) {
      expect(detectAutomatedSender([], "jane@customer.com", s).automated, String(s)).toBe(false);
    }
  });
});
