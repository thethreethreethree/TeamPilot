# CHECK - Turn a Market topic into a tracker

## Commands

```
npx vitest run MarketView.track.render InsightViews.render → 8 passed (create body: name, wordings, customer side; scan sent; "Tracking ✓"; a refusal shown; no button for a rep)
```

## Findings

No findings: the button calls the existing trackers route, which keeps its own checks.

## Final

```
npm run check → exit 0 · Test Files 903 passed | 1 skipped · Tests 6675 passed | 15 skipped
```
