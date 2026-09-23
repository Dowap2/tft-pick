-- docs/티어기준.md §5: 자격 표본 30판 → 100판.
-- 30판은 수집이 하루 800판이던 시절의 값이다. 지금은 하루 4만 판이 들어오고
-- 상위 덱은 300~3,000판이라, 30판짜리가 1,447판짜리와 같은 줄에 서는 게 말이 안 된다.
-- (실측: 32판 평균 2.28등 덱이 S 최상단을 차지한 적이 있다 — 운의 영역)
--
-- decks_bundle 과 calculate_deck_tiers 는 반드시 같은 임계값을 써야 한다.
-- 둘이 어긋나면 "티어는 받았는데 목록에 없는 덱"이 생기고 check-tiers 가 실패한다.
-- 이 파일이 두 객체의 최신본이다 (0014·0015 를 대체).

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
  (select jsonb_agg(jsonb_build_object('deckId', dc.against_deck_id, 'placeChange', dc.place_change))
     from deck_counters dc where dc.deck_id = d.id and dc.patch_id = d.patch_id)      as counters
from decks d
left join deck_stats s on s.patch_id = d.patch_id and s.deck_id = d.id
where d.is_published
  and s.games >= 100
  and s.avg_place < 4.75
  and d.patch_id = (select id from patches where is_current);

grant select on decks_bundle to anon, authenticated, service_role;

create or replace function calculate_deck_tiers(target_patch_id int)
returns table(deck_id text, tier_label text) as $$
with qualified as (
  select s.deck_id, s.win_rate, s.avg_place, s.games
  from deck_stats s
  join decks d on d.id = s.deck_id and d.patch_id = s.patch_id and d.is_published
  where s.patch_id = target_patch_id and s.games >= 100 and s.avg_place < 4.75
),
ranked as (
  select *,
    percent_rank() over (order by win_rate desc) as win_pct,
    percent_rank() over (order by avg_place asc) as place_pct
  from qualified
),
classified as (
  -- OP 의 100판 하한은 §5 가 100판이 된 지금 사실상 중복이다.
  -- §5 를 다시 낮출 경우를 대비한 안전장치로 남겨 둔다.
  select *, case when win_pct <= 0.10 and place_pct <= 0.10 and games >= 100 then 'OP'::text end as op_flag from ranked
),
non_op as (
  select *, row_number() over (order by win_pct + place_pct asc) as rn from classified where op_flag is null
),
s_marked as (
  select *, case when rn <= 5 then 'S'::text end as s_flag from non_op
),
remaining as (
  select *, percent_rank() over (order by win_pct + place_pct asc) as rest_pct from s_marked where s_flag is null
)
select c.deck_id, c.op_flag from classified c where c.op_flag is not null
union all
select s.deck_id, s.s_flag from s_marked s where s.s_flag is not null
union all
select r.deck_id, case when r.rest_pct <= 0.30 then 'A'::text when r.rest_pct <= 0.70 then 'B' else 'C' end from remaining r;
$$ language sql stable;
