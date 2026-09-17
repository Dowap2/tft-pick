-- 수집기용 적재 함수. raw 스키마를 PostgREST에 노출하지 않고 service_role 만 호출.
-- m: {match_id, patch_id, game_version, queue_id, played_at}
-- ps: [{puuid, placement, level, last_round, tier, units, traits, augments}]  (units/traits/augments 는 1~4등만, 나머지 null)
create or replace function public.ingest_match(m jsonb, ps jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, raw
as $$
declare inserted boolean;
begin
  insert into raw.matches (match_id, patch_id, game_version, queue_id, played_at)
  values (m->>'match_id', (m->>'patch_id')::int, m->>'game_version', (m->>'queue_id')::int, (m->>'played_at')::timestamptz)
  on conflict (match_id) do nothing;
  get diagnostics inserted = row_count;
  if not inserted then return false; end if;   -- 이미 있는 매치

  insert into raw.participants (match_id, puuid, placement, level, last_round, tier, units, traits, augments)
  select m->>'match_id', p->>'puuid', (p->>'placement')::smallint, (p->>'level')::smallint, (p->>'last_round')::smallint,
         p->>'tier', p->'units', p->'traits',
         case when p->'augments' is null or jsonb_typeof(p->'augments') <> 'array' then '{}'::text[]
              else array(select jsonb_array_elements_text(p->'augments')) end
  from jsonb_array_elements(ps) as p
  on conflict (match_id, puuid) do nothing;
  return true;
end $$;

revoke all on function public.ingest_match(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_match(jsonb, jsonb) to service_role;

-- 수집기가 "이미 있는 매치" 를 미리 거를 수 있게 (service_role 전용)
create or replace function public.existing_match_ids(ids text[])
returns setof text
language sql
security definer
set search_path = public, raw
as $$ select match_id from raw.matches where match_id = any(ids) $$;
revoke all on function public.existing_match_ids(text[]) from public, anon, authenticated;
grant execute on function public.existing_match_ids(text[]) to service_role;

-- raw 통계 확인용 (service_role 전용)
create or replace function public.raw_stats()
returns table(matches bigint, participants bigint, latest timestamptz)
language sql
security definer
set search_path = public, raw
as $$ select (select count(*) from raw.matches), (select count(*) from raw.participants), (select max(played_at) from raw.matches) $$;
revoke all on function public.raw_stats() from public, anon, authenticated;
grant execute on function public.raw_stats() to service_role;
