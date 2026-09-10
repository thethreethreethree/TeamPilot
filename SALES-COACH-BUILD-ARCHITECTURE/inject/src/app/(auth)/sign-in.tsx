/**
 * The ONLY unauthenticated screen. Existing Elostate users sign in with the
 * email and password they already use on the web. There is deliberately no
 * sign-up: Sales Coach accounts are provisioned in the Elostate admin, mirroring
 * the web /sales-coach/login rule exactly.
 */
import { useRef, useState } from 'react';
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

import { useAuth } from '@/lib/auth-context';
import { C } from '@/lib/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  async function onSubmit() {
    if (busy) return;
    setError(null);
    setBusy(true);
    // null on success; the auth gate navigates on the resulting state change.
    const message = await signIn(email, password);
    if (message) setError(message);
    setBusy(false);
  }

  const canSubmit = email.trim().length > 0 && password.length > 0 && !busy;

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

          <Text className="mt-5 font-body text-sm leading-relaxed text-muted-foreground">
            No account here? Sales Coach access is granted by an Elostate admin.
          </Text>
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
