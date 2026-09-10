/**
 * The crash log a rep can actually see and send.
 *
 * WHY THIS EXISTS SEPARATELY FROM `crash-init.ts`. That module hands errors to a
 * third-party service, and it only works if somebody has bought one and set a
 * DSN. Today no DSN is set, which means the honest description of this app's
 * crash reporting until now was: **when it breaks on a rep's phone in the field,
 * nobody ever finds out.** The screen said "that did not work", the rep shrugged,
 * and the evidence died with the process.
 *
 * This is the system that does not depend on anyone buying anything. The phone
 * keeps its own short log of what broke; the rep can open it from the menu, read
 * it in plain words, and send it. No account, no DSN, no third party in the path
 * at all — which for an app that records customer conversations is not a
 * compromise, it is the better arrangement.
 *
 * PURE ON PURPOSE. Storage and the share sheet are native and cannot load under
 * `node --test`. The rules about what is kept, what is dropped, and what a report
 * is allowed to contain are exactly the rules that must be tested, so they live
 * here and import only the scrubber.
 *
 * THE SCRUBBER IS THE SAME ONE. A report a rep sends by email is no less a
 * disclosure than a report a machine sends to a crash service — a signed
 * recording URL in either one hands over a real customer conversation. So both
 * paths go through `scrub`, and there is no second, softer set of rules for the
 * local one.
 */
import { MAX_REPORTED_TEXT, isSensitive, scrub } from './crash-reporting';

/**
 * How many failures the phone keeps.
 *
 * Small deliberately. This is a debugging aid, not an archive: what fixes a bug
 * is the most recent handful, and an unbounded list on a device that may already
 * be holding audio is a storage leak nobody would notice until it mattered.
 */
export const MAX_KEPT = 20;

/** Stack frames kept per entry. Enough to place the fault; not a memory dump. */
export const MAX_FRAMES = 12;

export type CrashEntry = {
  /** Stable per entry so the list can key on it and a report can cite it. */
  id: string;
  /** ISO instant the failure was recorded on THIS phone. */
  at: string;
  /** Where in the app it happened — a boundary name, not a file path. */
  where: string;
  /** The error, scrubbed. Never raw. */
  message: string;
  /** Scrubbed frames, or null when the error carried none. */
  frames: string[] | null;
  /**
   * How many times in a row this exact failure happened. Absent means once.
   *
   * Optional rather than always-1 so that a log written by an earlier version
   * reads back without a migration — `parseEntries` must never reject an entry
   * for lacking a field that did not exist when it was written.
   */
  repeats?: number;
};

/**
 * Turn a thrown thing into an entry.
 *
 * `unknown` rather than `Error` because that is what a `catch` and an error
 * boundary actually hand you: code throws strings, promises reject with objects,
 * and a crash reporter that assumes `Error` throws inside itself at the exact
 * moment it is needed.
 */
export function makeEntry(error: unknown, where: string, at: Date, id: string): CrashEntry {
  return {
    id,
    at: at.toISOString(),
    where: scrub(where) ?? 'unknown',
    message: scrub(messageOf(error)) ?? 'Something failed without saying what.',
    frames: framesOf(error),
  };
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  // An object thrown by a library. Its shape is unknown, so it is described
  // rather than serialized — JSON.stringify on an arbitrary reject value is how
  // a whole response body, transcript included, ends up in a report.
  return `A ${typeof error} was thrown instead of an error.`;
}

/**
 * Stack frames, trimmed and checked one at a time.
 *
 * A frame is a file path and a line number, which is normally harmless — but
 * "normally" is not a rule. Each frame goes through the same sensitivity test as
 * everything else, because a bundled URL can carry a query string and a query
 * string can carry a token.
 */
function framesOf(error: unknown): string[] | null {
  if (!(error instanceof Error) || typeof error.stack !== 'string') return null;
  const frames = error.stack
    .split('\n')
    .slice(1) // line 0 repeats the message, which is already kept and scrubbed
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_FRAMES)
    .map((line) => (isSensitive(line) ? '[removed: could identify a conversation]' : line))
    .map((line) => (line.length > MAX_REPORTED_TEXT ? `${line.slice(0, MAX_REPORTED_TEXT)}…` : line));
  return frames.length > 0 ? frames : null;
}

/**
 * Add one entry, newest first, capped.
 *
 * NEWEST FIRST because the screen shows this list top-down and the thing a rep
 * just watched happen is the thing they are opening the screen about. Capping
 * here rather than at read time means the cap is what is actually stored.
 */
export function addEntry(entries: CrashEntry[], entry: CrashEntry): CrashEntry[] {
  /**
   * THE SAME FAILURE TWENTY TIMES IS ONE FACT, NOT TWENTY ROWS.
   *
   * This is what keeps the log readable now that caught failures reach it. An
   * outbox retries: a rep standing in a dead zone with a server that refuses
   * their knocks produces the identical entry every sweep, and without this the
   * twenty slots fill with one failure and push out everything else — the log
   * would be at its least useful exactly when the most is going wrong.
   *
   * Only the NEWEST entry is collapsed into, deliberately. Two different
   * failures alternating are two real facts and both deserve a row; folding a
   * repeat into an older entry would also lie about when it last happened.
   */
  const newest = entries[0];
  if (newest && newest.where === entry.where && newest.message === entry.message) {
    const merged: CrashEntry = {
      ...entry,
      // The id and time of the LATEST occurrence, because "when did this last
      // happen" is the question somebody reading the report is asking.
      repeats: (newest.repeats ?? 1) + 1,
    };
    return [merged, ...entries.slice(1)];
  }
  return [entry, ...entries].slice(0, MAX_KEPT);
}

/**
 * Read a stored list back.
 *
 * Tolerant by design: a corrupt or half-written log must produce an empty list,
 * never an exception. This runs on a screen a rep opens BECAUSE something is
 * already broken, and a crash log that crashes is worse than none.
 */
export function parseEntries(raw: string | null | undefined): CrashEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry).slice(0, MAX_KEPT);
  } catch {
    return [];
  }
}

function isEntry(value: unknown): value is CrashEntry {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.at === 'string' &&
    typeof v.where === 'string' &&
    typeof v.message === 'string' &&
    (v.frames === null || v.frames === undefined || Array.isArray(v.frames))
  );
}

/** What the app knows about itself, passed in because all of it is native. */
export type ReportContext = {
  appVersion: string | null;
  platform: string | null;
  osVersion: string | null;
  /** Present only when the rep is signed in; identifies the ACCOUNT, never the person. */
  userId: string | null;
};

/**
 * The text a rep sends.
 *
 * PLAIN TEXT, not JSON. Whoever receives this is a human being reading it in a
 * mail client — probably a manager forwarding it on — and a wall of JSON is a
 * wall of JSON. It is written to be skimmed by someone who is not a developer
 * and then read closely by someone who is.
 *
 * THE HEADER IS ALWAYS PRESENT even with no failures, because "nothing was
 * recorded" is itself the useful answer when a rep is reporting something the
 * app never noticed going wrong.
 */
export function formatReport(
  entries: CrashEntry[],
  context: ReportContext,
  note?: string | null,
  /**
   * What the connection check found, if the rep ran it.
   *
   * IT TRAVELS WITH THE REPORT, and leaving it out was a real hole. The check
   * ends by telling the rep "Send this screen - the number is what somebody
   * needs", and the Send button sits directly beneath it — so a rep does exactly
   * that, and the one line worth reading never leaves the phone. Whether the
   * service accepted or refused this account is the single fact that separates
   * "your signal", "the service is down" and "your sign-in is not accepted",
   * which is precisely what nobody could tell anybody on 4 September.
   *
   * Plain lines rather than the report object, so this module stays free of the
   * check's types and cannot drift with them.
   */
  connection?: string[] | null,
): string {
  const lines: string[] = ['Elostate Sales Coach — problem report', ''];

  const cleanNote = scrub(note);
  if (cleanNote) {
    lines.push('What happened, in the rep’s own words:', cleanNote, '');
  }

  lines.push(
    `App version: ${context.appVersion ?? 'unknown'}`,
    `Device: ${`${context.platform ?? 'unknown'} ${context.osVersion ?? ''}`.trim()}`,
    `Account: ${context.userId ?? 'not signed in'}`,
    `Recorded failures: ${entries.length}`,
    '',
  );

  const conn = (connection ?? []).map((l) => scrub(l)).filter(Boolean);
  if (conn.length > 0) {
    lines.push('Connection check:', ...conn.map((l) => `  ${l}`), '');
  }

  if (entries.length === 0) {
    lines.push('The app did not record any failure on this phone.');
    lines.push(
      'If something went wrong, it went wrong without the app noticing — which is itself worth knowing.',
    );
    return lines.join('\n');
  }

  entries.forEach((entry, i) => {
    const times = entry.repeats && entry.repeats > 1 ? ` (${entry.repeats} times, last at this time)` : '';
    lines.push(`${i + 1}. ${entry.where} — ${entry.at}${times}`);
    lines.push(`   ${entry.message}`);
    if (entry.frames) entry.frames.forEach((frame) => lines.push(`     ${frame}`));
    lines.push('');
  });

  lines.push('No transcript, recording or customer detail is included in this report.');
  return lines.join('\n');
}

/**
 * What the LIST shows for one entry.
 *
 * A rep is not a developer and `TypeError: undefined is not an object` tells
 * them nothing they can act on. So the row leads with the place and the time,
 * which they can match to what they were doing, and keeps the raw message
 * underneath for whoever ends up reading the report.
 */
export function describeEntry(
  entry: CrashEntry,
  formatAt: (iso: string) => string,
): { title: string; detail: string } {
  const times = entry.repeats && entry.repeats > 1 ? ` · ${entry.repeats} times` : '';
  return {
    title: `${entry.where} · ${formatAt(entry.at)}${times}`,
    detail: entry.message,
  };
}

/**
 * What the screen says when the log is empty.
 *
 * "No crashes" would be a lie dressed as good news: an empty log also happens on
 * a fresh install, after a sign-out sweep, and when a failure took the process
 * down before anything could be written. The copy says what is true — nothing
 * was recorded — and does not claim nothing went wrong.
 */
export const EMPTY_LOG_TITLE = 'Nothing has been recorded on this phone';
export const EMPTY_LOG_BODY =
  'That usually means the app has not hit a problem it could catch. It is not proof nothing went wrong — you can still send a report describing what you saw, and it will carry the details of this phone and this version with it.';

/**
 * How the app names its own version in a problem report.
 *
 * "1.0.0" ALONE IS NOT ENOUGH, and TestFlight is where that stops being
 * theoretical. The marketing version stays 1.0.0 across every build you upload,
 * so a report from build 3 and a report from build 7 read identically — and the
 * first question anyone asks about a bug is which build it came from.
 *
 * The build number is the binary's own `CFBundleVersion` (Android:
 * `versionCode`), which never changes for a given binary even if the JavaScript
 * is updated over the air. That is exactly the property wanted here: it names
 * the thing the rep is actually running.
 *
 * PURE, and it takes both values rather than reading them, because
 * `expo-constants` is native and this module is tested.
 */
export function versionLine(version: string | null, build: string | null): string {
  const v = version?.trim();
  const b = build?.trim();
  if (!v && !b) return 'unknown';
  if (!b) return v as string;
  // Parenthesised, the way Apple and Android both write it, so it reads as one
  // version rather than two numbers a reader has to relate.
  if (!v) return `build ${b}`;
  return `${v} (${b})`;
}
