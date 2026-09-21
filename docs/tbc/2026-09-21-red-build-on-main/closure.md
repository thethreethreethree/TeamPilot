# CLOSURE — the line that did nothing, twice

`npm run build:ci` is the secretless build, and it is exactly what CI's Build step runs. It had
been failing on main, on a page nobody in this session had touched, for long enough that at least
one prior session shipped without ever running it.

It surfaced only because the previous build shipped UI, which made the command genuinely relevant
instead of skippable. That is A38 arriving with a date on it: *"verified" is a claim about a
command you ran*, and a subset chosen by the author cannot fail on anything the author did not
think to name.

The page mounts a component that builds the browser Supabase client during render, so it can push
audio straight to a signed upload target. `createClient()` throws by design when the env is
missing — a deliberate fail-loud that §1.5.3 would endorse. A static export renders the page on a
machine with no public Supabase env, so the throw landed at build time and took the whole build
with it. The fail-loud was correct; it was firing in the wrong place, where no user was present to
hear it.

Its sibling `/dashboard/sales-coach/doors` mounts a component with the identical pattern and does
not break the build. The visible difference was `export const dynamic = "force-dynamic"`, so that
line went onto the failing page.

**The build failed identically.**

That is the moment this build is really about. §2 is unambiguous — if a fix fails, stop; a
repeated failure means the *identification* was wrong, not the implementation, and retrying a
misdiagnosis with more force is forbidden. The tempting second move was another directive, or a
config variation, or a Suspense boundary. Instead the two page files were read side by side again,
and the actual difference was on line one: the working page is a **server** component, the failing
one said `"use client"`.

Route segment config is honoured only in a server component. In a client file Next.js ignores it
— no warning, no type error, no lint diagnostic. The sibling was never saved by having the
directive; it was saved by being a server shell that mounts a client component. The failing page
held a `useRouter` call, which made it a client component, which made the fix a no-op that looked
exactly like a fix.

So the first diagnosis was fast, fluent, supported by a real precedent inside this same repo, and
wrong — §5's description, almost to the word. And the wrong mental model *survived contact with
the failure*, which is what separates this from an ordinary bug. A person reviewing the first
attempt would have approved it.

That is why it is now a gate rather than a note. A30 says a lesson kept in prose returns; A33 says
a gate must be precise or not exist, and most classes do not qualify — the same file declines to
gate a costlier one for exactly that reason. This one qualifies by construction. A client-component
page file exporting route segment config is wrong whatever it mounts, with no import graph, no
reachability analysis and no judgement call. At best the line is dead; at worst the page is
prerendered against its author's intent. There is no legitimate instance, so INVARIANT 27 has no
allowlist.

It is self-tested in both directions, and the second direction is the load-bearing one: the rule
asserts it would have caught the real breaker, and that it stays quiet on the shipped fix. A guard
that only proved it could stay silent would have blessed the first, wrong attempt.

The class was swept rather than the instance patched. Exactly two components in the codebase build
the browser client during render; both are now behind server shells, and the new invariant reports
zero across 1,040 files.

Worth recording that the rule itself failed twice before it ran: a shell heredoc turned escape
sequences inside the detector and its message into literal newlines, and the audit died with a
`SyntaxError` both times. Loudly, so nothing shipped broken — but a mangled rule inside a
*passing* audit would have reported zero violations while detecting nothing at all, which is the
whole reason the self-tests exist and exit 3.

Main is green. For the first time this session, a production build has rendered the Pitch Score
UI — the previous build's output had never been prerendered, because the export died before
reaching it.

---

## Residual

```json
[
  { "id": "R1-nothing-runs-build-ci-before-a-commit",
    "item": "The pre-commit hooks run the TBC gates and the constitutional citation check. They do not run build:ci, and neither does anything else local. Main went red and stayed red.",
    "why_skipped": "build:ci takes ~2 minutes; putting it in pre-commit would make every commit cost that, which is the kind of friction people route around with --no-verify, and a gate people disable is worse than none.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T14:05:00Z",
    "outcome": "OPENED. It looks handled because CI runs it — but CI running it is exactly what happened here, and main stayed red anyway, because a red CI on somebody else's push is easy to not-see. INVARIANT 27 now covers THIS class of breaker specifically, which is a narrower fix than 'run the build'. The honest framing: the build can still break a dozen other ways (a useSearchParams without a Suspense boundary is named in the script's own error text) and nothing local catches any of them. A pre-PUSH hook rather than pre-commit is the shape worth trying — it pays the two minutes once per push instead of once per commit." },

  { "id": "R2-the-fixed-page-has-never-been-opened",
    "item": "prep/page.tsx was split into a server shell and a client route component. It compiles, typechecks and prerenders. Nobody has loaded it or clicked Start Meeting.",
    "why_skipped": "Requires running the app with real env and a real meeting prep; the change is a mechanical file split with unchanged props.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-21T14:06:00Z",
    "outcome": "OPENED because it sits highest in the confidence ranking, which per A36 is where to read hardest. The reason it looks safe is that MeetingPrepUp is untouched and its one prop is passed identically. The reason it might not be: the page went from client to server, so anything depending on it being a client boundary — a context provider above it, a hook expecting the page's own render — would now break at runtime rather than at build. Nothing in the file suggested such a dependency, but 'nothing suggested it' is the same standard that approved the first fix." },

  { "id": "R3-INV27-does-not-cover-the-general-render-time-client-construction-class",
    "item": "The gate catches stranded segment config. It does NOT catch the underlying hazard: a component that builds the browser Supabase client during render, mounted from a prerendered page that has no directive at all.",
    "why_skipped": "That rule needs import-graph reachability from each page to each component, and a version checking only DIRECT imports would give a confident wrong answer — which INVARIANT 26's own notes record happening twice.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-21T14:07:00Z",
    "outcome": "OPENED and deliberately declined for now under A33 — a gate must be precise or not exist, and an imprecise one here would flag correct pages and be learned-around. The coverage boundary is stated rather than implied: today there are exactly two such components and both sit behind server shells, so the class is empty by inspection, not by enforcement. A third added next month is caught by build:ci in CI and by nothing before it. INVARIANT 26 already walks the import graph for a comparable class, so the technique exists in this file if this one recurs." }
]
```
