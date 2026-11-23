# BUILD - Forecast by quarter

No migration. No env keys.

### See the forecast by quarter
write-path: none.
read-path: Pipeline → Forecast → "By expected close month" → "Quarters" → byQuarter(forecastByMonth(...).months) →
past due row, then each quarter with deals, value and expected.
