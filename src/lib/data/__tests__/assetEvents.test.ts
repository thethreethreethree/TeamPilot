import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * emitAssetEvent is the §3.1 render path for the asset event vocabulary — it
 * inserts into `events` with a FIXED contract the asset-readout consumers depend
 * on (subject `file:<id>`, payload always carrying file_id). This pins that
 * contract (§A14 — the emit shape IS an interface) and the two documented
 * properties: a null actor is allowed (customer-widget path), and emission is
 * best-effort (a failed insert is logged, never thrown, so it can't break the
 * upload it accompanies).
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { emitAssetEvent } from "../assetEvents";

describe("emitAssetEvent (DB-mock)", () => {
  let calls: Array<[string, unknown[]]>;
  beforeEach(() => {
    calls = [];
    vi.clearAllMocks();
  });

  it("inserts into events with the file:<id> subject and merged payload", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ events: { data: [] } }, calls) as never
    );
    await emitAssetEvent({
      companyId: "co1",
      actor: "u1",
      kind: "asset.file.uploaded",
      fileId: "f9",
      payload: { size_bytes: 100 },
    });
    const insert = calls.find(([m]) => m === "insert");
    expect(insert).toBeTruthy();
    expect(insert![1][0]).toMatchObject({
      company_id: "co1",
      actor: "u1",
      kind: "asset.file.uploaded",
      subject: "file:f9",
      payload: { file_id: "f9", size_bytes: 100 },
    });
  });

  it("allows a null actor (customer-widget path, no authenticated user)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ events: { data: [] } }, calls) as never
    );
    await emitAssetEvent({
      companyId: "co1",
      actor: null,
      kind: "asset.file.uploaded",
      fileId: "f9",
    });
    const insert = calls.find(([m]) => m === "insert");
    expect((insert![1][0] as Record<string, unknown>).actor).toBeNull();
  });

  it("is best-effort — a failed insert is not thrown (can't break the upload)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ events: { data: null, error: { message: "rls" } } }, calls) as never
    );
    await expect(
      emitAssetEvent({ companyId: "co1", actor: "u1", kind: "asset.file.cited", fileId: "f9" })
    ).resolves.toBeUndefined();
    spy.mockRestore();
  });
});
