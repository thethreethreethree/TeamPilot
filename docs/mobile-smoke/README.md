# Production smoke of the routes the app calls

`app-routes.smoke.py` calls every route the app uses, once per exported method, with no login and no body, and
expects a refusal (401/403/405). Run 2026-10-01 against elostate.com: 53 calls.

- 33 refused as expected.
- 19 answered 400: the route validates the body before the login. The app always sends a valid body, so an
  expired login still gets its 401; recorded, not changed.
- 1 answered **200**: `GET /api/coach/sales-session/<id>/after-pitch` returned an empty summary to a caller who was
  not signed in (its POST returned 404). No data leaked, but the app read it as "this call has no review".
  Fixed to answer 401 (docs/tbc/2026-10-01-not-signed-in-is-not-empty).

No call returned 404 or 500: every route the app depends on exists and runs.
