# BUILD - Forecast deals and movement; win/loss drill-down

### Forecast
write-path: none.
read-path: GET returns each submission's stored deals; the panel names them from the reader's pipeline and shows movement() against the previous submission.

### Win/loss
write-path: none.
read-path: each Band carries its closed deals' ids; a row opens them; winLossCsv through toCsv.
