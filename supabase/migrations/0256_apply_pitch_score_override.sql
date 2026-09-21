-- 0256 — apply_pitch_score_override: amend one item, log it, store the new verdict, in ONE transaction
--
-- SPECIFIED, not invented. The rubric's implementation notes (page 7): "Manager override: managers
-- can adjust any bonus or violation, with the change logged." Widened by the founder on
-- 2026-09-21 to element grades, which is a superset.
--
-- THIS FUNCTION DOES NO ARITHMETIC, AND THAT IS THE ENTIRE DESIGN.
--
-- The obvious implementation recomputes base, bonus, violations, total, the six section totals and
-- the qualifying verdict in SQL. I wrote that version first. It is wrong, and it is wrong in the
-- way this session has now found four times: it duplicates decisions that already have an
-- authority. Specifically it would restate, in a second language,
--
--     the element → section mapping          (rubric.ts, on every element)
--     the Delivery 27→35 scaling rule        (scorePitch.ts)
--     the +30 bonus pool cap                 (scorePitch.ts / rubric.ts)
--     the formula and its zero floor         (scorePitch.ts)
--     the 40-base qualifying test            (scorePitch.ts / rubric.ts)
--     the band boundaries                    (gamification/bands.ts)
--
-- Six duplicated decisions, all of which would agree on the day they were written — which is
-- exactly what makes the class invisible (§2.2). A rubric change would then land in TypeScript and
-- silently not land here, and the pitch a manager corrected would be the one pitch in the system
-- scored under the old rules.
--
-- So the caller reads the evidence, applies the correction in memory, recomputes with scorePitch —
-- the SAME function that produced the original score — and passes the finished verdict in. This
-- function writes. One transaction, one authority for every number in it.
--
-- NOT CLIENT-CALLABLE (INVARIANT 4): SECURITY DEFINER taking a company id is the shape that
-- invariant exists to catch. The route enforces manager-only before calling.

create or replace function apply_pitch_score_override(
  p_company_id  uuid,
  p_pitch_id    uuid,
  p_actor_id    uuid,
  p_item_type   text,     -- 'element' | 'bonus' | 'violation'
  p_item_id     text,
  p_old_value   text,
  p_new_value   text,     -- element: 'hit'|'partial'|'missed'   bonus/violation: 'awarded'|'removed'
  p_old_points  numeric,
  p_new_points  numeric,
  p_reason      text,
  -- The recomputed verdict, from scorePitch. Every number below was produced by the authority.
  p_base        numeric,
  p_bonus       numeric,
  p_violations  numeric,
  p_total       numeric,
  p_qualifying  boolean,
  p_not_qualifying_reason text,
  p_section_points jsonb,
  p_band        text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_override_id uuid;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'apply_pitch_score_override: a reason is required — an unexplained override is indistinguishable from editing a number somebody disliked';
  end if;

  if not exists (select 1 from pitch_scores where id = p_pitch_id and company_id = p_company_id) then
    raise exception 'apply_pitch_score_override: pitch % not found in company %', p_pitch_id, p_company_id;
  end if;

  -- ── Amend the evidence ──────────────────────────────────────────────────────────────────
  if p_item_type = 'element' then
    -- Upsert, not update. An element the scorer never graded is a real correction — "the rep did
    -- this and the AI missed it entirely" is the commonest case on a short pitch.
    insert into pitch_score_elements (company_id, pitch_id, element_id, grade, points, evidence)
    values (p_company_id, p_pitch_id, p_item_id, p_new_value, coalesce(p_new_points, 0),
            'Corrected by a manager')
    on conflict (pitch_id, element_id) do update
      set grade = excluded.grade, points = excluded.points;

  elsif p_item_type in ('bonus', 'violation') then
    if p_new_value = 'removed' then
      -- Demoted, never deleted. A removed bonus becomes rejected_bonus worth 0, so the rep's Pitch
      -- detail still shows it was considered — which is why rejected bonuses are stored at all.
      -- A removed violation stays a violation worth 0 for the same reason: the row is evidence
      -- that something was heard and judged, and deleting it erases the judgement rather than
      -- reversing it.
      update pitch_score_events
         set type = case when p_item_type = 'bonus' then 'rejected_bonus' else 'violation' end,
             points = 0
       where pitch_id = p_pitch_id and item_id = p_item_id;
      if not found then
        raise exception 'apply_pitch_score_override: cannot remove % — no such event on this pitch', p_item_id;
      end if;
    else
      update pitch_score_events
         set type = p_item_type, points = coalesce(p_new_points, 0)
       where pitch_id = p_pitch_id and item_id = p_item_id;
      if not found then
        insert into pitch_score_events (company_id, pitch_id, type, item_id, points, evidence)
        values (p_company_id, p_pitch_id, p_item_type, p_item_id, coalesce(p_new_points, 0),
                'Added by a manager');
      end if;
    end if;
  else
    raise exception 'apply_pitch_score_override: unknown item_type %', p_item_type;
  end if;

  -- ── Log it ──────────────────────────────────────────────────────────────────────────────
  insert into pitch_score_overrides (
    company_id, pitch_id, item_type, item_id, old_value, new_value,
    old_points, new_points, reason, actor_id
  ) values (
    p_company_id, p_pitch_id, p_item_type, p_item_id, p_old_value, p_new_value,
    p_old_points, p_new_points, btrim(p_reason), p_actor_id
  )
  returning id into v_override_id;

  -- ── Store the verdict the authority computed ────────────────────────────────────────────
  update pitch_scores
     set base = p_base,
         bonus = p_bonus,
         violations = p_violations,
         total = p_total,
         band = p_band,
         qualifying = p_qualifying,
         not_qualifying_reason = p_not_qualifying_reason,
         section_points = p_section_points
   where id = p_pitch_id;

  return v_override_id;
end;
$fn$;

-- INVARIANT 4. Overrides run server-side with the service role; the route enforces manager-only.
revoke execute on function apply_pitch_score_override(
  uuid, uuid, uuid, text, text, text, text, numeric, numeric, text,
  numeric, numeric, numeric, numeric, boolean, text, jsonb, text
) from public, anon, authenticated;
