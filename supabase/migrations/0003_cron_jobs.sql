-- pg_cron 활성화 (원격에 미설치 상태였음). 실패하면 대시보드 Database > Extensions 에서 켠 뒤 재실행.
create extension if not exists pg_cron;
grant usage on schema cron to postgres;

-- 매일 02:00 — 정제/클러스터링 결과 반영은 외부 스크립트가 담당하므로 여기서는 트리거만
-- (클러스터링 자체는 별도 서비스에서 실행 후 decks/participant_decks를 직접 upsert함)

-- 매일 03:00 — 통계 뷰 리프레시
select cron.schedule(
  'refresh-deck-stats',
  '0 3 * * *',
  $$ refresh materialized view concurrently deck_stats; refresh materialized view concurrently deck_trends; $$
);

-- 매일 04:00 — 7일 지난 raw 데이터 삭제
select cron.schedule(
  'cleanup-old-raw-matches',
  '0 4 * * *',
  $$ delete from raw.matches where played_at < now() - interval '7 days'; $$
);
