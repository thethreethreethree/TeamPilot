# BUILD - co-owner review fixes

### Co-owned rows
write-path: none.
read-path: GET /api/coach/remote/prospects coOwned rows carry no signals or sentiment; rss_co_owned_deals (0396) reads the person's company only.

### Read-only panel
write-path: none (controls disabled).
read-path: a readOnly deal shows Overview, Contacts and Activity inside a disabled fieldset; its calls read pinned to the company.
