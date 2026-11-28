# BUILD - sandbox review fixes

### Seed script
write-path: --apply resumes the admin's unseeded sandbox; keeps an existing name unless --admin-name; keeps sign-in errors.
read-path: the sign-in lookup stops and says so past 50,000.

### Nightly backfill
write-path: none for sandbox calls in the all-companies run.
read-path: runDissectBackfill reads the sandbox companies and leaves their calls out unless scoped to one.

### Seed function
write-path: rss_sandbox_seed (0398) refuses a removed admin or rep; sample lines carry no source.
read-path: none.
