-- calculate_deck_tiers 최종본. 0011·0012·0014 가 같은 함수를 각자 고쳐서 실행 순서에 따라
-- 결과가 달라졌다 (0012 를 0014 뒤에 실행하면 "살아있는 덱만" 필터가 사라진다).
-- 앞으로 이 함수는 이 파일 하나에서만 고친다.
--
-- docs/티어기준.md §5 §6:
--   자격   : 살아있는 덱 + 최근 7일 30판 이상 + 평균 4.75등 미만
--   OP     : 승률·등수 모두 상위 10% + 100판 이상
--   S      : 나머지 상위 5개
--   A/B/C  : 나머지를 percent_rank 30 / 40 / 30
create or replace function calculate_deck_tiers(target_patch_id int)
returns table(deck_id text, tier_label text) as $$
with qualified as (
  select s.deck_id, s.win_rate, s.avg_place, s.games
  from deck_stats s
  join decks d on d.id = s.deck_id and d.patch_id = s.patch_id and d.is_published
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
