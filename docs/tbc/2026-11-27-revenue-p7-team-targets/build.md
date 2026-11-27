# BUILD - Team revenue targets

### Forecast targets
write-path: forecast_targets with for_team (0376 policy).
read-path: latest per (person, quarter, team flag).

### Forecast board
write-path: POST target with team true from the team row.
read-path: the viewer's team target, else the sum.
