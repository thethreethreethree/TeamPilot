/**
 * Where the crash log lives on this phone.
 *
 * SPLIT FROM `crash-log.ts` for the reason this project has now hit seven times:
 * AsyncStorage is a native module, so anything importing it cannot load under
 * `node --test`. The rules — what is kept, what is dropped, what a report may
 * contain — are in the pure module and are tested. This file is the dumb half.
 *
 * NOT CLEARED ON SIGN-OUT, and that is a decision rather than an oversight.
 * The sign-out sweep exists to stop one rep's calls, transcripts and figures
 * reaching the next person to hold the phone. A crash entry holds none of those:
 * it is a scrubbed error string and a stack frame, with no account id in it —
 * the account is attached at SEND time, from the session that is live then.
 * Meanwhile the single most common way a rep loses their evidence is signing out
 * and back in to see whether that fixes it. Wiping the log at exactly that moment
 * would destroy the report they were about to send.
 *
 * EVERY CALL SWALLOWS ITS OWN FAILURE. This runs when something has already gone
 * wrong. A crash recorder that throws while recording a crash replaces a
 * legible error with an illegible one.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { type CrashEntry, addEntry, makeEntry, parseEntries } from './crash-log';

const KEY = 'crash-log.v1';

export async function readCrashLog(): Promise<CrashEntry[]> {
  try {
    return parseEntries(await AsyncStorage.getItem(KEY));
  } catch {
    // Unreadable storage is an empty log. The screen says so honestly rather
    // than showing a spinner that never resolves.
    return [];
  }
}

/**
 * Record one failure.
 *
 * Read-modify-write, which can lose an entry if two failures land in the same
 * millisecond. Accepted: the alternative is a lock in the crash path, and a
 * crash recorder that can block is worse than one that can drop the second of
 * two simultaneous errors — they are almost always the same error twice.
 */
export async function recordCrash(error: unknown, where: string): Promise<void> {
  try {
    const entry = makeEntry(error, where, new Date(), newId());
    const next = addEntry(await readCrashLog(), entry);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Nothing to do and nowhere to say it. The console line in `crash-init`
    // has already run by the time this is called.
  }
}

export async function clearCrashLog(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // The screen re-reads after this and will show what is actually there, so a
    // failed clear shows as "still here" rather than a false confirmation.
  }
}

/**
 * An id that is unique enough for a list key and a line in a report.
 *
 * Not `crypto.randomUUID` — that is not present on every React Native runtime
 * this app targets, and reaching for it here would mean the crash recorder
 * throws on exactly the older device most likely to be crashing.
 */
function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
