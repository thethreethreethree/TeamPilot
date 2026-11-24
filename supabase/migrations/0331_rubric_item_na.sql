-- 0331 — a rubric item can be marked "Doesn't apply" (N/A) by a manager's correction (2026-11-25; ledger F15.5;
-- founder picker 2026-11-24: "Managers, when correcting").
--
-- An N/A item's points come out of its section's maximum and the section is scaled back to full, the same way the
-- rubric already treats Objection handling when no objection happens (scorePitch.ts). Only a manager's correction
-- sets it: the AI's answer is parsed to hit / partial / missed only (pitchScorePrompt.ts), and the override route
-- requires a reason and logs it like every correction (pitch_score_overrides, 0255).
--
-- pitch_score_elements.grade gains 'na'; an N/A row is worth 0 points (its weight is removed, not awarded).
-- pitch_score_overrides.new_value / old_value are free text already ('na' needs nothing there). Re-runnable.

alter table public.pitch_score_elements drop constraint if exists pitch_score_elements_grade_check;
alter table public.pitch_score_elements add constraint pitch_score_elements_grade_check check (grade in ('hit', 'partial', 'missed', 'na'));
alter table public.pitch_score_elements drop constraint if exists pitch_score_elements_na_zero;
alter table public.pitch_score_elements add constraint pitch_score_elements_na_zero check (grade <> 'na' or points = 0);
