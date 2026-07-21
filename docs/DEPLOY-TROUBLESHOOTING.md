# Deploy troubleshooting — "my updates aren't showing"

> Written after the 2026-07-21 incident, where "updates not reflecting on the phone" turned out to be
> **weeks of failed Vercel builds** — nothing had deployed. Start here next time; it's usually a 2-minute check.

## 0. The mental model

"Not reflecting" almost never means a cache bug. It usually means **the new code never deployed.** Check that
first, before touching service workers or clearing caches.

- **A `git push` is NOT a deploy.** Vercel has to build the commit. If auto-deploy is off, pushes pile up
  undeployed.
- **Production serves the last _successful_ build.** If recent builds errored, prod is frozen at an old commit
  even though `main` has moved on.
- **The service workers here do NOT cache app code.** `sw.js` is pass-through; `sw-team-chat.js` caches only 3
  icon/manifest files under `/dashboard/chats/`. So stale-SW-cache is rarely the cause.

## 1. First check (30 seconds): are builds actually deploying?

Vercel → your project → **Deployments**. Look at the most recent ones:

- **Latest deployment older than your latest commit** → auto-deploy is off, or you haven't deployed. Trigger a
  deployment of `main`.
- **Red "Error" status** → the build is failing. Nothing has deployed since the last green one. Go to section 2.
- **Green "Ready" and recent** → the build deployed; the issue is on the device (go to section 4).

## 2. A build is erroring — get the actual cause

Click the red deployment → **Build Logs** → scroll to the bottom / the red line. The **last ~30 lines** name
the real error. Common causes seen here:

| Symptom in the log | Cause | Fix |
|---|---|---|
| `useSearchParams() should be wrapped in a suspense boundary at page "/X"` | A **statically prerendered** page (or a component it renders) calls `useSearchParams()` without `<Suspense>`. Fails the whole build. | Wrap it: `export default () => <Suspense fallback={null}><Inner/></Suspense>`. See `src/app/login/page.tsx` for the pattern. Dynamic (`ƒ`) pages don't hit this; static (`○`) ones do. |
| `Module not found` for a file that exists | **Case-sensitive import** — Windows resolves it, Vercel's Linux doesn't. | Match the import's case to the real filename exactly. |
| Fails only when `SENTRY_AUTH_TOKEN` is set (Vercel), passes locally | Sentry source-map upload. (Ruled out here 2026-07-21, but a classic.) | Fix the Sentry org/project/token, or make the upload non-fatal in `next.config.ts`. |
| `npm ci` errors on install | `package-lock.json` out of sync with `package.json`. | Run `npm install` locally, commit the updated lockfile. |

## 3. Reproduce the Vercel build locally BEFORE pushing

The founder's box is Windows (case-insensitive); Vercel is Linux. To catch build breaks locally:

```
npm run build          # full production build — catches prerender + type errors. RUN THIS before pushing.
npm run check          # typecheck + lint + audits + tests (what CI runs)
```

If `npm run build` passes locally on the current tree, the same commit almost always builds on Vercel — the
one exception is Linux case-sensitivity, which a Windows build can't catch.

## 4. Build is green but the phone still shows old

Installed PWAs keep the previous JS **in memory** until fully reloaded:

1. **Fully close the app** (swipe it out of the app switcher — backgrounding isn't enough) and reopen. Or
   pull-to-refresh / close and reopen the browser tab.
2. Confirm you're logged in as the **same profile** — some UI (e.g. Standard vs Expert **experience mode**) is
   per-profile, so a different login shows different UI independent of any deploy.

## 5. The root-cause fix: don't let this recur

- **Turn on Vercel auto-deploy.** Vercel → Settings → Git → ensure `main` deploys on every push. The 2026-07-21
  incident happened because auto-deploy was off and fixes piled up unbuilt for ~9 days.
- **CI already runs `next build`** (`.github/workflows/ci.yml`) on every push — so a red CI check is an early
  warning that a build will fail on Vercel too. Watch it.
