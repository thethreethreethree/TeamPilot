-- 0324 — a phone number erased from free text takes its brackets with it (2026-11-23; docs/tbc/2026-11-23-erasure-day-plans
-- residual R3: "(555) 010-0123" became "([removed]").
--
-- rss_erasure_text_pattern (0322) is the one pattern day plans and prospects are matched and replaced with. For a phone
-- number it now also takes an opening bracket right before the digits, so the whole written number goes. Everything else
-- is 0322's body unchanged. Re-runnable.

create or replace function public.rss_erasure_text_pattern(p_kind text, p_value text)
returns text language plpgsql immutable set search_path = public as $$
declare
  digits text := regexp_replace(coalesce(p_value, ''), '\D', '', 'g');
  needle text;
begin
  if p_kind = 'phone' then
    if length(digits) < 7 then raise exception 'RSS erasure: a phone number needs at least 7 digits'; end if;
    needle := case when length(digits) > 10 then right(digits, 10) else digits end;
    -- an optional "(" then the digits in order, allowing up to three separators between them ("(555) 010-0123")
    return '\(?' || array_to_string(regexp_split_to_array(needle, ''), '[^0-9A-Za-z]{0,3}');
  elsif p_kind in ('email', 'client_label') then
    if length(trim(coalesce(p_value, ''))) < 2 then raise exception 'RSS erasure: identifier too short'; end if;
    return regexp_replace(trim(p_value), '([\.\^\$\*\+\?\(\)\[\]\{\}\|\\\-])', '\\\1', 'g');
  end if;
  raise exception 'RSS erasure: unknown match kind %', p_kind;
end $$;

revoke all on function public.rss_erasure_text_pattern(text, text) from public, anon, authenticated;
grant execute on function public.rss_erasure_text_pattern(text, text) to service_role;
