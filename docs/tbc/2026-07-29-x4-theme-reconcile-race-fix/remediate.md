# REMEDIATE — theme reconcile race

### F1 — reconcile race clobbers a mid-flight theme choice

fix: after the reconcile fetch resolves, re-read localStorage and skip the apply when a value now
exists (the user chose during the fetch); pass the fresh value to reconcileTheme so its local-set branch
short-circuits.

gate-or-promise: declined — per A33, "state computed from a value captured before an await is later
  stale" is a real class but not mechanically detectable without false positives across every async
  callback in the codebase; a linter rule for it fires on correct code. The precise, honest defense is
  local: the re-read guard at the one apply site + the existing `reconcileTheme` unit test whose
  local-set case (`{preference:null}`) proves the clobber cannot occur once the fresh value is passed.
  The class boundary is named here rather than gated noisily.
