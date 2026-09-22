/**
 * "How points work" — the scoring rubric, read-only (mockup p4).
 *
 * NOT A FOURTH BOARD. The guide lists it beside Progress, Breakdown and Pitch detail, and
 * `WHATSAPP.txt` corrects that: *"Page 4 will be the 'score rubric' button that is on page 1 and 2
 * (on the app)"*. It opens over the boards, and the newer, more specific instruction wins.
 *
 * EVERY NUMBER COMES FROM THE SERVER. The guide requires it be *"rendered from `rubric_config` so it
 * never goes stale"*, and the reason is `pitches.rubric_version`: a score is pinned to the config it
 * was computed under, so a sheet holding a transcription would explain September's pitches with
 * December's numbers and every value would still look plausible.
 *
 * Nothing here is typed in — not the 100, not the 30, not the 130, not the 40-base qualifying rule,
 * not one of the thirty elements. The first version of the endpoint omitted the competition
 * thresholds and this sheet is the consumer that found it.
 *
 * THE VERSION IS SHOWN. A rep disputing a score needs to know which rubric they are reading, and
 * "attfiber-v1" at the foot is the difference between a sheet and a claim.
 */
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useState } from 'react';

import type { RubricResponse, RubricSection } from '@/lib/pitch-score/rubric';

export function PitchRubricSheet({
  rubric,
  visible,
  onClose,
}: {
  rubric: RubricResponse;
  visible: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      // The OS back gesture and the hardware back button both close it. A hand-rolled sheet gets
      // this wrong, which is why this is React Native's own Modal rather than an absolute View.
      onRequestClose={onClose}
      presentationStyle="pageSheet"
    >
      <View className="flex-1 bg-background">
        <View className="flex-row items-start justify-between gap-3 border-b border-border px-5 py-4">
          <View className="flex-1">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              How points work
            </Text>
            <Text className="mt-0.5 font-body text-sm text-muted-foreground">
              EloState AT&amp;T Fiber pitch rubric
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close the scoring rubric"
            hitSlop={12}
            className="min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-base text-primary">Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerClassName="px-5 pb-12">
          <View className="mt-5 rounded-xl border border-border-control px-4 py-4">
            <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
              Every pitch
            </Text>
            <Text
              accessible
              accessibilityLabel={`${rubric.baseMax} base plus up to ${rubric.bonusCap} bonus, minus violations, for a maximum of ${rubric.maxScore}`}
              className="mt-2 font-heading text-2xl tabular-nums text-foreground"
            >
              {rubric.baseMax}
              <Text className="font-body text-base text-muted-foreground"> base </Text>+{' '}
              {rubric.bonusCap}
              <Text className="font-body text-base text-muted-foreground"> bonus </Text>−{' '}
              <Text className="font-body text-base text-muted-foreground">violations = </Text>
              <Text className="text-primary">{rubric.maxScore}</Text>
            </Text>
            <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
              You do not need to say the script word for word. The coach listens for the point
              landing, in your own words.
            </Text>
          </View>

          <Grades rubric={rubric} />

          <Heading>Base · {rubric.baseMax} points</Heading>
          <View className="mt-3 gap-2">
            {rubric.sections.map((s) => (
              <SectionCard key={s.id} section={s} rubric={rubric} />
            ))}
          </View>

          <Heading>Bonus · up to +{rubric.bonusCap} per pitch</Heading>
          <View className="mt-3 gap-3">
            {rubric.bonuses.map((b) => (
              <View key={b.id}>
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="flex-1 font-strong text-base text-foreground">{b.label}</Text>
                  <Text className="font-emphasis text-base tabular-nums text-primary">
                    +{b.points}
                    {/* "Max +6" is the cap, and it only applies to the one repeatable bonus. Printed
                        from the data, never assumed — buying questions is currently the only one. */}
                    {b.repeatable ? ' ea' : ''}
                  </Text>
                </View>
                <Text className="mt-0.5 font-body text-sm leading-relaxed text-muted-foreground">
                  {b.maxTotal ? `Max +${b.maxTotal}. ` : ''}
                  {b.detectionNotes}
                </Text>
              </View>
            ))}
          </View>

          <Heading>Violations</Heading>
          <View className="mt-3 gap-3">
            {rubric.violations.map((v) => (
              <View key={v.id}>
                <View className="flex-row items-baseline justify-between gap-3">
                  <Text className="flex-1 font-strong text-base text-foreground">{v.label}</Text>
                  <Text className="font-emphasis text-base tabular-nums text-destructive">
                    −{v.deduction}
                    {v.repeatable ? ' ea' : ''}
                  </Text>
                </View>
                <Text className="mt-0.5 font-body text-sm leading-relaxed text-muted-foreground">
                  {v.maxTotal ? `Max −${v.maxTotal}. ` : ''}
                  {v.trigger}
                  {/* The rubric escalates a rude flag to a person. A rep should know that before
                      they see one, not after. */}
                  {v.flagsForReview ? ' A manager reviews this one.' : ''}
                </Text>
              </View>
            ))}
          </View>

          <Heading>Competition rules</Heading>
          <View className="mt-3 gap-2">
            {[
              `A pitch counts only if it reaches Discovery and scores ${rubric.qualifyingMinBase} or more on the base.`,
              'The leaderboard is your total points from counted pitches.',
              'Best Pitch goes to the highest single score.',
              `${rubric.prizeEligibleMinPitches} counted pitches makes you prize eligible.`,
              'A pitch never scores below 0. Think a score is wrong? Dispute it on the pitch.',
            ].map((rule) => (
              <Text key={rule} className="font-body text-sm leading-relaxed text-foreground">
                {rule}
              </Text>
            ))}
          </View>

          <Heading>Never graded for accuracy</Heading>
          <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
            These change per household or over time, so the coach checks only that you made the
            point — never whether the number matched the script.
          </Text>
          <View className="mt-3 gap-2">
            {rubric.neverGradeForAccuracy.map((item) => (
              <Text key={item} className="font-body text-sm leading-relaxed text-foreground">
                {item}
              </Text>
            ))}
          </View>

          <Text className="mt-8 font-body text-xs text-muted-foreground">
            Rubric {rubric.version}. A pitch is always explained against the rubric it was scored
            under, not today&apos;s.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text
      accessibilityRole="header"
      className="mt-8 font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
    >
      {children}
    </Text>
  );
}

/**
 * HIT / PARTIAL / MISSED, with the credit each earns read from the server.
 *
 * "Half points" is `gradeCredit.partial`, not a word typed here. If the rubric ever changes what a
 * partial is worth, this sentence changes with it instead of quietly becoming wrong.
 */
function Grades({ rubric }: { rubric: RubricResponse }) {
  const asWords = (credit: number) =>
    credit === 1 ? 'Full points' : credit === 0 ? 'No points' : `${credit * 100}% of the points`;
  return (
    <View className="mt-3 gap-2">
      {(
        [
          ['Hit', 'hit', 'The point was clearly made, in any wording.'],
          ['Partial', 'partial', 'Rushed, vague, or only implied.'],
          ['Missed', 'missed', 'Skipped.'],
        ] as const
      ).map(([label, key, meaning]) => (
        <View key={key} className="flex-row items-baseline gap-3">
          <Text className="w-20 font-strong text-base text-foreground">{label}</Text>
          <Text className="flex-1 font-body text-sm leading-relaxed text-muted-foreground">
            {asWords(rubric.gradeCredit[key])} — {meaning}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * One section, collapsed to its total until tapped.
 *
 * The sheet runs to thirty elements, thirteen bonuses and five violations. Open, that is a wall a
 * rep scrolls past; the mockup collapses all six and expands one [OBSERVED, p4], which is what makes
 * the sheet answerable rather than merely complete.
 */
function SectionCard({ section, rubric }: { section: RubricSection; rubric: RubricResponse }) {
  const [open, setOpen] = useState(false);
  const elements = rubric.elements.filter((e) => e.section === section.id);

  return (
    <View className="rounded-xl border border-border-control px-4 py-3">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${section.label}, ${section.maxPoints} points. ${
          open ? 'Hide' : 'Show'
        } its ${elements.length} elements.`}
        className="min-h-7 flex-row items-center justify-between gap-3 active:opacity-70"
      >
        <Text className="flex-1 font-strong text-base text-foreground">{section.label}</Text>
        <Text className="font-emphasis text-base tabular-nums text-primary">
          {section.maxPoints} pts
        </Text>
        <Text className="w-4 text-center font-emphasis text-base text-muted-foreground">
          {open ? '−' : '+'}
        </Text>
      </Pressable>

      {open ? (
        <View className="mt-3 gap-3 border-t border-border pt-3">
          {elements.map((e) => (
            <View key={e.id}>
              <View className="flex-row items-baseline justify-between gap-3">
                <Text className="flex-1 font-body text-sm text-foreground">{e.label}</Text>
                <Text className="font-emphasis text-sm tabular-nums text-foreground">
                  {e.points}
                </Text>
              </View>
              <Text className="mt-0.5 font-body text-xs leading-relaxed text-muted-foreground">
                {e.whatCounts}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
