-- JSON null 이 jsonb 'null' 로 저장되던 것 → SQL NULL 로 (5~8등 보드 없음 표현)
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
  if not inserted then return false; end if;

  insert into raw.participants (match_id, puuid, placement, level, last_round, tier, units, traits, augments)
  select m->>'match_id', p->>'puuid', (p->>'placement')::smallint, (p->>'level')::smallint, (p->>'last_round')::smallint,
         p->>'tier',
         nullif(p->'units', 'null'::jsonb),
         nullif(p->'traits', 'null'::jsonb),
         case when jsonb_typeof(p->'augments') <> 'array' then '{}'::text[]
              else array(select jsonb_array_elements_text(p->'augments')) end
  from jsonb_array_elements(ps) as p
  on conflict (match_id, puuid) do nothing;
  return true;
end $$;

update raw.participants set units = null where units = 'null'::jsonb;
update raw.participants set traits = null where traits = 'null'::jsonb;
