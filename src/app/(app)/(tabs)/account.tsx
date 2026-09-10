/**
 * Account — the web app's fifth mobile tab, brought across.
 *
 * WHY IT EXISTS. Signing out was a small grey link at the bottom of the session
 * list, and everything else a rep might want to know about their own account —
 * who they are signed in as, what this app is holding on their phone, whether
 * anything is still waiting to reach the server — was not anywhere. The web
 * Sales Coach gives that its own destination; so does this.
 *
 * WHAT IT DELIBERATELY DOES NOT COPY. The web Settings page is mostly operator
 * diagnostics — cue voice, voice-provider health, capture health. Those belong
 * to whoever runs the product, on a screen with room to read them, not to a rep
 * holding a phone between doors. Copying them here would be mimicry.
 *
 * WHAT IT SAYS INSTEAD IS WHAT ONLY THIS DEVICE KNOWS: the space the app is
 * using, split into what can be fetched again and what cannot. That distinction
 * is the whole point — a rep freeing space needs to know that deleting a
 * transcript costs a download and deleting a recording costs a conversation.
 */
import { useCallback, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Constants from 'expo-constants';

import { useAuth } from '@/lib/auth-context';
import { pendingBytes, countPending } from '@/lib/audio/recording-store';
import { cachedDetailBytes } from '@/lib/sync/session-detail-cache';
import { listOutbox } from '@/lib/sync/outbox';
import { signOutMessage, strandedAtSignOut, sweepDeviceCopies } from '@/lib/sign-out-flow';
import { useLargeText } from '@/lib/use-large-text';
import {
  effectivePreferences,
  experienceLabel,
  isPending,
  UNREAD,
  type ExperienceMode,
  type PendingPreferences,
  type Preferences,
} from '@/lib/preferences';
import { fetchPreferences, savePreferences } from '@/lib/preferences-api';
import { readMyProfile, type Profile } from '@/lib/profile';
import { unreadCount } from '@/lib/gamification/notifications';
import { fetchNotifications } from '@/lib/gamification/notifications-api';
import {
  cachePreferences,
  clearPending,
  markPending,
  readCachedPreferences,
  readPendingPreferences,
} from '@/lib/preferences-store';
import { C } from '@/lib/theme';

/** Megabytes, one decimal. Bytes are not a unit a rep can act on. */
function mb(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default function AccountScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const userId = user?.id ?? null;
  const stacked = useLargeText();

  const [recordingBytes, setRecordingBytes] = useState<number | null>(null);
  const [transcriptBytes, setTranscriptBytes] = useState<number | null>(null);
  const [recordings, setRecordings] = useState<number | null>(null);
  const [writes, setWrites] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [serverPrefs, setServerPrefs] = useState<Preferences>(UNREAD);
  const [pending, setPending] = useState<PendingPreferences | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  /** The bell's count (spec 5.3). A rep has none, so it simply never shows. */
  const [alerts, setAlerts] = useState(0);

  const load = useCallback(async () => {
    if (!userId) return;
    setRecordingBytes(await pendingBytes(userId).catch(() => null));
    // Synchronous and file-backed; wrapped anyway so a filesystem that refuses
    // to answer costs a dash rather than the whole screen.
    try {
      setTranscriptBytes(cachedDetailBytes(userId));
    } catch {
      setTranscriptBytes(null);
    }
    setRecordings(await countPending(userId).catch(() => null));
    setWrites(await listOutbox(userId).then((w) => w.length).catch(() => null));

    // Cache first so the switches open on the right state instead of flickering
    // through "Not loaded", then the server's real answer over the top.
    setProfile(await readMyProfile(userId));
    // A failed read shows no badge rather than a wrong one: a count nobody
    // could verify is worse than no count.
    const n = await fetchNotifications();
    setAlerts(n.failed ? 0 : unreadCount(n.rows));
    setServerPrefs(await readCachedPreferences(userId));
    const held = await readPendingPreferences(userId);
    setPending(held);

    /**
     * Send anything still waiting.
     *
     * WITHOUT THIS THE SCREEN LIES. It tells a rep a held change "reaches the
     * website when you have a connection" — and nothing was ever sending it.
     * The outbox, the recordings and the door knocks all retry when
     * connectivity returns; this was the one queue that did not, so a
     * preference toggled in a basement stayed on the phone until the rep
     * happened to toggle it again.
     *
     * Failure is silent on purpose: the value is already on screen and already
     * held, so there is nothing new to tell them and nothing lost by trying
     * again next time.
     */
    if (held && Object.keys(held).length > 0) {
      if (await savePreferences(userId, held)) {
        await clearPending(userId, held);
        setPending(await readPendingPreferences(userId));
      }
    }
    const fresh = await fetchPreferences(userId);
    setServerPrefs(fresh);
    if (fresh !== UNREAD) await cachePreferences(userId, fresh);
  }, [userId]);

  /**
   * Change a preference.
   *
   * The rep's choice is shown IMMEDIATELY and held on the phone, then sent. That
   * order is deliberate: a toggle that refuses to move without signal is the
   * exact complaint Macro Mode drew, and these two settings have even less
   * reason to need the network than that one did.
   */
  const change = useCallback(
    async (patch: PendingPreferences) => {
      if (!userId) return;
      setPending((held) => ({ ...(held ?? {}), ...patch }));
      await markPending(userId, patch);
      if (await savePreferences(userId, patch)) {
        await clearPending(userId, patch);
        // Re-read rather than assume: the row is the authority, and this also
        // picks up a change made on the website since the screen opened.
        const fresh = await fetchPreferences(userId);
        setServerPrefs(fresh);
        if (fresh !== UNREAD) await cachePreferences(userId, fresh);
        setPending(await readPendingPreferences(userId));
      }
    },
    [userId],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const shown = effectivePreferences(serverPrefs, pending);
  const learningPending = isPending(serverPrefs, pending, 'learningMode');
  const experiencePending = isPending(serverPrefs, pending, 'experienceMode');

  const onSignOut = useCallback(async () => {
    const stranded = await strandedAtSignOut(userId);
    Alert.alert('Sign out?', signOutMessage(stranded), [
      { text: 'Stay signed in', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await sweepDeviceCopies(userId);
          await signOut();
        },
      },
    ]);
  }, [userId, signOut]);

  // `runtimeVersion` may be a POLICY object rather than a string, so it is only
  // used when it is genuinely a version. Rendering "[object Object]" under the
  // app name would be the kind of small wrongness that makes everything above it
  // look unmaintained.
  const runtime = Constants.expoConfig?.runtimeVersion;
  const version =
    Constants.expoConfig?.version ?? (typeof runtime === 'string' ? runtime : null);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={C['muted-foreground']}
          />
        }
      >
        <Section title="Signed in as" />
        <Text className="font-body text-base text-foreground">{user?.email ?? 'Unknown'}</Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          The same Elostate account you use on the website. Your calls are the same calls.
        </Text>

        {/* The web's three read-only identity rows. Each says WHY it cannot be
            edited here, because a row with no control and no explanation reads
            as broken rather than as deliberate. */}
        {/*
          AN EM DASH HERE NEEDED ITS REASON, and did not have one.

          `readMyProfile` returns null when the read FAILS as well as before it
          has run, so both of these rows fell back to "—" while the sentence
          underneath went on explaining how to change the value on the website.
          A rep whose profile had simply failed to load read "Name: —" beside
          "change it in your Elostate profile" and would reasonably conclude
          their name was not set — and go and set one they already had.

          Two other fields on THIS SCREEN already do it properly ("This could
          not be read, so it is not shown. Pull down to try again."). These two
          were the odd ones out, which is the kind of inconsistency that only
          shows up when somebody reads the whole file.
        */}
        <View className="mt-4">
          <Row
            stacked={stacked}
            label="Name"
            value={profile?.fullName ?? '—'}
          />
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {profile === null
              ? 'This could not be read, so it is not shown. Pull down to try again.'
              : 'What the coach and your team call you. Change it in your Elostate profile on the website and it follows you here.'}
          </Text>
        </View>

        <View className="mt-4">
          <Row
            stacked={stacked}
            label="Elostate role"
            value={profile?.companyRole ?? '—'}
          />
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {profile === null
              ? 'This could not be read, so it is not shown. Pull down to try again.'
              : 'Your role across the whole platform. Only an admin can change it.'}
          </Text>
        </View>

        <View className="mt-4">
          <Row
            stacked={stacked}
            label="Sales Coach role"
            /*
              THREE STATES, AND THEY USED TO BE TWO.

              The comment that was here said the right thing — "a rep who has
              not been added to Sales Coach is a real state with a real answer,
              and it is not the same as a dash for could not read" — and the
              line under it did the opposite. `profile?.salesCoachRole ?? …`
              fires the SAME sentence whether the rep is genuinely not a member
              or the profile simply failed to load.

              That made this the worst of the em dashes on the screen. The
              others rendered an unknown as unknown; this one rendered an
              unknown as a definite NEGATIVE, telling a rep they are not a
              member of the product they are looking at.
            */
            value={
              profile === null
                ? '—'
                : (profile.salesCoachRole ?? 'Not a Sales Coach member')
            }
          />
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {profile === null
              ? 'This could not be read, so it is not shown. Pull down to try again.'
              : 'Your seat inside Sales Coach, which decides what the coach shows you. An admin sets it under Team.'}
          </Text>
        </View>

        <Section title="On this phone" />
        {/* SPLIT ON PURPOSE. One of these two numbers is space you can reclaim
            for free and one is a conversation that exists nowhere else. A single
            "storage used" figure would hide the difference at exactly the moment
            a rep is deciding what to delete. */}
        <Row
          stacked={stacked}
          label="Recordings not yet sent"
          value={recordingBytes === null ? '—' : mb(recordingBytes)}
        />
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          {recordings === null
            ? 'Could not read what is waiting.'
            : recordings === 0
              ? 'Nothing waiting. Every call has reached the server.'
              : `${recordings} ${recordings === 1 ? 'call is' : 'calls are'} only on this phone. ${
                  recordings === 1 ? 'It is' : 'They are'
                } the only copy — sending is the only way to keep ${
                  recordings === 1 ? 'it' : 'them'
                }.`}
        </Text>

        {recordings !== null && recordings > 0 ? (
          <Pressable
            onPress={() => router.push('/(app)/recordings')}
            accessibilityRole="button"
            accessibilityLabel="Open the recordings waiting to send"
            className="mt-2 min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-base text-primary">See what is waiting</Text>
          </Pressable>
        ) : null}

        <View className="mt-4">
          <Row
            stacked={stacked}
            label="Saved transcripts"
            value={transcriptBytes === null ? '—' : mb(transcriptBytes)}
          />
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            Copies of calls you have opened, so they read without signal. Safe to lose — the
            server still has every one of them.
          </Text>
        </View>

        {writes !== null && writes > 0 ? (
          <View className="mt-4">
            <Row stacked={stacked} label="Changes not yet sent" value={String(writes)} />
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              Outcomes or names you set without signal. They send on their own when you have a
              connection.
            </Text>
          </View>
        ) : null}

        {/* The two per-user preferences the web's Sales Coach settings exposes
            to a rep. They write `profiles` directly under RLS, so neither is
            waiting on a backend deploy. */}
        <Section title="How the coach talks to you" />
        <Text className="font-body text-sm leading-relaxed text-muted-foreground">
          These two are the same settings as the website — changing one here changes it there
          too, on your account only.
        </Text>

        <Toggle
          label="Learning mode"
          description="Adds a short explanation of what a screen is for and why it matters. Useful while the product is still new to you."
          value={shown.learningMode}
          pending={learningPending}
          onChange={(next) => void change({ learningMode: next })}
        />

        <View className="mt-5">
          <Text className="font-strong text-base text-foreground">How much detail</Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            Standard shows less at once. It never hides anything — the full reasoning is always
            one tap away.
          </Text>
          {shown.experienceMode === null ? (
            <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
              {/* Never a guessed default: showing the wrong level would mean the
                  next tap overwrites a setting nobody read. */}
              This could not be read, so it is not shown. Pull down to try again.
            </Text>
          ) : (
            <View className="mt-3 flex-row gap-3">
              {(['standard', 'expert'] as ExperienceMode[]).map((mode) => {
                const on = shown.experienceMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => void change({ experienceMode: mode })}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={`${experienceLabel(mode)} detail${on ? ', selected' : ''}`}
                    className={`min-h-7 flex-1 items-center justify-center rounded-md border px-4 py-3 active:bg-surface ${
                      on ? 'border-primary' : 'border-border-control'
                    }`}
                  >
                    <Text
                      className={`font-emphasis text-base ${on ? 'text-primary' : 'text-foreground'}`}
                    >
                      {experienceLabel(mode)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          )}
          {experiencePending ? (
            <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
              Held on this phone. It reaches the website when you have a connection.
            </Text>
          ) : null}
        </View>

        {/* Reference material lives here rather than in the tab bar, which is
            already at the design law's ceiling of five. Both are read-only and
            neither is something a rep opens every day. */}
        <Section title="Your coaching" />
        <Pressable
          onPress={() => router.push('/(app)/training')}
          accessibilityRole="button"
          accessibilityLabel="Your training focuses"
          className="min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">What to work on</Text>
        </Pressable>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          Growth areas drawn from your own calls — nobody else&apos;s.
        </Text>

        <Pressable
          onPress={() => router.push('/(app)/progress')}
          accessibilityRole="button"
          accessibilityLabel="Your points"
          className="mt-3 min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">Your points</Text>
        </Pressable>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          What your scored calls have banked, and how it is trending. Yours only — nobody on
          your team can read another rep&apos;s.
        </Text>

        <Pressable
          onPress={() => router.push('/(app)/scoreboard')}
          accessibilityRole="button"
          accessibilityLabel="Team scoreboard"
          className="mt-3 min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">Scoreboard</Text>
        </Pressable>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          Where your team stands. Totals only — how any single call was scored stays with the
          rep who made it.
        </Text>

        <Pressable
          onPress={() => router.push('/(app)/alerts')}
          accessibilityRole="button"
          accessibilityLabel={
            alerts > 0
              ? `Your alerts, ${alerts} unread`
              : 'Your alerts'
          }
          className="mt-3 min-h-7 justify-center active:opacity-70"
        >
          <View className="flex-row items-center gap-2">
            <Text className="font-emphasis text-base text-primary">Alerts</Text>
            {alerts > 0 ? (
              <View className="min-w-6 items-center justify-center rounded-full bg-primary px-2 py-0.5">
                <Text className="font-strong text-xs tabular-nums text-primary-foreground">
                  {alerts}
                </Text>
              </View>
            ) : null}
          </View>
        </Pressable>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          Strong calls and closed deals on a team you manage. Empty if you do not manage one.
        </Text>

        <Pressable
          onPress={() => router.push('/(app)/calibration')}
          accessibilityRole="button"
          accessibilityLabel="Score calibration"
          className="mt-3 min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">Score calibration</Text>
        </Pressable>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          For managers: check the coach&apos;s scoring against your own judgement before it
          drives anyone&apos;s rank.
        </Text>

        <Pressable
          onPress={() => router.push('/(app)/oneliners')}
          accessibilityRole="button"
          accessibilityLabel="Your one liners"
          className="mt-3 min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">One liners</Text>
        </Pressable>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          Lines of yours that worked, and why.
        </Text>

        <Section title="Signing out" />
        <Text className="font-body text-sm leading-relaxed text-muted-foreground">
          Anything still waiting — recordings, changes, doors — stays on this phone and reaches
          the server when you sign back in here. Everything else the app is holding, like saved
          transcripts, coach answers and your figures, is cleared, because reps share phones.
        </Text>
        <Pressable
          onPress={onSignOut}
          accessibilityRole="button"
          accessibilityLabel={user?.email ? `Sign out of ${user.email}` : 'Sign out'}
          className="mt-3 min-h-7 items-center justify-center rounded-md border border-destructive px-5 py-3 active:bg-surface"
        >
          <Text className="font-strong text-base text-destructive">Sign out</Text>
        </Pressable>

        {version ? (
          <Text className="mt-8 font-body text-xs text-muted-foreground">
            Sales Coach {version}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title }: { title: string }) {
  return (
    <Text
      accessibilityRole="header"
      className="mb-2 mt-6 font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
    >
      {title}
    </Text>
  );
}

/** A label and a figure. Stacks at large text, like every other pair in the app. */
function Row({
  label,
  value,
  stacked,
}: {
  label: string;
  value: string;
  stacked: boolean;
}) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className={stacked ? '' : 'flex-row items-baseline justify-between gap-3'}
    >
      <Text className="font-body text-base text-foreground">{label}</Text>
      <Text className="font-strong text-base tabular-nums text-foreground">{value}</Text>
    </View>
  );
}

/**
 * A preference switch that can be in three states, not two.
 *
 * `null` is "could not be read", and it is shown as that rather than as OFF. A
 * switch sitting at OFF because a request failed is indistinguishable from one a
 * rep deliberately turned off — and their next tap would write a value over a
 * setting nobody ever read.
 */
function Toggle({
  label,
  description,
  value,
  pending,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean | null;
  pending: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View className="mt-5">
      <View className="flex-row items-start justify-between gap-4">
        <View className="flex-1">
          <Text className="font-strong text-base text-foreground">{label}</Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {description}
          </Text>
        </View>
        {value === null ? null : (
          <Switch
            value={value}
            onValueChange={onChange}
            accessibilityLabel={label}
            trackColor={{ false: C['border-control'], true: C.primary }}
            thumbColor={C.background}
          />
        )}
      </View>
      {value === null ? (
        <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          This could not be read, so no switch is shown. Pull down to try again.
        </Text>
      ) : pending ? (
        <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          Held on this phone. It reaches the website when you have a connection.
        </Text>
      ) : null}
    </View>
  );
}
