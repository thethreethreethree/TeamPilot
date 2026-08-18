import { describe, it, expect, vi, afterEach } from "vitest";
import { drainQueue, enqueue, type QueuedWrite, type QueueStore } from "../offlineQueue";

/**
 * Offline queue drain contract (Macro Mode, Q7 = full offline). THE data-integrity invariant: the drain
 * removes a queued write ONLY on a confirmed send. A failed send (offline, 5xx, thrown) must LEAVE the item
 * queued for the next drain — a dropped knock/pitch is exactly the silent data-loss this feature exists to
 * prevent. The store + per-item flush are injected here (vitest's node env has no IndexedDB); production runs
 * the real IndexedDB store + signed-upload flush.
 */

const noopUpload = async () => true;

function memStore(seed: QueuedWrite[] = []): QueueStore & { items: Map<string, QueuedWrite> } {
  const items = new Map(seed.map((i) => [i.id, i]));
  return {
    items,
    async put(item) {
      items.set(item.id, item);
    },
    async getAll() {
      return [...items.values()];
    },
    async delete(id) {
      items.delete(id);
    },
  };
}

const w = (id: string, createdAt = 1): QueuedWrite => ({ id, body: { kind: "knock" }, createdAt });

afterEach(() => vi.unstubAllGlobals());

describe("drainQueue — remove-only-on-success (no lost write)", () => {
  it("a CONFIRMED send removes the item from the queue", async () => {
    const store = memStore([w("a")]);
    const sent = await drainQueue(noopUpload, { store, flush: async () => true });
    expect(sent).toBe(1);
    expect(store.items.has("a")).toBe(false);
  });

  it("THE GATE: a FAILED send LEAVES the item queued (never dropped)", async () => {
    const store = memStore([w("a")]);
    const sent = await drainQueue(noopUpload, { store, flush: async () => false });
    expect(sent).toBe(0);
    expect(store.items.has("a")).toBe(true); // survives for the next drain
  });

  it("a THROWN send LEAVES the item queued (retry next drain)", async () => {
    const store = memStore([w("a")]);
    const sent = await drainQueue(noopUpload, {
      store,
      flush: async () => {
        throw new Error("network died mid-flush");
      },
    });
    expect(sent).toBe(0);
    expect(store.items.has("a")).toBe(true);
  });

  it("mixed batch: only the confirmed items are removed; the rest stay", async () => {
    const store = memStore([w("ok"), w("fail"), w("ok2")]);
    const sent = await drainQueue(noopUpload, {
      store,
      flush: async (item) => item.id.startsWith("ok"),
    });
    expect(sent).toBe(2);
    expect(store.items.has("ok")).toBe(false);
    expect(store.items.has("ok2")).toBe(false);
    expect(store.items.has("fail")).toBe(true); // the one failure is not lost
  });

  it("drains oldest-first (createdAt order) so a partial drain sends the longest-waiting writes", async () => {
    const store = memStore([w("new", 300), w("old", 100), w("mid", 200)]);
    const order: string[] = [];
    await drainQueue(noopUpload, {
      store,
      flush: async (item) => {
        order.push(item.id);
        return true;
      },
    });
    expect(order).toEqual(["old", "mid", "new"]);
  });

  it("when offline (navigator.onLine === false) it sends nothing and touches no item", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const store = memStore([w("a")]);
    const flush = vi.fn(async () => true);
    const sent = await drainQueue(noopUpload, { store, flush });
    expect(sent).toBe(0);
    expect(flush).not.toHaveBeenCalled(); // no send attempted at all
    expect(store.items.has("a")).toBe(true); // still queued
  });
});

describe("enqueue — durable local write", () => {
  it("writes the item into the store (the No-Answer button works with the network off)", async () => {
    const store = memStore();
    await enqueue(w("a"), store);
    expect(store.items.get("a")?.id).toBe("a");
  });
});
