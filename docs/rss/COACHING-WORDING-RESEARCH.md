# Coaching wording — the research behind it

Founder decision 2026-11-24 (picker "Rules + cite 3 studies"), on the General Sales Interface PDF's "Harvard research on
psychological effect on the wordings used to improve/motivate/inspire the users".

Researched 2026-11-24 by reading each source's primary text; every quote below is verbatim from the page read.

## Finding on "Harvard research"

No peer-reviewed Harvard study on the psychological effect of feedback wording was found. The Harvard-affiliated pieces
are practitioner guidance — Buckingham & Goodall, "The Feedback Fallacy", Harvard Business Review, Mar–Apr 2019 (an
opinion essay whose brain-science claim rests on one small study), and Harvard Graduate School of Education, Usable
Knowledge, "Acknowledging What Students Do Well" (2017, cites no studies). So the product does not claim Harvard
research. It cites the three peer-reviewed sources below.

## Sources cited in the product

1. **Kluger, A. N., & DeNisi, A. (1996).** The Effects of Feedback Interventions on Performance: A Historical Review, a
   Meta-Analysis, and a Preliminary Feedback Intervention Theory. *Psychological Bulletin*, 119(2), 254–284.
   https://doi.org/10.1037/0033-2909.119.2.254 — Feedback helps on average (d = .41) but lowered performance in over a
   third of cases. Abstract: "FI effectiveness decreases as attention moves up the hierarchy closer to the self and away
   from the task." → Rule 5 (the behavior, never the person).
2. **Mueller, C. M., & Dweck, C. S. (1998).** Praise for Intelligence Can Undermine Children's Motivation and
   Performance. *Journal of Personality and Social Psychology*, 75(1), 33–52. https://doi.org/10.1037/0022-3514.75.1.33
   — Abstract: "praise for intelligence had more negative consequences for students' achievement motivation than praise
   for effort." Wordings tested: "You must be smart at these problems" vs "You must have worked hard at these problems."
   Children, lab tasks: applying it to adults is an extrapolation. → Rule 6 (credit what they control).
3. **Yeager, D. S., Purdie-Vaughns, V., Garcia, J., Apfel, N., Brzustoski, P., Master, A., Hessert, W. T., Williams,
   M. E., & Cohen, G. L. (2014).** Breaking the Cycle of Mistrust: Wise Interventions to Provide Critical Feedback Across
   the Racial Divide. *Journal of Experimental Psychology: General*, 143(2), 804–824. https://doi.org/10.1037/a0033906 —
   Treatment note (p. 809): "I'm giving you these comments because I have very high expectations and I know that you can
   reach them." Students who got it were more likely to revise (significant for African American students; a
   non-significant trend for White students; 7th graders). → Rule 7 (the standard and the belief).

## Rules in the coaching prompt (src/lib/coach/v5/salesReviewPrompt.ts, TONE_LAW)

Existing: 1 strengths first, specific and earned; 2 growth as opportunity with one concrete step; 3 never lead with
criticism; 4 not a scorecard. Added 2026-11-24: 5 the behavior, never the person; 6 credit what they control; 7 the
standard and the belief.

## Claims deliberately not used

- The "positivity ratio" / Losada ratio (2.9:1): its mathematical basis was shown invalid — Brown, Sokal & Friedman
  (2013), *American Psychologist*, 68(9), 801–813, https://doi.org/10.1037/a0032850 — and the modelling was withdrawn.
  The product never uses or cites a fixed praise-to-criticism ratio.
- Zenger & Folkman, HBR 2013, "The Ideal Praise-to-Criticism Ratio" (5.6:1): paywalled, not peer-reviewed; not used.
- "Criticism shuts the brain down" (HBR 2019): generalises from one small study; not used.

## Not verified

The body of the Zenger & Folkman article; the exact text of the Fredrickson & Losada correction; any peer-reviewed HBS
study on feedback wording (avoid papers co-authored by Francesca Gino until checked); Sisk et al. (2018) meta-analysis
questioning mindset effects; Hattie & Timperley (2007).
