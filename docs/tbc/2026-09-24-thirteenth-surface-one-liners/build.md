# BUILD — one token, and a capture of three states

### The error line

- **write-path:** `strategy/page.tsx:78` — `text-amber-300` → `text-amber-600
  dark:text-amber-300`.
- **read-path:** `npm run visual -- oneLiners`, the `one-liners-error` pair.

The only page-local member of today's class in this file. Every other defect on this surface was
inherited, and every other defect on this surface was already fixed by the change to
`ui/deck.tsx` — without this file being touched.

```
$ npm run visual -- oneLiners
      Tests  3 passed (3)
  6 image(s) in artifacts/visual/
exit 0
```

### The capture

- **write-path:** `src/test/captures/oneLiners.capture.tsx` — three states, both themes.
- **read-path:** six images, each opened.

Two decisions in it worth naming:

**`LearningHint` is mocked to render its children, not to null.** Every other capture in the set
nulls it, because elsewhere it is a wrapper around a hint. Here it is `as="block"` and WRAPS the
content of both sections — nulling it would have deleted most of the page and photographed the
gaps, then reported three green tests.

**The fetch stub answers `strategy-library` explicitly and nothing else.** A catch-all `{}` would
set `data` to an object with no `correctLines`, and `data.correctLines.length` would throw — a
crash this page cannot have, manufactured by the stub. That exact mistake cost three phantoms
earlier today, twice in the same file, the second time directly beneath the comment warning about
it.

**The empty-state matcher waits on "No correct lines yet"** — a sentence that exists only in the
empty state. The inverse of the Analytics matcher this morning, which waited on a word the empty
state also contained and was therefore green while the page rendered nothing.
