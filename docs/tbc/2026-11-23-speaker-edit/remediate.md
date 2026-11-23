# REMEDIATE - Correct who said a transcript line

### F1 - a speaker-only change would not have marked the AI notes as older
GET returns latestEditAt; the editor includes it in notesPredateCorrections.
gate-or-promise: gate (render test "a speaker change alone also dates the AI notes")
