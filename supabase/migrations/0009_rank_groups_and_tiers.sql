-- docs/티어기준.md v2 반영. 이 파일이 문서와 다르면 문서가 옳다.
--  §2 랭크 그룹(apex/high) 저장
--  §5 §6 티어 근거를 apex 표본으로 한정, A/B → A/B/C
--  §3 §8 보존·갱신 주기 (pg_cron)

-- ---- §2 매치별 랭크 그룹 ----
alter table raw.matches add column if not exists rank_group text not null default 'apex'
  check (rank_group in ('apex', 'high'));   -- 기존 행은 챌/그마만 수집했으므로 apex 가 맞다

create or replace function public.ingest_match(m jsonb, ps jsonb)
returns boolean language plpgsql security definer set search_path = public, raw as $$
declare inserted boolean;
begin
  insert into raw.matches (match_id, patch_id, game_version, queue_id, played_at, rank_group)
  values (m->>'match_id', (m->>'patch_id')::int, m->>'game_version', (m->>'queue_id')::int,
          (m->>'played_at')::timestamptz, coalesce(m->>'rank_group', 'apex'))
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
revoke all on function public.ingest_match(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.ingest_match(jsonb, jsonb) to service_role;

-- ---- §5 deck_stats: 전체 표본 + apex 표본을 나란히 ----
drop materialized view if exists deck_stats cascade;   -- decks_bundle 이 딸려 내려감 → 아래서 재생성

create materialized view deck_stats as
with agg as (
  select
    pd.patch_id, pd.deck_id,
    count(*)                                                              as games_all,
    round(avg(p.placement)::numeric, 2)                                   as avg_place_all,
    round(avg((p.placement = 1)::int)::numeric, 4)                        as win_rate_all,
    round(avg((p.placement <= 4)::int)::numeric, 4)                       as top4_rate_all,
    count(*) filter (where m.rank_group = 'apex')                         as games_apex,
    round((avg(p.placement) filter (where m.rank_group = 'apex'))::numeric, 2)             as avg_place_apex,
    round((avg((p.placement = 1)::int) filter (where m.rank_group = 'apex'))::numeric, 4)  as win_rate_apex,
    round((avg((p.placement <= 4)::int) filter (where m.rank_group = 'apex'))::numeric, 4) as top4_rate_apex,
    round(count(*)::numeric
          / nullif((select count(*) from raw.participants rp join raw.matches rm using (match_id) where rm.patch_id = pd.patch_id), 0), 4)
                                                                          as pick_rate
  from participant_decks pd
  join raw.participants p using (match_id, puuid)
  join raw.matches m on m.match_id = pd.match_id
  group by pd.patch_id, pd.deck_id
)
select
  patch_id, deck_id, pick_rate,
  games_all, avg_place_all, win_rate_all, top4_rate_all,
  games_apex, avg_place_apex, win_rate_apex, top4_rate_apex,
  -- §5 기준 표본: apex 30판 이상이면 apex, 아니면 전체
  case when games_apex >= 30 then 'apex' else 'all' end                          as rank_basis,
  case when games_apex >= 30 then games_apex      else games_all      end        as games,
  case when games_apex >= 30 then avg_place_apex  else avg_place_all  end        as avg_place,
  case when games_apex >= 30 then win_rate_apex   else win_rate_all   end        as win_rate,
  case when games_apex >= 30 then top4_rate_apex  else top4_rate_all  end        as top4_rate
from agg;
create unique index deck_stats_pk on deck_stats (patch_id, deck_id);

-- ---- §5 자격: apex 30판 or 전체 60판, 기준 평균등수 < 4.75 ----
create or replace view decks_bundle as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.playstyle, d.carry_unit_id,
  d.core_unit_ids, d.levelling, d.difficulty,
  d.requires_augment, d.requires_special_item, d.qualifier_label, d.requirement_note,
  s.games, s.avg_place, s.win_rate, s.top4_rate, s.pick_rate, s.rank_basis,
  (select jsonb_agg(jsonb_build_object('unitId', du.unit_id, 'star', du.target_star, 'pos', case when du.pos_row is null then null else jsonb_build_array(du.pos_row, du.pos_col) end, 'core', du.is_core))
     from deck_units du where du.deck_id = d.id and du.patch_id = d.patch_id)         as units,
  (select jsonb_agg(jsonb_build_object('unitId', di.unit_id, 'itemId', di.item_id, 'role', di.role, 'priority', di.priority) order by di.priority)
     from deck_items di where di.deck_id = d.id and di.patch_id = d.patch_id)         as items,
  (select jsonb_object_agg(dl.level, jsonb_build_object('units', dl.unit_ids, 'avg', dl.avg_place, 'count', dl.games))
     from deck_levels dl where dl.deck_id = d.id and dl.patch_id = d.patch_id)        as levels,
  (select jsonb_agg(jsonb_build_object('deckId', dc.against_deck_id, 'placeChange', dc.place_change))
     from deck_counters dc where dc.deck_id = d.id and dc.patch_id = d.patch_id)      as counters
from decks d
left join deck_stats s on s.patch_id = d.patch_id and s.deck_id = d.id
where d.is_published
  and (s.games_apex >= 30 or s.games_all >= 60)
  and s.avg_place < 4.75
  and d.patch_id = (select id from patches where is_current);

-- 재생성했으므로 읽기 권한 다시 부여 (calculate_deck_tiers 는 security definer 가 아니라 호출자 권한으로 deck_stats 를 읽는다)
grant select on deck_stats, decks_bundle to anon, authenticated, service_role;

-- ---- §6 티어 컷: OP / S / A 30% / B 40% / C 30% ----
create or replace function calculate_deck_tiers(target_patch_id int)
returns table(deck_id text, tier_label text) as $$
with qualified as (
  select s.deck_id, s.win_rate, s.avg_place
  from deck_stats s
  where s.patch_id = target_patch_id
    and (s.games_apex >= 30 or s.games_all >= 60)
    and s.avg_place < 4.75
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
  select *, ntile(100) over (order by win_pct + place_pct asc) as pct_bucket from s_marked where s_flag is null
)
select c.deck_id, c.op_flag from classified c where c.op_flag is not null
union all
select s.deck_id, s.s_flag from s_marked s where s.s_flag is not null
union all
select r.deck_id, case when r.pct_bucket <= 30 then 'A'::text when r.pct_bucket <= 70 then 'B' else 'C' end from remaining r;
$$ language sql stable;

-- ---- §3 §8 pg_cron: 보드 24시간, 매치 7일, 통계 매시 ----
select cron.unschedule(jobid) from cron.job where jobname in ('refresh-deck-stats', 'cleanup-old-raw-matches', 'strip-old-boards');

-- 상시 수집이라 통계도 매시 갱신
select cron.schedule('refresh-deck-stats', '20 * * * *',
  $$ refresh materialized view concurrently deck_stats; refresh materialized view concurrently deck_trends; $$);

-- 용량의 대부분은 보드 jsonb. 클러스터링(3시간 주기)이 끝난 24시간 경과분은 비운다. 등수/레벨은 남으므로 통계는 그대로.
select cron.schedule('strip-old-boards', '7 * * * *',
  $$ update raw.participants set units = null, traits = null
     where units is not null
       and match_id in (select match_id from raw.matches where played_at < now() - interval '24 hours'); $$);

select cron.schedule('cleanup-old-raw-matches', '0 4 * * *',
  $$ delete from raw.matches where played_at < now() - interval '7 days'; $$);
