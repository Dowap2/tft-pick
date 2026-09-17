-- 티어 함수 자격 조건도 decks_bundle 과 같이 30판으로 (0007 참고)
-- 덱 티어 라벨(OP/S/A/B) 계산. deck_stats 기반, 현재 패치 덱만.
-- ★ 튜닝 가능한 값 (초기값):
--   자격 조건   : games >= 30, avg_place < 4.75  (decks_bundle 과 동일 임계값)
--   OP          : 승률·평균등수 모두 상위 10% (win_pct <= 0.10 and place_pct <= 0.10)
--   S           : OP 제외 후 (win_pct + place_pct) 상위 5개 (rn <= 5)
--   A / B 비율  : 나머지를 백분위 40:60 으로 (pct_bucket <= 40 → 'A')
create or replace function calculate_deck_tiers(target_patch_id int)
returns table(deck_id text, tier_label text) as $$
with qualified as (
  select * from deck_stats
  where patch_id = target_patch_id and games >= 30 and avg_place < 4.75
),
ranked as (
  select *,
    percent_rank() over (order by win_rate desc) as win_pct,
    percent_rank() over (order by avg_place asc)  as place_pct
  from qualified
),
classified as (
  select *,
    case when win_pct <= 0.10 and place_pct <= 0.10 then 'OP' else null end as op_flag
  from ranked
),
non_op as (
  select *, row_number() over (order by win_pct + place_pct asc) as rn
  from classified where op_flag is null
),
s_marked as (
  select *, case when rn <= 5 then 'S' else null end as s_flag
  from non_op
),
remaining as (
  select *, ntile(100) over (order by win_pct + place_pct asc) as pct_bucket
  from s_marked where s_flag is null
)
select c.deck_id, c.op_flag as tier_label from classified c where c.op_flag is not null
union all
select s.deck_id, s.s_flag from s_marked s where s.s_flag is not null
union all
select r.deck_id, case when r.pct_bucket <= 40 then 'A' else 'B' end from remaining r;
$$ language sql stable;
