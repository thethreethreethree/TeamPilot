# Company schedule settings — Remediate

### Fix: getScheduleSettings try/catches a thrown query and degrades to defaults
what: the query is wrapped in try/catch; a thrown/rejected call logs and returns DEFAULT_SCHEDULE_SETTINGS,
so a settings hiccup degrades the date math (to UTC/Monday) instead of 500-ing the coverage/time-off read.
The returned-error path (including the missing-column / migration-pending case) was already handled and stays.

gate-or-promise: gate. `settings.test.ts` locks it: "a thrown query never crashes the caller → defaults"
exercises the throw path, and "missing-column error → defaults" the returned-error path. Both fail if the
guard is removed (the throw would propagate; the error branch would mis-handle). The class boundary — a
supporting read must not escalate its failure to the primary read — is encoded in a test someone else can
re-run.
