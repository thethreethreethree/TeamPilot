# REMEDIATE - Count every sign-in in team usage

### F1 - the usage view counted only web-form sign-ins
rss_sign_in_times + mergeSignIns.
gate-or-promise: gate (route test: a session-only sign-in counts)
