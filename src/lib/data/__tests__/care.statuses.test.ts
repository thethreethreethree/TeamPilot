import { describe, it, expect, vi } from "vitest";

/**
 * The "open conversation" status set — regression lock for a real bug.
 *
 * fetchCareCommandStats previously filtered openCount on
 * ["new","open","assigned","waiting"] and awaitingFirstReplyCount on
 * status='new'. None of 'new'/'assigned'/'waiting' are valid statuses (the 0034
 * enum is open/in_conversation/awaiting_customer/resolved/closed), so openCount
 * silently collapsed to just 'open' (dropping every agent-engaged conversation)
 * and awaitingFirstReplyCount was PERMANENTLY 0. These pin the corrected set so
 * the phantom vocabulary can't creep back.
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import {
  OPEN_CONVERSATION_STATUSES,
  AWAITING_FIRST_REPLY_STATUS,
} from "../care";

// The real, schema-valid non-terminal statuses (0034 enum minus resolved/closed).
const VALID_OPEN = ["open", "in_conversation", "awaiting_customer"];
const PHANTOM = ["new", "assigned", "waiting"];

describe("OPEN_CONVERSATION_STATUSES", () => {
  it("is exactly the three schema-valid non-terminal statuses", () => {
    expect([...OPEN_CONVERSATION_STATUSES].sort()).toEqual([...VALID_OPEN].sort());
  });

  it("contains NO phantom statuses (the bug: new/assigned/waiting)", () => {
    for (const p of PHANTOM) {
      expect(OPEN_CONVERSATION_STATUSES).not.toContain(p);
    }
  });

  it("excludes the terminal statuses resolved/closed", () => {
    expect(OPEN_CONVERSATION_STATUSES).not.toContain("resolved");
    expect(OPEN_CONVERSATION_STATUSES).not.toContain("closed");
  });
});

describe("AWAITING_FIRST_REPLY_STATUS", () => {
  it("is 'open' (AI first responder, no agent yet) — not the phantom 'new'", () => {
    expect(AWAITING_FIRST_REPLY_STATUS).toBe("open");
    expect(AWAITING_FIRST_REPLY_STATUS).not.toBe("new");
  });

  it("is itself an open status (awaiting-first-reply ⊆ open)", () => {
    expect(OPEN_CONVERSATION_STATUSES).toContain(AWAITING_FIRST_REPLY_STATUS);
  });
});
