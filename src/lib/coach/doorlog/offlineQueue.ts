"use client";

/**
 * Door Log offline queue (Macro Mode, Q7 = full offline). Reps work in driveways with one bar, so every
 * write is durably queued in IndexedDB FIRST, then drained to the server; the drain removes an item only
 * on a confirmed success. Server-side dedupe on `client_knock_id` makes a re-send idempotent, so an item
 * that was actually accepted but whose response was lost never double-logs.
 *
 * The No-Answer button in particular works with the network fully off: enqueue() touches only IndexedDB.
 *
 * ⚠️ WITHHELD / DORMANT (founder 2026-08-18): the offline system is on hold until its build plan/structure
 * is set. No live surface imports this module right now — DoorLog.tsx sends online-only — so it is never
 * bundled into the client and cannot interfere. It is preserved (with its gate test) for a clean re-enable:
 * re-wire DoorLog's noAnswer/save back to enqueue()+drainQueue() and restore startAutoDrain() on mount.
 */

const DB_NAME = "doorlog-offline-v1";
const STORE = "pending";

export type QueuedWrite = {
  id: string; // = client_knock_id (idempotency key)
  body: Record<string, unknown>; // the door-log POST body (knock or pitch, sans storagePath for pitches)
  blob?: Blob; // pitch audio, if any
  createdAt: number;
};

type UploadFn = (bucket: string, path: string, token: string, blob: Blob) => Promise<boolean>;

/**
 * The queue's durable backend. The production store is IndexedDB (idbStore below); the seam exists so the
 * data-integrity invariant of the drain — an item is removed ONLY on a confirmed send, never on a failure —
 * can be gate-tested against an in-memory fake (vitest runs in node, which has no IndexedDB).
 */
export type QueueStore = {
  put(item: QueuedWrite): Promise<void>;
  getAll(): Promise<QueuedWrite[]>;
  delete(id: string): Promise<void>;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const store = db.transaction(STORE, mode).objectStore(STORE);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

/** The production store: IndexedDB. Each op swallows its own failure (private mode / quota) exactly as the
 *  standalone helpers did before — enqueue's fallback is the caller's immediate fetch; reads/deletes are
 *  best-effort. */
export const idbStore: QueueStore = {
  async put(item) {
    try {
      await tx("readwrite", (s) => s.put(item));
    } catch {
      /* IndexedDB unavailable (private mode / quota) — the immediate fetch in the caller is the fallback */
    }
  },
  async getAll() {
    try {
      return (await tx<QueuedWrite[]>("readonly", (s) => s.getAll())) ?? [];
    } catch {
      return [];
    }
  },
  async delete(id) {
    try {
      await tx("readwrite", (s) => s.delete(id));
    } catch {
      /* best-effort */
    }
  },
};

/** Durably queue a write. Returns after the local write only — never touches the network. */
export async function enqueue(item: QueuedWrite, store: QueueStore = idbStore): Promise<void> {
  await store.put(item);
}

const DOOR_LOG_URL = "/api/coach/sales-session/door-log";
const AUDIO_BUCKET = "assets-v1";

/** Send one queued write: upload its audio (if any) via a signed target, then POST it. Returns true iff
 *  the server confirmed it (so the item can be removed from the queue). */
async function flushOne(item: QueuedWrite, uploadToSignedUrl: UploadFn): Promise<boolean> {
  let storagePath = "";
  if (item.blob) {
    const signRes = await fetch(DOOR_LOG_URL, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "sign" }),
    }).catch(() => null);
    if (signRes?.ok) {
      const { storagePath: sp, token } = await signRes.json();
      const ok = await uploadToSignedUrl(AUDIO_BUCKET, sp, token, item.blob);
      if (ok) storagePath = sp;
      // If the audio upload fails we still record the pitch (Report Card shows the failure, not the Door Log).
    }
  }
  const res = await fetch(DOOR_LOG_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...item.body, ...(item.blob ? { storagePath } : {}) }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Drain the whole queue. Items that fail (offline) stay queued for the next drain. The store + per-item
 *  flush are injectable so the remove-only-on-success invariant can be tested without IndexedDB or network;
 *  production passes neither and gets the IndexedDB store + the real signed-upload flush. */
export async function drainQueue(
  uploadToSignedUrl: UploadFn,
  deps: { store?: QueueStore; flush?: (item: QueuedWrite, upload: UploadFn) => Promise<boolean> } = {}
): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  const store = deps.store ?? idbStore;
  const flush = deps.flush ?? flushOne;
  const items = (await store.getAll()).sort((a, b) => a.createdAt - b.createdAt);
  let sent = 0;
  for (const item of items) {
    try {
      if (await flush(item, uploadToSignedUrl)) {
        await store.delete(item.id);
        sent += 1;
      }
    } catch {
      /* leave it queued; next drain retries */
    }
  }
  return sent;
}

/** Wire auto-drain: on reconnect + a periodic sweep. Returns a cleanup fn. */
export function startAutoDrain(uploadToSignedUrl: UploadFn): () => void {
  const run = () => void drainQueue(uploadToSignedUrl);
  run(); // drain anything left from a previous session on mount
  window.addEventListener("online", run);
  const iv = setInterval(run, 30_000);
  return () => {
    window.removeEventListener("online", run);
    clearInterval(iv);
  };
}
