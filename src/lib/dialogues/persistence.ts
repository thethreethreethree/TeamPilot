"use client";

/**
 * Local persistence for in-progress dialogues (Decision + Conversation).
 *
 * Mirrors the pattern from src/lib/diagnosis/persistence.ts. Uses localStorage,
 * scoped by dialogue kind. Survives refresh and navigation. Not synced across
 * browsers/devices (that requires Supabase).
 *
 * When the Supabase-backed dialogues persistence layer fully lands, this file
 * becomes the offline-mode fallback — same shape, same API.
 */

type DialogueKind = "decision" | "conversation";

type PersistedDialogue<T> = {
  state: T;
  savedAt: string;
};

const KEY_PREFIX = "execos.dialogue.v1.";

function key(kind: DialogueKind): string {
  return KEY_PREFIX + kind;
}

export function loadDialogue<T>(kind: DialogueKind): PersistedDialogue<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key(kind));
    if (!raw) return null;
    return JSON.parse(raw) as PersistedDialogue<T>;
  } catch {
    return null;
  }
}

export function saveDialogue<T>(kind: DialogueKind, state: T): void {
  if (typeof window === "undefined") return;
  try {
    const persisted: PersistedDialogue<T> = {
      state,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(key(kind), JSON.stringify(persisted));
  } catch {
    // localStorage full or disabled — silent failure is correct here.
  }
}

export function clearDialogue(kind: DialogueKind): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key(kind));
  } catch {
    /* ignore */
  }
}
