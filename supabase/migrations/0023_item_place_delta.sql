-- 덱 추천 아이템을 빈도순에서 성적순으로 (docs/티어기준.md §4.11).
--
-- 실측(2026-09-29, 애쉬 캐리 덱 · 애쉬 인스턴스 171개 · 전체 평균 4.15등):
--   최후의 속삭임   64판  3.61등  (-0.54)  ← 가장 좋은데 3순위로 표시됐다
--   태양불꽃 망토   93판  3.87등  (-0.28)
--   쇼진의 창     112판  3.94등  (-0.21)  ← 빈도 1위라 1순위로 올라갔다
-- 빈도순으로 매기니 셋 중 가장 나쁜 아이템이 1순위가 됐다. §4.9 가 증강을 이미
-- "덱 평균 대비 delta" 로 재는데 아이템만 빈도를 보고 있었다.
--
-- place_delta = (그 아이템을 낀 판의 평균 등수) − (그 유닛 인스턴스 전체의 평균 등수)
-- 음수일수록 좋다. 표본 10판 미만은 노이즈라 null 로 두고 빈도순 뒤로 보낸다.

alter table deck_items add column if not exists place_delta numeric(4,2);
comment on column deck_items.place_delta is '그 아이템을 낀 판의 평균 등수 − 그 유닛 전체 평균 등수. 음수=좋음. 표본 10판 미만은 null';

-- 뷰에서 순서를 못 박는다. 지금은 삽입 순서를 따라 우연히 성적순으로 나오는데,
-- 같은 priority 안의 순서는 SQL 이 보장하지 않는다. place_delta 로 명시한다.
-- (컬럼 구성은 그대로 — items jsonb 안에 delta 를 하나 더 넣을 뿐이다)
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
