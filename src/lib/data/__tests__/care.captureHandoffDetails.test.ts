import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * captureHandoffDetails (0188) is the handoff card's persistence path, and its branches are
 * load-bearing: (1) email → dedupe-upsert the customer on (company_id, email), lowercased;
 * (2) name-only → insert; (3) pre-0188 the concern/order columns don't exist → the write must
 * DEGRADE (still link the customer) and SIGNAL concernDeferred, never fail the whole capture
 * (A34/§3.4); (4) a failed customer write must be LOGGED, never silent (§3.4). These pin all four.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { captureHandoffDetails } from "../care";

type Call = [string, unknown[]];
const find = (calls: Call[], m: string) => calls.find(([x]) => x === m);
const findArg0 = (calls: Call[], m: string) =>
  (find(calls, m)?.[1][0] ?? undefined) as Record<string, unknown> | undefined;

describe("captureHandoffDetails", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("email path: upserts the customer on (company_id, email) lowercased, links + stores concern", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        {
          support_customers: { data: { id: "cust1" }, error: null },
          support_conversations: { error: null },
        },
        calls
      ) as never
    );

    const r = await captureHandoffDetails({
      conversationId: "cv1",
      companyId: "co1",
      name: "Maria",
      email: "Maria@Example.COM",
      topic: "billing",
      orderNumber: "4471",
    });

    const upsert = findArg0(calls, "upsert");
    expect(upsert).toMatchObject({ company_id: "co1", email: "maria@example.com", name: "Maria" });
    const update = findArg0(calls, "update");
    expect(update).toMatchObject({ customer_id: "cust1", handoff_topic: "billing", order_number: "4471" });
    expect(r).toEqual({ ok: true, customerId: "cust1" });
  });

  it("name-only path: inserts the customer (no email to dedupe on)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        {
          support_customers: { data: { id: "cust2" }, error: null },
          support_conversations: { error: null },
        },
        calls
      ) as never
    );

    const r = await captureHandoffDetails({ conversationId: "cv1", companyId: "co1", name: "Bob" });

    expect(findArg0(calls, "insert")).toMatchObject({ company_id: "co1", name: "Bob" });
    expect(find(calls, "upsert")).toBeUndefined(); // no email → insert, not upsert
    expect(r).toEqual({ ok: true, customerId: "cust2" });
  });

  it("pre-0188: missing concern columns → degrades to customer link + concernDeferred", async () => {
    let convUpdateCall = 0;
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        {
          support_customers: { data: { id: "cust3" }, error: null },
          // First update (with concern cols) fails missing-column; retry (customer_id only) succeeds.
          support_conversations: () =>
            convUpdateCall++ === 0
              ? { error: { code: "PGRST204", message: "Could not find the 'handoff_topic' column of 'support_conversations' in the schema cache" } }
              : { error: null },
        },
        calls
      ) as never
    );

    const r = await captureHandoffDetails({
      conversationId: "cv1",
      companyId: "co1",
      email: "x@y.com",
      topic: "billing",
    });

    expect(r).toEqual({ ok: true, customerId: "cust3", concernDeferred: true });
    expect(convUpdateCall).toBe(2); // it retried the conversation write without the new columns
  });

  it("logs (never silently loses) a failed customer upsert", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        {
          support_customers: { data: null, error: { message: "rls denied" } },
          support_conversations: { error: null },
        },
        calls
      ) as never
    );

    const r = await captureHandoffDetails({
      conversationId: "cv1",
      companyId: "co1",
      email: "x@y.com",
      topic: "billing",
    });

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("customer upsert failed"));
    // Identity write failed (customerId null) but the concern still persisted — capture isn't lost.
    expect(r.customerId).toBeNull();
    expect(r.ok).toBe(true);
    errSpy.mockRestore();
  });
});
