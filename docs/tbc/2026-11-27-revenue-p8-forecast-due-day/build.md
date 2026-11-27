# BUILD - Forecast due day and reminder

### Due day
write-path: companies.forecast_due_weekday (0391, default Monday) via POST /api/coach/remote/forecast {kind: due_day} — company admins; the 0391 guard trigger refuses anyone else in the database.
read-path: GET /api/coach/remote/forecast returns dueWeekday and canSetDue; the board says "Due every …" (admins: a picker).

### Reminder
write-path: the nightly job (runRevenueDaily → sendForecastReminders) claims forecast_reminders (person, date), then inserts a manager_notifications 'forecast_due'.
read-path: the bell says "Your forecast for 2026 Q4 is due today" and opens /dashboard/remote-sales/pipeline?view=forecast.
