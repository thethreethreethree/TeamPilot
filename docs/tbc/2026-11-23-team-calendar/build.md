# BUILD - Team call calendar

No migration. No env keys or dashboard settings.

### See a week of calls
write-path: none — the calendar only reads. Booked calls come from a prospect's next call date (set in the Pipeline
list); held calls from recorded remote calls.
read-path: Remote Sales → Pipeline → Calendar (RemoteCalendar.tsx) → GET /api/coach/remote/calendar?week&scope&tz →
listProspects + coaching_sessions (REMOTE_CONTEXTS, local week bounds via dayBounds) + remote_prospect_calls through the
caller's client → buildWeek (src/lib/coach/remote/calendar.ts). Seven day cards, today outlined; Previous / Next /
This week; a manager's "Whose pipeline" shows a report's or the whole team's, with the rep's name on each entry.

### Go from an entry to the work
write-path: none.
read-path: a booked entry opens the prospect in the List view on the tab that holds it (goTo); a held entry opens
/dashboard/remote-sales/calls/[id]. The Ask box's prospect buttons now use the same goTo.
