/**
 * Report a problem — the crash reporting system, from the rep's side.
 *
 * A COMPONENT WITH TWO ROUTES, and the second one is the point. This screen
 * used to live only under `(app)`, which is behind the auth gate — so a rep who
 * could not SIGN IN had no way to report that they could not sign in. That is
 * the single failure most likely to strand somebody, and it was the one failure
 * the reporting system could not hear about. `(auth)/report-problem` renders
 * this same component, so the way to tell somebody is reachable from the screen
 * a rep is stuck on.
 *
 * It works signed out on purpose: `formatReport` writes "Account: not signed
 * in" rather than leaving a blank, and the phone's log does not need a session
 * to have been written.
 *
 * WHAT THIS REPLACES. Until now, when the app broke on a phone in the field the
 * rep saw "that did not work", and that was the end of it: the error went to a
 * console nobody would ever open, and the crash service the code was written
 * for has never been switched on. The person who watched the failure happen had
 * no way to tell anyone what they saw. That is the gap this closes.
 *
 * THREE THINGS ON ONE SCREEN, in the order a person actually needs them:
 *
 *   1. WHAT THE PHONE RECORDED — in plain rows, so a rep can see the app noticed,
 *      which is the first thing they want to know.
 *   2. WHAT THEY SAW — a labelled box, because the most valuable line in any bug
 *      report is the one only the person standing there could write. Plenty of
 *      failures never throw at all; the app looks fine and does the wrong thing.
 *   3. SEND — the OS share sheet, so it goes by whatever channel this company
 *      already uses. No new backend, no new account, nothing to configure.
 *
 * WHY THE SHARE SHEET RATHER THAN A SERVER CALL. A server endpoint would need a
 * route on the website, a table, and a policy about who may read it — none of
 * which exist, and a crash reporter that ships "later" reports nothing today.
 * The share sheet works on the build the owner is submitting this week. When an
 * endpoint exists, this screen gains a second button and loses nothing.
 *
 * NOTHING FROM A CONVERSATION LEAVES HERE. The report is built by
 * `formatReport`, every field passes the same scrubber the crash service path
 * uses, and the screen says so above the button rather than expecting trust.
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Constants from 'expo-constants';

import {
  EMPTY_LOG_BODY,
  EMPTY_LOG_TITLE,
  MAX_KEPT,
  type CrashEntry,
  describeEntry,
  formatReport,
  versionLine,
} from '@/lib/crash-log';
import { clearCrashLog, readCrashLog } from '@/lib/crash-log-store';
import { useAuth } from '@/lib/auth-context';
import { supabase, currentAccessToken } from '@/lib/supabase';
import { ENV } from '@/lib/env';
import { reportLines, runConnectionCheck, type ConnectionReport } from '@/lib/connection-check';
import { clockTime, shortDate } from '@/lib/format';
import { C } from '@/lib/theme';

/** Date and time together — a crash at 09:12 and one at 16:40 are different events. */
function stamp(iso: string): string {
  try {
    return `${shortDate(iso)}, ${clockTime(iso)}`;
  } catch {
    // A malformed timestamp must not take down the screen a rep opened BECAUSE
    // something is already broken.
    return 'time unknown';
  }
}

export function ReportProblemPage() {
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<ConnectionReport | null>(null);

  /**
   * Ask the coach service whether it accepts this account, and say what it said.
   *
   * The one fact that separates "your signal", "the service is down" and "the
   * service will not accept your sign-in" — and until now it never left the phone.
   */
  const runCheck = useCallback(async () => {
    setChecking(true);
    try {
      setCheck(
        await runConnectionCheck({
          token: currentAccessToken,
          refresh: () => supabase.auth.refreshSession(),
          apiBase: ENV.API_BASE,
        }),
      );
    } finally {
      setChecking(false);
    }
  }, []);

  const { user } = useAuth();
  const [entries, setEntries] = useState<CrashEntry[] | null>(null);
  const [note, setNote] = useState('');
  const [cleared, setCleared] = useState(false);

  const load = useCallback(async () => {
    setEntries(await readCrashLog());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const send = useCallback(async () => {
    const text = formatReport(entries ?? [], {
      /**
       * The marketing version AND the build number.
       *
       * 1.0.0 is the same on every TestFlight build, so on its own it cannot
       * tell a report from build 3 apart from one from build 7 — which is the
       * first thing anyone asks about a bug. `Constants.platform` carries the
       * binary's own CFBundleVersion / versionCode, which never changes for a
       * given binary.
       */
      appVersion: versionLine(
        Constants.expoConfig?.version ?? null,
        Constants.platform?.ios?.buildNumber ??
          (Constants.platform?.android?.versionCode != null
            ? String(Constants.platform.android.versionCode)
            : null),
      ),
      platform: Platform.OS,
      osVersion: String(Platform.Version),
      userId: user?.id ?? null,
    }, note, check ? reportLines(check) : null);
    try {
      await Share.share({ message: text });
    } catch {
      // The rep dismissed the sheet, or the OS refused it. Neither is an error
      // worth a dialog — nothing was lost and the button is still there.
    }
  }, [entries, note, user, check]);

  const clear = useCallback(async () => {
    await clearCrashLog();
    setCleared(true);
    await load();
  }, [load]);

  return (
    <ScrollView className="flex-1" contentContainerClassName="px-5 pb-10 pt-4">
        {/* No title here — the stack header already says "Report a problem", and
            repeating it costs a phone screen's worth of vertical space on the one
            screen somebody opens while already annoyed. */}
        <Text className="font-body text-base leading-6 text-muted-foreground">
          This phone keeps a short list of anything the app caught going wrong. Send it with a line
          about what you saw and someone can work out what happened.
        </Text>

        {/* ---- 1. What the phone recorded ---------------------------------- */}
        <Text
          accessibilityRole="header"
          className="mt-7 font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
        >
          What this phone recorded
        </Text>

        {entries === null ? (
          <View className="py-8">
            <ActivityIndicator color={C.primary} />
          </View>
        ) : entries.length === 0 ? (
          <View className="mt-3 rounded-xl border border-border bg-surface p-4">
            <Text className="font-emphasis text-base text-foreground">
              {cleared ? 'The list is now empty' : EMPTY_LOG_TITLE}
            </Text>
            <Text className="mt-1.5 font-body text-sm leading-5 text-muted-foreground">
              {cleared
                ? 'Anything that goes wrong from here will be recorded again.'
                : EMPTY_LOG_BODY}
            </Text>
          </View>
        ) : (
          <View className="mt-3 gap-2">
            {entries.map((entry) => {
              const { title, detail } = describeEntry(entry, stamp);
              return (
                <View
                  key={entry.id}
                  className="rounded-xl border border-border bg-surface p-4"
                  accessible
                  accessibilityLabel={`${title}. ${detail}`}
                >
                  <Text className="font-emphasis text-sm text-foreground">{title}</Text>
                  <Text className="mt-1 font-body text-sm leading-5 text-muted-foreground">
                    {detail}
                  </Text>
                </View>
              );
            })}
            <Text className="mt-1 font-body text-xs text-muted-foreground">
              The most recent {MAX_KEPT} are kept. Older ones are dropped.
            </Text>
          </View>
        )}

        {/* ---- 2. What the rep saw ----------------------------------------- */}
        {/* A visible label, not a placeholder. A placeholder disappears the
            moment someone types, which is exactly when they need to remember
            what the box was asking for. */}
        <Text
          accessibilityRole="header"
          className="mt-7 font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
        >
          What were you doing?
        </Text>
        <Text className="mt-1.5 font-body text-sm leading-5 text-muted-foreground">
          The most useful part of any report. Which screen, what you tapped, and what happened
          instead of what you expected.
        </Text>
        <TextInput
          accessibilityLabel="What were you doing when the problem happened"
          value={note}
          onChangeText={setNote}
          multiline
          textAlignVertical="top"
          placeholder="I tapped Save after a call and the screen went blank."
          placeholderTextColor={C['muted-foreground']}
          className="mt-3 min-h-24 rounded-xl border border-border-control bg-surface p-4 font-body text-base text-foreground"
        />

        {/* ---- 3. Check the connection ------------------------------------- */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Check the connection"
          accessibilityHint="Asks the coach service whether it accepts this account, and shows the answer"
          disabled={checking}
          onPress={runCheck}
          className="mt-6 min-h-14 items-center justify-center rounded-xl border border-border-control active:opacity-70"
          style={checking ? { opacity: 0.6 } : undefined}
        >
          <Text className="font-emphasis text-base text-foreground">
            {checking ? 'Checking…' : 'Check the connection'}
          </Text>
        </Pressable>
        <Text className="mt-2.5 font-body text-sm leading-5 text-muted-foreground">
          Asks the coach service one question that costs nothing and uses no AI. Run this when a
          coaching feature will not load — the answer says whether the problem is your signal, the
          service, or your account.
        </Text>

        {check ? (
          <View
            accessibilityLiveRegion="polite"
            className="mt-3 rounded-xl border border-primary bg-surface p-4"
          >
            {reportLines(check).map((line) => (
              <Text
                key={line}
                className="mb-2 font-body text-base leading-relaxed text-foreground"
              >
                {line}
              </Text>
            ))}
          </View>
        ) : null}

        {/* ---- 3. Send ------------------------------------------------------ */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send this report"
          accessibilityHint="Opens your phone’s share sheet with the report already written"
          onPress={send}
          className="mt-6 min-h-14 items-center justify-center rounded-xl bg-primary active:opacity-80"
        >
          <Text className="font-emphasis text-base text-primary-foreground">Send this report</Text>
        </Pressable>
        <Text className="mt-2.5 font-body text-sm leading-5 text-muted-foreground">
          The report carries the app version, this phone’s model of software, and your account id.
          It never carries a recording, a transcript, or anything a customer said.
        </Text>

        {entries !== null && entries.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear this list"
            accessibilityHint="Deletes the recorded failures from this phone"
            onPress={clear}
            className="mt-6 min-h-7 items-center justify-center rounded-lg border border-border-control active:opacity-70"
          >
            <Text className="font-emphasis text-base text-foreground">Clear this list</Text>
          </Pressable>
        ) : null}
    </ScrollView>
  );
}
