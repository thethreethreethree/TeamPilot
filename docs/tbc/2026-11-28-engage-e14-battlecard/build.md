# BUILD - E14: competitor battlecard

### Battlecard
write-path: none — askCoach with save: false stores no chat or turns.
read-path: POST /api/coach/remote/market/battlecard reads the Market page's calls through the caller's client (readMarketInputs), picks the newest 10 naming the competitor (callsNaming), and asks Ask Coach the battlecard instruction; the Market page shows the cited card under the competitor table.
