# BUILD - E13: call scores in the API

### Scores resource
write-path: none (reads pitch_scores and pitch_score_elements; the request is recorded in api_usage).
read-path: GET /api/v1/scores — per score: call, rep, total, base, bonus, violations, band, counts, rubric version, sections, items (id, label, grade, points); never transcript, audio, evidence or the not-counting reason; scores on calls with an active hide left out.
