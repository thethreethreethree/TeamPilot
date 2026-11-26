# CHECK - Acting on the review of vocabulary corrections

## Commands

```
npx vitest run vocabulary appendTranscriptSegment.corrections VocabularySettings settings → 42 passed
  (part of a name refused; one pass; "$&" literal; number-only, '=', ',' and marker words refused; merge; card removed with name kept; failure not cached)
npx vitest run lib/data transcriptRedactionGate → passed; tsc → clean
production count: company_stt_vocabulary rows 0, with corrections 0
```

## Findings

### F1 - a mis-hearing inside its own name rewrote correct mentions
class: a rule missing its self-reference check.
sweep: checked against every term in the list.
severity: medium

### F2 - sequential replacement chained
class: order-dependent rewriting.
sweep: one compiled alternation.
severity: medium

### F3 - "$" read as a replacement pattern
class: string replacement with user text.
sweep: replacement function.
severity: low

### F4 - corrections before redaction changed what was redacted
class: two text transforms in the wrong order.
sweep: redaction first; number-only and marker words refused.
severity: low

### F5 - lists that didn't survive the screen
class: a format that can't express what the API accepts.
sweep: merge by name; '=' and ',' refused.
severity: low

### F6 - a failed read cached for five minutes
class: failure and "none" as one value.
sweep: null on failure; only answers cached.
severity: low
