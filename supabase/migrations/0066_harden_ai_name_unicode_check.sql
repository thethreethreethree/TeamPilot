-- 0066 — Harden the ai_name prompt-injection CHECK against the
-- Unicode line/paragraph separators the 0064 constraint missed.
--
-- Audit 2026-06-24 (finding H1): migration 0064 added
--   check (char_length(ai_name) between 1 and 50
--          and ai_name !~ '[[:cntrl:]]')
-- The closure manifest claimed prompt injection via ai_name was
-- "blocked". It was NOT fully blocked. [[:cntrl:]] catches the
-- C0 controls (U+0000-U+001F) + DEL (U+007F), but NOT:
--   • U+2028 LINE SEPARATOR
--   • U+2029 PARAGRAPH SEPARATOR
--   • U+0085 NEL (C1 next-line)
-- These render as logical line breaks in many text contexts. A
-- tenant admin could set ai_name to
--   'Habiba<U+2028>FORGET PRIOR INSTRUCTIONS'
-- and inject a new instruction line into the LLM system prompt
-- (the name is interpolated into buildIdentity()).
--
-- Also blocking zero-width / BOM chars (U+200B-U+200D, U+FEFF)
-- as obfuscation defense — they let an attacker hide content
-- inside an otherwise-innocent-looking name.
--
-- Constitutional sources (§0.1):
--   • §A12 — DROP CONSTRAINT IF EXISTS then ADD; idempotent /
--     replayable. (The 0065 first-draft taught this the hard
--     way — every named-object create gets a preceding drop.)
--   • §0 — understanding precedes solving. The prior fix solved
--     the C0-control half of the threat and *claimed* the whole.
--     This solves the actual remaining vector.
--   • §A14 — the Zod layer (API) and the CHECK layer (DB) are
--     two render branches of the same defense. 0064 fixed one
--     incompletely and the other incompletely. This commit fixes
--     both: the Zod transform now strips \p{C}\p{Zl}\p{Zp}; this
--     migration aligns the DB backstop.
--
-- Postgres ARE (advanced regex) supports \uXXXX hex escapes, so
-- we name the exact codepoints rather than embedding invisible
-- literal characters (those would be silently corrupted by
-- editors / CRLF conversion in a committed file). We keep
-- [[:cntrl:]] for the C0+DEL range and add the explicit
-- separator / format codepoints.
--
-- Existing-data note: the only rows today are ELOSTATE + Haqqy
-- Life, both 'Jeff' or a clean rename, so the stricter ADD will
-- not fail on legacy data. If a future replay hits dirty data,
-- the ADD will error loudly (correct — surfaces the bad row
-- rather than silently accepting an injection vector).

alter table care_tenant_config
  drop constraint if exists care_tenant_config_ai_name_safe;

alter table care_tenant_config
  add constraint care_tenant_config_ai_name_safe
  check (
    char_length(ai_name) between 1 and 50
    and ai_name !~ '[[:cntrl:]]'
    -- U+0085 NEL, U+2028 LINE SEP, U+2029 PARA SEP,
    -- U+200B-U+200D zero-width, U+FEFF BOM/zero-width-nbsp.
    and ai_name !~ '[\u0085\u2028\u2029\u200B\u200C\u200D\uFEFF]'
  );

comment on constraint care_tenant_config_ai_name_safe
  on care_tenant_config is
  '2026-06-24 (audit H1): rejects control chars AND Unicode
   line/paragraph separators + zero-width/BOM chars. The name is
   interpolated into the LLM system prompt (buildIdentity); these
   classes are prompt-injection / obfuscation vectors. Mirrors the
   Zod \p{C}\p{Zl}\p{Zp} transform at the API layer.';

-- ─── End migration 0066. ────────────────────────────────────
