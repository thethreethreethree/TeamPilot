-- 0393 — trusted addresses per API key (2026-11-28; Engage plan E15; Gong F33.10). Re-runnable.
--
-- api_keys.allowed_ips: the IP addresses or ranges (CIDR) a key may be used from; null = anywhere. Postgres's cidr type
-- refuses a malformed entry. Set only when the key is made: 0378's guard freezes every column but revoked_at, so a new
-- list is a new key (the old one revoked) — the same "a key never changes" rule. Checked in authenticateApiKey.

alter table public.api_keys add column if not exists allowed_ips cidr[];
alter table public.api_keys drop constraint if exists api_keys_allowed_ips_check;
alter table public.api_keys add constraint api_keys_allowed_ips_check
  check (allowed_ips is null or (cardinality(allowed_ips) between 1 and 20));
