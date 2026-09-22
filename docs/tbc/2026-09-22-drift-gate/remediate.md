# REMEDIATE — two is better than forty-eight and it is still two

### A parser that read past the function body

gate-or-promise: gate

The first version matched `function NAME\(\)[\s\S]*?array\[…\]` and, against the real migrations,
attributed three arrays to functions that do not contain them — including
`auth_company_id => ["tasks","team_members","decisions","conversations"]`, from a function whose
entire body is `select company_id from profiles where id = auth.uid()`.

Fixed by bounding the match to the dollar-quoted body with a backreference to its own tag, then
searching for the array inside that body. The real corpus now yields exactly one source.

**The gate that fails without my cooperation:** `DOES NOT READ PAST THE FUNCTION BODY` in
`scripts/__tests__/enum-coverage-audit.test.ts`. Its fixture puts an array in a *later statement*
and asserts the function is reported as having no value list. Reverting the regex to the unbounded
form fails five of the twenty tests.

**What it does not gate: the class, only the instance.** A parser that silently reads the wrong
thing is not detectable in general — its output is a verdict shaped exactly like a correct one.
What made this findable was printing the extracted pairs against the real corpus, and that is a
habit, not a check. Written down here because A30 is explicit that a lesson kept only in prose
comes back.

### CHECK values were being lowercased, and it was about to matter

gate-or-promise: gate

The CHECK half of this audit read its values from the lowercased text while reading the mirror's
members with their case intact. Invisible on all eight mirrors declared before today, because
every one of them holds snake_case values where lowercasing is a no-op.

It stops being invisible at the first mixed-case list, which is `team_invitations.role`:

```sql
check (role in ('CEO','CFO','COO','VP','Director','Manager','Supervisor','Lead','Member'))
```

Declaring `INVITABLE_ROLES` as a mirror of that would have reported all nine values as **both**
MISSING and NOT IN THE DATABASE. The marker would have been unusable on the one other
two-authority list this repository has, and the obvious repair — lowercase the mirror too — would
have permanently disabled the audit's ability to catch a genuine case mismatch.

Values now read from the case-preserved text; identifiers still matched case-insensitively,
because SQL identifiers are. Guarded on length equality, since `toLowerCase()` is only
length-preserving for ASCII.

**The gates:** three cases in `a CHECK set keeps the case its migration wrote` — a mixed-case pair
passes, a genuine case difference still fails, and `ALTER TABLE Team_Invitations … CHECK (Role IN …)`
still keys as `team_invitations.role`. Reverting the fix fails four tests, including the one that
runs against the real repository.

### A function whose list is not a literal array

gate-or-promise: declined

`select enum_range(null::some_enum)`, a table lookup, a `case` expression — none is parsed. A
marker pointing at one fails as *"no function named X returning a value list exists"*, which is
honest and unhelpful: the function exists, and the audit cannot read it.

Declined rather than promised, because the right response is not more parsing. Every additional
form is more surface for the first finding above — a parser that reads the wrong thing
confidently. One literal array is what `admin_roles()` is and what any list intended as a mirror
should be; a list this audit cannot read is a list that should be written differently, and the
failure message is clear enough to prompt that.

If a real case appears where the list genuinely cannot be a literal, that is the evidence to
revisit this with. Not before.
