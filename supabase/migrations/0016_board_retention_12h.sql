-- docs/티어기준.md §3: 보드 보존 6시간 → 12시간.
-- 6시간은 클러스터링(3시간 주기) 2회분이라 잡 하나만 걸러도 표본이 마른다.
-- 실제로 Riot 키 만료로 수집이 멈추자 보드가 3,464개까지 내려갔다.
-- GitHub 스케줄은 지연·스킵이 흔하므로 잡 4회분(12시간)을 여유로 둔다.
-- 용량: 실측 1,600판/시간 × 12h × 12.8KB ≈ 246MB (무료 500MB 안쪽).
select cron.unschedule(jobid) from cron.job where jobname = 'strip-old-boards';
select cron.schedule('strip-old-boards', '7 * * * *',
  $$ update raw.participants set units = null, traits = null
     where units is not null
       and match_id in (select match_id from raw.matches where played_at < now() - interval '12 hours'); $$);

-- 매치 행도 보드보다 먼저 사라지면 안 된다 (raw_boards 가 조인한다).
select cron.unschedule(jobid) from cron.job where jobname = 'cleanup-old-raw-matches';
select cron.schedule('cleanup-old-raw-matches', '37 * * * *',
  $$ delete from raw.matches where played_at < now() - interval '36 hours'; $$);
