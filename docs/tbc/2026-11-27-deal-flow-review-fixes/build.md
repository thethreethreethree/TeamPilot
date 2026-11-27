# BUILD - Deal-flow batch review fixes

### Field history account moves
write-path: none.
read-path: the deal route returns the named accounts' names (caller's client); a move from one account to another shows both names; the same account saved again isn't a change.

### Meeting prep window
write-path: agent_fires claims (nextcall:<deal>:<date>) as before.
read-path: nextCallFires takes next calls dated today or tomorrow (company days), so a call booked after the night's run, or a missed night, still gets prep once.

### Forecast reminder timing
write-path: forecast_reminders claims per (person, due date); the notice carries due_day.
read-path: the first run where the due weekday is today or tomorrow reminds; the 7-day window compares times; the bell says "due on Monday, Nov 30"; a reminder failure is counted (remindersFailed), not thrown.

### The board and the bell link
write-path: none.
read-path: ?view=forecast is followed when the URL changes on the same page; a due day the route couldn't read shows "Couldn't read the due day".
