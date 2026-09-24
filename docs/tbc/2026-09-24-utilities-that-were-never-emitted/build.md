# BUILD — six config lines, one call site, one gate

### The producer

- **write-path:** `tailwind.config.ts` — `primary`, `secondary`, `muted`, `default`, `strong` and
  `accent-text` added to `backgroundColor`.
- **read-path:** the full 62-capture pass, hashed against a pre-change snapshot.

**Each name keeps the meaning it already has in the namespace where it IS defined**, which is the
only mapping that needs no judgement: `bg-muted` is the muted INK, `bg-default` is the default
BORDER colour, `bg-accent-text` is the brand text colour. That is what every author of these 25
sites believed they were writing.

The intent is unambiguous once the sites are read together:

| what it is | sites | what it rendered as |
|---|---|---|
| status DOT for the "off" state, beside a `bg-emerald-400` "on" | 8 | nothing — empty space where the off state should be |
| a 1px rule or separator | 5 | nothing |
| the Scoreboard "YOU" chip and your own row's highlight | 2 | no pill, no highlight |
| the Pattern Interrupt "path to fixed" progress track | 1 | nothing under "0 of 5 clean pitches in a row" |
| the Learning Mode toggle KNOB in its off position | 1 | an empty circle |
| selected-state tints, legend swatches, tag dots | 8 | nothing |

### The one site the producer fix does not serve

- **write-path:** `CalibrationTool.tsx:128` — `bg-primary … text-white` → `bg-ember-400 …
  text-[#09090B]`, with a hover state, matching every other primary button in the module.

This is the "Submit & compare" button. Today its background emits nothing, so it is **white text on
the page background — invisible on cream.** But `bg-primary` resolves to `--text-primary`, which is
near-black on light and near-**white** on dark: making the utility work would have moved the
invisibility from light mode into dark mode rather than removing it.

**A producer fix is right for the class and wrong for the member whose author picked the wrong
token.** Reading the 26 sites together is what separated them; a global find-and-replace would have
shipped a button that is invisible half the time and looked like a fix.

### The gate

- **write-path:** `src/__tests__/no-wrong-namespace-color-utilities.test.ts`.

It derives the token names from the config itself (every name on a per-property scale that is not
in `colors`), asks Tailwind's own `resolveConfig` whether `backgroundColor[name]` exists, and
searches the codebase only for the ones that do not. `(/\d+)?` is in the pattern because an opacity
modifier does not rescue it — `bg-primary/15` needs the namespace entry exactly as `bg-primary`
does, which is why the Scoreboard chip was invisible.

**It passes on day one**, because the 26 offenders were fixed first. A gate added red and
suppressed is worse than no gate (A30).

**And it fails when it should.** Mutation-tested by deleting `muted` from the config: the test goes
red and names all five files. Restored: green.

**Its exclusions are written into the test, with counts** — `text-strong` (18 uses, 3 files),
`border-primary` (2), `border-accent-text` (10). Those are real members of the class that the
founder scoped out, and `text-strong` deliberately: it is a no-op that inherits its parent colour,
which is what those screens were reviewed and approved looking like. Naming them in the file is the
point; a guard that silently covers part of a class is how a class comes to be believed closed.

```
$ npx vitest run src/__tests__/no-wrong-namespace-color-utilities.test.ts → 2 passed
$ npx tsc --noEmit -p tsconfig.json → exit 0
$ npm run visual → 62 captures
```
