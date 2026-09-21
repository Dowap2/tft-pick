-- docs/티어기준.md §6.3 반영: OP 에만 표본 하한 100판.
-- 자격 하한(30판)을 겨우 넘긴 덱이 평균 2.8등을 찍고 227판짜리 검증된 덱 위에 서는 걸 막는다.
-- 100판 미만인데 성적이 좋은 덱은 OP 를 건너뛰고 S 후보로 내려간다 (탈락이 아니라 강등).
create or replace function calculate_deck_tiers(target_patch_id int)
returns table(deck_id text, tier_label text) as $$
with qualified as (
  select s.deck_id, s.win_rate, s.avg_place, s.games
  from deck_stats s
  where s.patch_id = target_patch_id and s.games >= 30 and s.avg_place < 4.75
),
ranked as (
  select *,
    percent_rank() over (order by win_rate desc) as win_pct,
    percent_rank() over (order by avg_place asc) as place_pct
  from qualified
),
classified as (
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
