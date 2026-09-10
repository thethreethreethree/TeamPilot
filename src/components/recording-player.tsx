/**
 * Listening to a recording before it is sent.
 *
 * WHY IT EARNS ITS PLACE. Everything else in the recording path can be verified
 * by looking at a number — the size, the duration, the fact a file exists. None
 * of those tell a rep that the microphone was against a coat, or that the phone
 * was face-down on a table and caught nothing but a hum. A recording like that
 * currently uploads, transcribes into nothing, and produces a session with an
 * empty transcript that nobody can explain. Thirty seconds of listening prevents
 * that, and it is the only check that can.
 *
 * THE SCRUBBER IS BUTTONS, NOT A SLIDER. A drag target on a list row competes
 * with the list's own scroll, and a thin slider is a hard thing to hit at 44pt
 * with one hand in a van. Two skip controls and a readable clock do the same job
 * and stay reachable — and they read correctly to a screen reader, which a
 * bare slider does not.
 *
 * IT RELEASES THE PLAYER ON UNMOUNT. An audio player left alive holds the audio
 * session, which on iOS means the NEXT recording starts at a reduced level or
 * refuses outright. That is a bug the rep would experience as "the app sometimes
 * records silence", one screen away from where it was caused.
 */
import { useEffect } from 'react';
import { Pressable, Text, View } from 'react-native';

import { audio } from '@/lib/audio/module';
import { useLargeText } from '@/lib/use-large-text';

/** mm:ss — a call is minutes long, so hours would be noise. */
function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

const SKIP_SECONDS = 15;

export function RecordingPlayer({ fileUri }: { fileUri: string }) {
  const stacked = useLargeText();
  // Guarded by the caller, which only mounts this when the module loaded. The
  // non-null assertion is safe for the same reason the recorder's is.
  const player = audio!.useAudioPlayer(fileUri);
  const status = audio!.useAudioPlayerStatus(player);

  // Hand the audio session back. Without this the next recording is quiet or
  // fails, and nothing on the recorder screen would explain why.
  useEffect(() => {
    return () => {
      try {
        player.remove();
      } catch {
        /* already gone */
      }
    };
  }, [player]);

  const duration = status.duration || 0;
  const position = status.currentTime || 0;
  const playing = status.playing === true;

  const seekBy = (delta: number) => {
    const next = Math.min(Math.max(0, position + delta), Math.max(0, duration));
    player.seekTo(next).catch(() => {
      /* a seek past the end is not worth an error */
    });
  };

  return (
    <View className="mt-4 rounded-md border border-border-control px-3 py-3">
      {/* Neither side can shrink, so at an accessibility text size the wide-
          tracked label pushes the timer off the right edge — and the timer is
          the one thing a rep is actually watching while they scrub. Stacked
          above the threshold, both stay on screen. */}
      <View className={stacked ? 'gap-0.5' : 'flex-row items-center justify-between'}>
        <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
          Listen first
        </Text>
        <Text
          accessibilityLabel={`${clock(position)} of ${clock(duration)}`}
          className="font-body text-sm tabular-nums text-muted-foreground"
        >
          {clock(position)} / {clock(duration)}
        </Text>
      </View>

      <View className="mt-3 flex-row items-center gap-2">
        <Pressable
          onPress={() => seekBy(-SKIP_SECONDS)}
          accessibilityRole="button"
          accessibilityLabel={`Back ${SKIP_SECONDS} seconds`}
          hitSlop={8}
          className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control py-3 active:opacity-70"
        >
          <Text className="font-emphasis text-base text-foreground">−{SKIP_SECONDS}s</Text>
        </Pressable>

        <Pressable
          onPress={() => (playing ? player.pause() : player.play())}
          accessibilityRole="button"
          accessibilityLabel={playing ? 'Pause' : 'Play this recording'}
          className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control py-3 active:opacity-70"
        >
          <Text className="font-strong text-base text-foreground">
            {playing ? 'Pause' : 'Play'}
          </Text>
        </Pressable>

        <Pressable
          onPress={() => seekBy(SKIP_SECONDS)}
          accessibilityRole="button"
          accessibilityLabel={`Forward ${SKIP_SECONDS} seconds`}
          hitSlop={8}
          className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control py-3 active:opacity-70"
        >
          <Text className="font-emphasis text-base text-foreground">+{SKIP_SECONDS}s</Text>
        </Pressable>
      </View>

      {/* Progress as a bar, but never as the ONLY signal — the clock above says
          the same thing in words a screen reader can read. */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no"
        className="mt-3 h-1 overflow-hidden rounded-full bg-border"
      >
        <View
          className="h-full bg-primary"
          style={{ width: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%` }}
        />
      </View>
    </View>
  );
}
