-- docs/티어기준.md §3 반영: 보드 보존 24시간 → 72시간.
-- 24시간은 "하루 14,000판" 을 전제로 정한 값이다. 실제 수집이 그에 못 미치는 동안은
-- 클러스터링 표본이 말라버린다 (실측: 보드 7,184개 → 444개, 덱 53개 → 7개).
-- 수집이 설계 물량에 도달하면 24시간으로 되돌릴 것 — 72시간 × 14,000판이면 무료 500MB 를 넘는다.
select cron.unschedule(jobid) from cron.job where jobname = 'strip-old-boards';
select cron.schedule('strip-old-boards', '7 * * * *',
  $$ update raw.participants set units = null, traits = null
     where units is not null
       and match_id in (select match_id from raw.matches where played_at < now() - interval '72 hours'); $$);
