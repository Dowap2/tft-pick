-- docs/티어기준.md §5 §6.3: avg_place >= 4.75 인 덱을 제외하지 않고 D 티어로 붙인다.
--
-- 그동안 4.75등은 자격 하한이어서 그런 덱이 목록에서 아예 사라졌다. "이 덱 왜 없냐" 에 답할
-- 방법이 없고, 초보가 지금 굴리고 있는 덱이 화면에 없는 게 더 나쁘다. 나쁘면 나쁘다고 보여준다.
-- 이제 제외 사유는 표본(100판) 하나뿐이다.
--
-- ★ D 는 percent_rank 모집단에서 뺀다 (§6.3 순서 0).
--   같이 세면 win_pct·place_pct 분모가 커져서 기존 OP~C 경계가 전부 밀린다 — 성적 나쁜 덱을
--   목록에 추가했다는 이유만으로 A 가 S 가 되는 일이 생긴다. 먼저 떼어내면 OP~C 는 이전과 동일하다.
--
-- decks_bundle · calculate_deck_tiers · decks_retired 세 객체가 같은 임계값을 써야 한다.
-- 어긋나면 "티어는 받았는데 목록에 없는 덱" 이 생기고 check-tiers 가 실패한다. 이 파일이 최신본이다.
-- (컬럼 구성은 0017/0018 과 같으므로 create or replace 로 충분하다.)

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
  and s.games >= 100                                  -- 제외 사유는 이것 하나뿐 (avg_place 컷 제거)
  and d.patch_id = (select id from patches where is_current);

grant select on decks_bundle to anon, authenticated, service_role;

-- 0020 의 조건도 같이 맞춘다. bundle 을 정확히 뒤집어야 한 덱이 양쪽에 나오지 않는다.
create or replace view decks_retired as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.carry_unit_id, d.levelling,
  s.games, s.avg_place, s.win_rate, s.top4_rate,
  (select jsonb_agg(jsonb_build_object('unitId', du.unit_id, 'star', du.target_star))
     from deck_units du where du.deck_id = d.id and du.patch_id = d.patch_id) as units
from decks d
left join deck_stats s on s.patch_id = d.patch_id and s.deck_id = d.id
where d.is_published
  and d.patch_id = (select id from patches where is_current)
  and coalesce(s.games, 0) < 100;                     -- 성적이 나빠서 내려가는 덱은 이제 없다 (D 를 받는다)

grant select on decks_retired to anon, authenticated, service_role;

create or replace function calculate_deck_tiers(target_patch_id int)
returns table(deck_id text, tier_label text) as $$
with eligible as (
  -- §5: 표본만 본다
  select s.deck_id, s.win_rate, s.avg_place, s.games
  from deck_stats s
  join decks d on d.id = s.deck_id and d.patch_id = s.patch_id and d.is_published
  where s.patch_id = target_patch_id and s.games >= 100
),
d_tier as (
  -- §6.3 순서 0: 기대 평균(4.5등) 이하. 절대 기준으로 정해지는 유일한 티어이고,
  -- 아래 순위 계산에서 완전히 빠진다 (그래야 OP~C 가 D 도입 전과 같다).
  select deck_id from eligible where avg_place >= 4.75
),
qualified as (
  select * from eligible where avg_place < 4.75
),
ranked as (
  select *,
    percent_rank() over (order by win_rate desc) as win_pct,
    percent_rank() over (order by avg_place asc) as place_pct
  from qualified
),
classified as (
  -- OP 의 100판 하한은 §5 가 100판인 지금 중복이지만, §5 를 낮출 경우의 안전장치로 남긴다.
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
select r.deck_id, case when r.rest_pct <= 0.30 then 'A'::text when r.rest_pct <= 0.70 then 'B' else 'C' end from remaining r
union all
select d.deck_id, 'D'::text from d_tier d;
$$ language sql stable;
