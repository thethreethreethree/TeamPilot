/**
 * The one search box in this app.
 *
 * A visible label, not just a placeholder — the design law is explicit that a
 * placeholder is never a label, and it disappears the moment typing starts. The
 * result count is announced politely so a screen-reader user learns the filter
 * did something without having to go hunting for the change.
 *
 * IT LIVES HERE BECAUSE TWO SCREENS NEED IT. It was written for the session
 * list; One Liners needs the same box for the same reason, and a second copy is
 * how one of them quietly loses the Android fix below.
 *
 * THE LABEL MUST NAME WHAT SEARCH ACTUALLY LOOKS AT. Both screens search more
 * than their obvious field, and a capability nobody knows about is one that does
 * not exist — so the caller passes the wording rather than inheriting a generic
 * "Search".
 */
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { C } from '@/lib/theme';

export function SearchField({
  label,
  accessibilityLabel,
  placeholder,
  value,
  onChangeText,
  resultCount,
  /** Singular noun for the count line — "session", "line". */
  noun,
}: {
  label: string;
  accessibilityLabel: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  resultCount: number | null;
  noun: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="mt-4">
      <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={accessibilityLabel}
        placeholder={placeholder}
        placeholderTextColor={C['muted-foreground']}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="while-editing"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className={`mt-2 min-h-7 rounded-md border px-3 font-body text-base text-foreground ${
          focused ? 'border-ring' : 'border-border-control'
        }`}
      />
      {resultCount !== null ? (
        <View className="mt-2 flex-row items-baseline justify-between gap-3">
          <Text
            accessibilityLiveRegion="polite"
            className="flex-1 font-body text-sm text-muted-foreground"
          >
            {resultCount === 0
              ? 'Nothing matches'
              : `${resultCount} ${resultCount === 1 ? noun : `${noun}s`}`}
          </Text>
          {/* clearButtonMode is iOS-only, so without this an Android rep whose
              search HAS results can only clear it by deleting the text by hand. */}
          <Pressable
            onPress={() => onChangeText('')}
            accessibilityRole="button"
            accessibilityLabel="Clear the search"
            className="min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-primary">Clear</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
