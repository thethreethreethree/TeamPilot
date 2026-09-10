/**
 * Skills — the web's Analytics tab, which is NOT the KPI board.
 *
 * I HAD THIS WRONG. The phone's Analytics tab pointed at the KPI screen, because
 * both are "numbers". They are not the same thing: the KPI board is conversion,
 * revenue and close rate — what the calls ADDED UP TO. Analytics is a graded
 * read of HOW THE REP SELLS: objection handling, questions, tone, listening.
 * Reading the web page rather than assuming from the tab's name is what caught
 * it.
 *
 * THE GRADE BANDS ARE COPIED EXACTLY from `skillGrade.ts`, and the rule that
 * matters most travels with them, in the source's own words: an unmeasured skill
 * "returns an honest not-yet grade — NOT a low letter". A rep who has not been
 * measured on questions must never see a D for it. That is a lie about a person,
 * and it is the sort of lie they would believe.
 *
 * Pure, so both the banding and the not-yet rule are testable without a network.
 */

export type SkillTier = 'strong' | 'solid' | 'developing' | 'weak' | 'not-yet';

export type Skill = {
  key: string;
  label: string;
  /** 0–10, or null when there is not enough data to score honestly. */
  score: number | null;
  /** How many sessions fed this score, so the rep knows the weight. */
  sampleSize: number;
  /** The deterministic read of the band. */
  read: string;
  /** The AI breakdown when there is one. */
  breakdown?: string;
};

export type Grade = {
  /** Null when unscored — never a low letter for no data. */
  letter: string | null;
  tier: SkillTier;
};

/** Verbatim from `skillGrade.ts`. A copy here would drift if it were retyped
 *  from memory, so the numbers and letters are transcribed exactly. */
const BANDS: { min: number; letter: string; tier: SkillTier }[] = [
  { min: 9.5, letter: 'A+', tier: 'strong' },
  { min: 9.0, letter: 'A', tier: 'strong' },
  { min: 8.5, letter: 'A-', tier: 'strong' },
  { min: 8.0, letter: 'B+', tier: 'solid' },
  { min: 7.0, letter: 'B', tier: 'solid' },
  { min: 6.5, letter: 'B-', tier: 'solid' },
  { min: 6.0, letter: 'C+', tier: 'developing' },
  { min: 5.5, letter: 'C', tier: 'developing' },
  { min: 5.0, letter: 'C-', tier: 'developing' },
];

const FLOOR: { letter: string; tier: SkillTier } = { letter: 'D', tier: 'weak' };

export function gradeSkill(score: number | null | undefined): Grade {
  // The load-bearing branch. An unmeasured skill is "not yet", never a D.
  if (score === null || score === undefined || Number.isNaN(score)) {
    return { letter: null, tier: 'not-yet' };
  }
  const clamped = Math.max(0, Math.min(10, score));
  const band = BANDS.find((b) => clamped >= b.min);
  return band ? { letter: band.letter, tier: band.tier } : { ...FLOOR };
}

export type SkillRow = Skill & {
  grade: Grade;
  /** 0–1 for the bar; null when unscored, so nothing is drawn. */
  fraction: number | null;
  spoken: string;
};

export type SkillsView = {
  rows: SkillRow[];
  /** True when NOTHING has been measured yet — a different screen, not an empty list. */
  nothingMeasured: boolean;
  sampleSessions: number;
};

export function buildSkillsView(input: {
  skills: Skill[] | null;
  sampleSessions?: number;
}): SkillsView {
  const skills = input.skills ?? [];
  const rows: SkillRow[] = skills
    .filter((s) => s && typeof s.label === 'string' && s.label.trim())
    .map((s) => {
      const score = Number.isFinite(s.score as number) ? (s.score as number) : null;
      const grade = gradeSkill(score);
      return {
        ...s,
        score,
        grade,
        fraction: score === null ? null : Math.max(0, Math.min(1, score / 10)),
        spoken:
          score === null
            ? `${s.label}: not measured yet`
            : `${s.label}: ${grade.letter}, ${score} out of 10, from ${s.sampleSize} ${
                s.sampleSize === 1 ? 'call' : 'calls'
              }`,
      };
    });

  return {
    rows,
    nothingMeasured: rows.length === 0 || rows.every((r) => r.score === null),
    sampleSessions: input.sampleSessions ?? 0,
  };
}
