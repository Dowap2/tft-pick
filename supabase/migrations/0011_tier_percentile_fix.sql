-- docs/티어기준.md §6 반영. ntile(100) 은 행이 100개 미만이면 각 행에 버킷 1,2,3… 을 하나씩 준다.
-- 자격 덱이 27개(= 나머지 21개)인 현실에서는 전부 pct_bucket ≤ 30 → 전원 A, B·C 는 영원히 0개였다.
-- 비율로 자르려면 percent_rank 를 써야 한다 (행 수와 무관하게 0.0 = 1등 … 1.0 = 꼴찌).
create or replace function calculate_deck_tiers(target_patch_id int)
returns table(deck_id text, tier_label text) as $$
with qualified as (
  select s.deck_id, s.win_rate, s.avg_place
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
  select *, case when win_pct <= 0.10 and place_pct <= 0.10 then 'OP'::text end as op_flag from ranked
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
