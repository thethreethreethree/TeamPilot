# CHECK - Draft trackers

## Commands

```
node replay0352.mjs → live view "Live" (draft and switched-off excluded); draft → live OK; live → draft REFUSED; word change REFUSED; existing rows draft=false; view security_invoker=true (local failures 0315, 0327 as known)
npx vitest run trackers lib/coach/remote coverage → 352 passed (+ draft save, go live, 404, default switch-off)
npx vitest run KeywordTrackers → 4 passed (Draft chip, Go live, Save as draft, Copy to form)
npx tsc --noEmit → clean
```

## Findings

### F1 - "live" written four times as active = true
class: a duplicated verdict about to gain a term.
sweep: every reader of keyword_trackers listed (scans, adoption board, smart cap, coverage, Search filter, GET).
severity: medium (avoided by the view)

### F2 - going live must respect the smart cap
class: a limit checked on one path to "on" but not the other.
sweep: create and publish both check it.
severity: low
