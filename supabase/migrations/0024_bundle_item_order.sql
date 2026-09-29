-- decks_bundle 의 items 정렬·placeDelta 노출을 0022 와 무관하게 마지막에 한 번 더 못 박는다.
--
-- 0023 이 0022 보다 먼저 실행돼서 0022 의 뷰 정의(placeDelta 없음)가 이겨 버렸다.
-- alter table 로 추가한 place_delta 컬럼과 값은 살아 있는데 뷰가 안 내려주는 상태였다.
-- 같은 뷰를 두 파일이 정의하면 실행 순서에 결과가 달린다 — 0015 가 같은 이유로 생긴 파일이다.
-- 이 파일이 decks_bundle 의 최신본이다. 앞으로 이 뷰는 여기서만 고친다.
--
-- docs/티어기준.md §4.11 §5.2

create or replace view decks_bundle as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.playstyle, d.carry_unit_id,
  d.core_unit_ids, d.levelling, d.difficulty,
  d.requires_augment, d.requires_special_item, d.qualifier_label, d.requirement_note,
  s.games, s.avg_place, s.win_rate, s.top4_rate, s.pick_rate,
  s.games_apex, s.avg_place_apex, s.games_high, s.avg_place_high,
  (select jsonb_agg(jsonb_build_object('unitId', du.unit_id, 'star', du.target_star, 'pos', case when du.pos_row is null then null else jsonb_build_array(du.pos_row, du.pos_col) end, 'core', du.is_core))
     from deck_units du where du.deck_id = d.id and du.patch_id = d.patch_id)         as units,
  (select jsonb_agg(jsonb_build_object('unitId', di.unit_id, 'itemId', di.item_id, 'role', di.role, 'priority', di.priority, 'placeDelta', di.place_delta)
            order by di.priority, di.place_delta nulls last, di.pick_rate desc)
     from deck_items di where di.deck_id = d.id and di.patch_id = d.patch_id)         as items,
  (select jsonb_object_agg(dl.level, jsonb_build_object('units', dl.unit_ids, 'avg', dl.avg_place, 'count', dl.games))
     from deck_levels dl where dl.deck_id = d.id and dl.patch_id = d.patch_id)        as levels,
  (select jsonb_agg(jsonb_build_object('id', da.augment_id, 'tier', da.tier, 'avg', da.avg_place, 'games', da.games) order by da.avg_place)
     from deck_augments da where da.deck_id = d.id and da.patch_id = d.patch_id)      as augments,
  (select jsonb_agg(jsonb_build_object('deckId', dc.against_deck_id, 'placeChange', dc.place_change))
     from deck_counters dc where dc.deck_id = d.id and dc.patch_id = d.patch_id)      as counters
from decks d
left join deck_stats s on s.patch_id = d.patch_id and s.deck_id = d.id
where d.is_published and not d.is_editorial
  and s.games >= 100
  and d.patch_id = (select id from patches where is_current);
grant select on decks_bundle to anon, authenticated, service_role;
