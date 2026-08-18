"use client";

/**
 * Door Log offline queue (Macro Mode, Q7 = full offline). Reps work in driveways with one bar, so every
 * write is durably queued in IndexedDB FIRST, then drained to the server; the drain removes an item only
 * on a confirmed success. Server-side dedupe on `client_knock_id` makes a re-send idempotent, so an item
 * that was actually accepted but whose response was lost never double-logs.
 *
 * The No-Answer button in particular works with the network fully off: enqueue() touches only IndexedDB.
 */

const DB_NAME = "doorlog-offline-v1";
const STORE = "pending";

export type QueuedWrite = {
  id: string; // = client_knock_id (idempotency key)
  body: Record<string, unknown>; // the door-log POST body (knock or pitch, sans storagePath for pitches)
  blob?: Blob; // pitch audio, if any
  createdAt: number;
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

/** Durably queue a write. Returns after the local write only — never touches the network. */
export async function enqueue(item: QueuedWrite): Promise<void> {
  try {
    await tx("readwrite", (s) => s.put(item));
  } catch {
    /* IndexedDB unavailable (private mode / quota) — the immediate fetch in the caller is the fallback */
  }
}

async function allPending(): Promise<QueuedWrite[]> {
  try {
    return (await tx<QueuedWrite[]>("readonly", (s) => s.getAll())) ?? [];
  } catch {
    return [];
  }
}

async function remove(id: string): Promise<void> {
  try {
    await tx("readwrite", (s) => s.delete(id));
  } catch {
    /* best-effort */
  }
}

const DOOR_LOG_URL = "/api/coach/sales-session/door-log";
const AUDIO_BUCKET = "assets-v1";

/** Send one queued write: upload its audio (if any) via a signed target, then POST it. Returns true iff
 *  the server confirmed it (so the item can be removed from the queue). */
async function flushOne(
  item: QueuedWrite,
  uploadToSignedUrl: (bucket: string, path: string, token: string, blob: Blob) => Promise<boolean>
): Promise<boolean> {
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

/** Drain the whole queue. Items that fail (offline) stay queued for the next drain. */
export async function drainQueue(
  uploadToSignedUrl: (bucket: string, path: string, token: string, blob: Blob) => Promise<boolean>
): Promise<number> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return 0;
  const items = (await allPending()).sort((a, b) => a.createdAt - b.createdAt);
  let sent = 0;
  for (const item of items) {
    try {
      if (await flushOne(item, uploadToSignedUrl)) {
        await remove(item.id);
        sent += 1;
      }
    } catch {
      /* leave it queued; next drain retries */
    }
  }
  return sent;
}

/** Wire auto-drain: on reconnect + a periodic sweep. Returns a cleanup fn. */
export function startAutoDrain(
  uploadToSignedUrl: (bucket: string, path: string, token: string, blob: Blob) => Promise<boolean>
): () => void {
  const run = () => void drainQueue(uploadToSignedUrl);
  run(); // drain anything left from a previous session on mount
  window.addEventListener("online", run);
  const iv = setInterval(run, 30_000);
  return () => {
    window.removeEventListener("online", run);
    clearInterval(iv);
  };
}
