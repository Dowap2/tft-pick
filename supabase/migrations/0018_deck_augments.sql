-- docs/티어기준.md §4.9: 덱별 증강을 우리 데이터로 집계한다.
--
-- 증강은 ingest_match 가 raw.participants.augments 에 이미 저장하고 있었는데,
-- raw_boards 가 그 컬럼을 반환하지 않아 클러스터링이 보지 못했다.
-- 그래서 /augments 와 덱 상세의 추천 증강은 metatft 큐레이션을 쓰고 있었다.
-- 컬럼 하나를 열어주면 "이 덱에서 뭘 고르나"를 자체 표본으로 답할 수 있다.

drop function if exists public.raw_boards(int);
create or replace function public.raw_boards(p_patch_id int)
returns table(match_id text, puuid text, placement smallint, level smallint, units jsonb, traits jsonb, augments text[])
language sql security definer set search_path = public, raw as $$
  select p.match_id, p.puuid, p.placement, p.level, p.units, p.traits, p.augments
  from raw.participants p join raw.matches m using (match_id)
  where m.patch_id = p_patch_id and p.units is not null
$$;
revoke all on function public.raw_boards(int) from public, anon, authenticated;
grant execute on function public.raw_boards(int) to service_role;

-- decks_bundle 에 증강 노출 (0017 과 동일, augments 서브쿼리만 추가)
create or replace view decks_bundle as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.playstyle, d.carry_unit_id,
  d.core_unit_ids, d.levelling, d.difficulty,
  d.requires_augment, d.requires_special_item, d.qualifier_label, d.requirement_note,
  s.games, s.avg_place, s.win_rate, s.top4_rate, s.pick_rate,
  s.games_apex, s.avg_place_apex, s.games_high, s.avg_place_high,
  (select jsonb_agg(jsonb_build_object('unitId', du.unit_id, 'star', du.target_star, 'pos', case when du.pos_row is null then null else jsonb_build_array(du.pos_row, du.pos_col) end, 'core', du.is_core))
     from deck_units du where du.deck_id = d.id and du.patch_id = d.patch_id)         as units,
  (select jsonb_agg(jsonb_build_object('unitId', di.unit_id, 'itemId', di.item_id, 'role', di.role, 'priority', di.priority) order by di.priority)
     from deck_items di where di.deck_id = d.id and di.patch_id = d.patch_id)         as items,
  (select jsonb_object_agg(dl.level, jsonb_build_object('units', dl.unit_ids, 'avg', dl.avg_place, 'count', dl.games))
     from deck_levels dl where dl.deck_id = d.id and dl.patch_id = d.patch_id)        as levels,
  (select jsonb_agg(jsonb_build_object('id', da.augment_id, 'tier', da.tier, 'avg', da.avg_place, 'games', da.games) order by da.avg_place)
     from deck_augments da where da.deck_id = d.id and da.patch_id = d.patch_id)      as augments,
  (select jsonb_agg(jsonb_build_object('deckId', dc.against_deck_id, 'placeChange', dc.place_change))
     from deck_counters dc where dc.deck_id = d.id and dc.patch_id = d.patch_id)      as counters
from decks d
left join deck_stats s on s.patch_id = d.patch_id and s.deck_id = d.id
where d.is_published
  and s.games >= 100
  and s.avg_place < 4.75
  and d.patch_id = (select id from patches where is_current);

grant select on decks_bundle to anon, authenticated, service_role;
