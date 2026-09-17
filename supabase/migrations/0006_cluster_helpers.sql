-- 정제(클러스터링) 스크립트용 helper. 전부 service_role 전용.

-- 현재 패치의 1~4등 보드 (units/traits 있는 행만)
create or replace function public.raw_boards(p_patch_id int)
returns table(match_id text, puuid text, placement smallint, level smallint, units jsonb, traits jsonb)
language sql security definer set search_path = public, raw as $$
  select p.match_id, p.puuid, p.placement, p.level, p.units, p.traits
  from raw.participants p join raw.matches m using (match_id)
  where m.patch_id = p_patch_id and p.units is not null
$$;
revoke all on function public.raw_boards(int) from public, anon, authenticated;
grant execute on function public.raw_boards(int) to service_role;

-- 클러스터 결과 반영 전 해당 패치 덱 초기화 (participant_decks 는 cascade)
create or replace function public.reset_decks(p_patch_id int)
returns void language sql security definer set search_path = public as $$
  delete from decks where patch_id = p_patch_id
$$;
revoke all on function public.reset_decks(int) from public, anon, authenticated;
grant execute on function public.reset_decks(int) to service_role;

-- participant_decks 일괄 적재 (rows: [{match_id, puuid, deck_id, distance}])
create or replace function public.ingest_participant_decks(p_patch_id int, rows jsonb)
returns int language plpgsql security definer set search_path = public, raw as $$
declare n int;
begin
  insert into participant_decks (match_id, puuid, patch_id, deck_id, distance)
  select r->>'match_id', r->>'puuid', p_patch_id, r->>'deck_id', (r->>'distance')::real
  from jsonb_array_elements(rows) r
  on conflict (match_id, puuid) do update set deck_id = excluded.deck_id, distance = excluded.distance;
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.ingest_participant_decks(int, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_participant_decks(int, jsonb) to service_role;

-- 통계 뷰 리프레시 (pg_cron 외에 수동 트리거)
create or replace function public.refresh_deck_stats()
returns void language sql security definer set search_path = public as $$
  refresh materialized view concurrently deck_stats;
  refresh materialized view concurrently deck_trends;
$$;
revoke all on function public.refresh_deck_stats() from public, anon, authenticated;
grant execute on function public.refresh_deck_stats() to service_role;

-- deck_stats 를 API/service_role 이 읽을 수 있게 (머티리얼라이즈드 뷰는 RLS 대상 아님 → grant 로)
grant select on deck_stats, deck_trends to anon, authenticated, service_role;
