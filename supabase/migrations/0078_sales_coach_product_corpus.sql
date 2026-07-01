-- 0078: product / brand details as a second corpus KIND.
--
-- WHY (founder 2026-07-01): the Sales Coach needs to know WHAT the company
-- sells — the product/brand details — to answer Prep Time questions ("what am
-- I selling?") and to coach product-aware. That knowledge lives in the SAME
-- append-only versioned store as the methodology (0074), tagged by `kind`, so
-- the product field behaves exactly like the methodology field on the same
-- Settings page.
--
-- §3.1 — append-only: the existing do-instead-nothing update/delete rules on
-- sales_coach_corpus_versions already cover this column; each save appends a
-- new version. Existing rows backfill to 'methodology' (the default), so the
-- methodology corpus + all its readers are unchanged.

alter table sales_coach_corpus_versions
  add column if not exists kind text not null default 'methodology'
    check (kind in ('methodology', 'product'));

-- Latest-of-kind lookups: (company, kind, newest first).
create index if not exists sales_coach_corpus_kind_idx
  on sales_coach_corpus_versions (company_id, kind, created_at desc);
