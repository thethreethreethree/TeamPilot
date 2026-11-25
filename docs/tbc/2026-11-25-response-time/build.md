# BUILD - Feedback response time per manager

No migration. No env keys.

### A manager reads how quickly reps' requests are answered
write-path: none (reads feedback_requests and coaching events).
read-path: Remote Sales → Coaching → "Coaching in the last 30 days" → Typical response (e.g. "5.5 h (2)", "1.5 d (1)");
Download CSV → median_response_hours.
