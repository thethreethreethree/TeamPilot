/**
 * The ONLY unauthenticated screen. Existing Elostate users sign in with the
 * email and password they already use on the web. There is deliberately no
 * sign-up: Sales Coach accounts are provisioned in the Elostate admin, mirroring
 * the web /sales-coach/login rule exactly.
 */
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';

import { useAuth } from '@/lib/auth-context';
import { probeSecureStorage } from '@/lib/secure-session-store';
import { countUnclaimed } from '@/lib/audio/recording-store';
import { router } from 'expo-router';

import { ENV } from '@/lib/env';
import { signInMessage } from '@/lib/sign-in-message';
import { C } from '@/lib/theme';

export default function SignInScreen() {
  const { signIn, endedUnexpectedly, acknowledgeEnded } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  /** Recordings made while signed out, waiting to be attached to whoever signs
   *  in. Shown so a rep whose session expired mid-call can see, before doing
   *  anything, that the conversation survived. */
  const [waiting, setWaiting] = useState(0);

  // expo-secure-store is a NATIVE module. A client that did not build it in — or a
  // device whose policy locks the keychain — cannot hold a session at all. Finding
  // that out here, once, is far kinder than letting a rep type a password and then
  // fail for reasons the screen cannot explain.
  const [canStore, setCanStore] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    probeSecureStorage().then((ok) => {
      if (mounted) setCanStore(ok);
    });
    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Held for this screen, then acknowledged.
   *
   * Copied into local state on mount so the message survives being cleared in
   * the provider — otherwise acknowledging it would make it vanish from under
   * the rep as they read it. Acknowledged immediately so that leaving and
   * returning to this screen later does not re-announce an expiry they have
   * already been told about.
   */
  const [wasSignedOut] = useState(endedUnexpectedly);
  useEffect(() => {
    if (endedUnexpectedly) acknowledgeEnded();
  }, [endedUnexpectedly, acknowledgeEnded]);

  async function onSubmit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      // null on success; the auth gate navigates on the resulting state change.
      const message = await signIn(email, password);
      if (message) setError(message);
    } catch (e) {
      // signIn RETHROWS anything that is not a known storage failure, and this
      // had no catch — so an unexpected throw skipped setBusy(false) entirely
      // and left the button spinning with nothing on screen explaining it. On
      // this screen that is a rep locked out of their working day, staring at a
      // control that will never come back.
      setError(
        e instanceof Error && e.message
          ? signInMessage(e.message)
          : signInMessage(null),
      );
    } finally {
      // In the finally, not after the call: whatever happens above, the button
      // has to become pressable again.
      setBusy(false);
    }
  }

  const canSubmit =
    email.trim().length > 0 && password.length > 0 && !busy && canStore !== false;

  useEffect(() => {
    let cancelled = false;
    countUnclaimed()
      .then((n) => {
        if (!cancelled) setWaiting(n);
      })
      .catch(() => {
        // Nothing to say is better than a wrong number. The recordings are
        // still there either way and are claimed on sign-in regardless.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="grow justify-center px-5 py-6"
          keyboardShouldPersistTaps="handled"
        >
          {/* Wordmark. Inter Black is the ratified mark (BRAND.md §2); it is the
              brand anchor on this surface, so no second accent competes with it. */}
          <Text
            accessibilityRole="header"
            className="font-wordmark text-3xl tracking-tight text-foreground"
          >
            ELOSTATE
          </Text>
          <Text className="mt-1 font-strong text-lg text-primary">Sales Coach</Text>

          <Text className="mt-3 font-body text-base leading-relaxed text-muted-foreground">
            Sign in with your Elostate account. Your sessions are already there.
          </Text>

          {/* FIRST, above everything, because it is the only thing that explains
              why this screen is on the phone at all.

              Without it a rep halfway through reading a transcript is suddenly
              looking at a login form, and the reasonable conclusion is that the
              app crashed or that somebody logged them out. Both are worse than
              the truth, and both cost more trust than an expiry ever does.

              The wording says nothing is lost, because nothing is: the sessions
              are on the server and anything waiting is on the phone. */}
          {wasSignedOut ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              className="mt-5 rounded-md border border-primary px-3 py-3"
            >
              <Text className="font-strong text-base text-foreground">
                You were signed out
              </Text>
              <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
                Your sign-in expired, which happens after a long stretch without using the
                app. Nothing was lost — your calls are on the server and anything waiting to
                send is still on this phone. Sign in and carry on.
              </Text>
            </View>
          ) : null}

          {/* Said BEFORE the form, because a rep whose session dropped mid-call
              is not thinking about their password — they are wondering whether
              they just lost the conversation. */}
          {waiting > 0 ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mt-5 rounded-md border border-primary px-3 py-3"
            >
              <Text className="font-strong text-base text-foreground">
                {waiting} {waiting === 1 ? 'recording is' : 'recordings are'} safe on this phone
              </Text>
              <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
                {waiting === 1 ? 'It was' : 'They were'} recorded while you were signed out.
                Nothing was lost — sign in and {waiting === 1 ? 'it' : 'they'} will be waiting.
              </Text>
            </View>
          ) : null}

          {canStore === false ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              className="mt-5 rounded-md border border-destructive px-3 py-3"
            >
              <Text className="font-strong text-base text-destructive">
                This build cannot keep you signed in
              </Text>
              <Text className="mt-1 font-body text-sm leading-relaxed text-destructive">
                Your session has to be stored in the device keychain, and this build
                has no access to it. Sign-in is disabled rather than storing your
                login somewhere it could be read. Open the app from a development
                build or the installed app instead of Expo Go.
              </Text>
            </View>
          ) : null}

          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            inputMode="email"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            placeholder="you@company.com"
          />

          <Field
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />

          {error ? (
            // Three signals, never colour alone: the destructive token, a glyph,
            // and the words. Announced so a screen-reader user who has moved past
            // the field still hears it.
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              className="mt-4 flex-row items-start gap-2 rounded-md border border-destructive px-3 py-3"
            >
              <Text
                className="font-strong text-base text-destructive"
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                !
              </Text>
              <Text className="flex-1 font-body text-sm leading-relaxed text-destructive">
                {error}
              </Text>
            </View>
          ) : null}

          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Signing in' : 'Sign in'}
            accessibilityState={{ disabled: !canSubmit, busy }}
            // min-h-7 is 48dp on this scale — above the 44pt iOS floor.
            className="mt-6 min-h-7 flex-row items-center justify-center gap-2 rounded-md bg-primary px-5 active:bg-primary-pressed disabled:opacity-50"
          >
            {busy ? <ActivityIndicator color={C['primary-foreground']} /> : null}
            <Text className="font-strong text-base text-primary-foreground">
              {busy ? 'Signing in' : 'Sign in'}
            </Text>
          </Pressable>

          {/*
            Recovery deliberately hands off to the web rather than calling
            resetPasswordForEmail from the app.

            The reset link's return URL is pinned to one allow-listed address
            (lib/auth/passwordRecovery.ts). Supabase silently falls back to the
            project's Site URL for any redirect that is not on that allowlist —
            the 2026-08-14 incident recorded in that file. Sending a second,
            app-shaped redirect would either need a new allowlist entry I cannot
            verify from here, or fail invisibly. The web page is already correct,
            so the app points at it, which is also what the web login tells
            people to do.
          */}
          <Pressable
            onPress={() => {
              WebBrowser.openBrowserAsync(`${ENV.API_BASE}/auth/forgot`).catch(() => {
                setError('Could not open the reset page. Visit elostate.com and use "Forgot password".');
              });
            }}
            accessibilityRole="link"
            accessibilityLabel="Reset your password on the Elostate website"
            className="mt-5 min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-foreground">
              Forgot your password?
            </Text>
          </Pressable>

          <Text className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
            Your Elostate password works here — there is no separate Sales Coach
            login. Access is granted by an Elostate admin, so there is no sign-up.
          </Text>

          {/*
            THE WAY OUT WHEN NOTHING ELSE WORKS.

            Everything above assumes the rep gets in. Somebody who cannot — a
            password that will not take, a server refusing the sign-in, an app
            that dies on launch — has no menu, no Home, and until this had no way
            to tell anyone. That is the failure most likely to strand a person
            and it was the one the reporting system could never hear about.

            It is last on the screen and quiet on purpose: it must be findable
            when nothing else has worked, without competing with the sign-in
            button for a rep who is simply signing in.
          */}
          <Pressable
            onPress={() => router.push('/(auth)/report-problem')}
            accessibilityRole="button"
            accessibilityLabel="Report a problem signing in"
            accessibilityHint="Opens a screen where you can send what went wrong"
            className="mt-6 min-h-11 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-foreground">
              Cannot get in? Report a problem
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * A labelled field. Every input gets a VISIBLE label and the same words as its
 * accessibilityLabel — a placeholder is never a label: it disappears the moment
 * typing starts and destroys error recovery. The placeholder here carries a
 * format example only.
 *
 * React Native has no :focus-visible, so the focus ring is driven from the
 * control's own callbacks — a keyboard or switch-control user needs to see where
 * they are, and the platform will not draw it for a bare TextInput.
 */
type FieldProps = React.ComponentProps<typeof TextInput> & { label: string };

function Field({ label, ...input }: FieldProps & { ref?: React.Ref<TextInput> }) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="mt-5">
      <Text className="font-emphasis text-sm text-muted-foreground">{label}</Text>
      <TextInput
        {...input}
        accessibilityLabel={label}
        placeholderTextColor={C['muted-foreground']}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        className={`mt-2 min-h-7 rounded-md border px-3 font-body text-base text-foreground ${
          focused ? 'border-ring' : 'border-border-control'
        }`}
      />
    </View>
  );
}
