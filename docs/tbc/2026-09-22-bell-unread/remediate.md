# REMEDIATE — read means shown

### The TBC gate was validating a build from four hours earlier

gate-or-promise: gate

`frontMatter()` matched `/^---\n/`. A `think.md` saved with Windows line endings opens `---\r\n`,
which that pattern does not match, so the function returned `null`. `currentBuildDir()` treats a
build with no readable `started_at` as un-dated and keys it on its directory NAME instead — and a
name never beats a real timestamp. The gate therefore selected an older build and validated that.

Fixed at the parser, not at the files:

```js
const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---/);
…
for (const raw of m[1].split(/\r?\n/)) {
```

**Why the parser and not a line-ending normalisation.** Rewriting 30 documents fixes 30
documents. The next one written on Windows would be invisible again, and invisibly — there is no
error, no warning, and the gate reports green either way. A30 is explicit that a fix is not
complete until the class is encoded in something that fails without the author's cooperation.

**The gate that now fails without cooperation:** `scripts/tbc/__tests__/frontMatter.test.ts`, four
cases. Reverting the regex to `^---\n` fails two of them by name:

```
FAIL  … > THE REGRESSION — reads front matter written with CRLF line endings
FAIL  … > reads a nested key the same way under CRLF
      Tests  2 failed | 2 passed (4)
```

The nested-key case is there because that branch trims and therefore survived CRLF on its own —
but it only ever ran when the outer match succeeded, so it had never been exercised on a CRLF
document at all. A passing-by-accident path is not a tested one.

**What is NOT remediated.** The 30 documents keep their line endings. They are now readable, and
rewriting a record to make it more convenient to read is the thing §3.1 exists to prevent. The
seven builds of 2026-09-22 that shipped without their docs being gated stay shipped; their code
passed every other step of `npm run check`, and what went unchecked was the record's conformance,
not the software. Said plainly here rather than quietly corrected.
