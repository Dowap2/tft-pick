-- docs/티어기준.md v4 §3 §5 반영: 통계 표본을 보드 보존 기간에서 떼어낸다.
--
-- 문제: cluster-decks 가 매번 reset_decks 로 전부 지우고 남아있는 보드로 다시 만든다.
--       그래서 "통계 표본 = 보드 보존 기간" 이었고, 보드는 용량의 95% 를 먹는다.
--       표본을 키우려면 용량이 터지고, 용량을 아끼려면 표본이 말랐다 (실측: 보드 7,184 → 444개).
--
-- 해결: 클러스터링할 때마다 덱별·시간별 집계(판수·등수합·1등수·top4수)를 누적 테이블에 박는다.
--       보드 원본은 6시간만 들고 있어도 되고, 통계는 7일치가 된다.
--       버킷 1행 ≈ 60바이트, 53덱 × 24시간 × 7일 ≈ 9천 행. 보드 한 시간치보다 작다.

create table if not exists deck_stat_buckets (
  patch_id       int  not null references patches(id) on delete cascade,
  deck_id        text not null,   -- decks(id) 를 참조하지 않는다: reset_decks 가 덱을 지울 때 누적이 같이 날아가면 안 된다
  hour           timestamptz not null,
  games          int  not null,
  place_sum      int  not null,
  wins           int  not null,
  top4           int  not null,
  games_apex     int  not null default 0,
  place_sum_apex int  not null default 0,
  games_high     int  not null default 0,
  place_sum_high int  not null default 0,
  primary key (patch_id, deck_id, hour)
);
create index if not exists deck_stat_buckets_hour_idx on deck_stat_buckets (hour);

-- 클러스터링 직후 호출. 같은 시간대를 여러 번 다시 계산해도 안전하도록 "판수가 늘었을 때만 덮어쓴다".
-- (수집 창이 겹쳐 돌기 때문에, 이미 꽉 찬 시간대를 부분 집계로 덮어쓰면 표본이 줄어든다)
create or replace function public.roll_up_stats(p_patch_id int)
returns int language plpgsql security definer set search_path = public, raw as $$
declare n int;
begin
  insert into deck_stat_buckets as b
    (patch_id, deck_id, hour, games, place_sum, wins, top4, games_apex, place_sum_apex, games_high, place_sum_high)
  select pd.patch_id, pd.deck_id, date_trunc('hour', m.played_at),
         count(*), sum(p.placement),
         count(*) filter (where p.placement = 1),
         count(*) filter (where p.placement <= 4),
         count(*) filter (where m.rank_group = 'apex'),
         coalesce(sum(p.placement) filter (where m.rank_group = 'apex'), 0),
         count(*) filter (where m.rank_group = 'high'),
         coalesce(sum(p.placement) filter (where m.rank_group = 'high'), 0)
  from participant_decks pd
  join raw.participants p using (match_id, puuid)
  join raw.matches m on m.match_id = pd.match_id
  where pd.patch_id = p_patch_id
  group by 1, 2, 3
  on conflict (patch_id, deck_id, hour) do update
    set games = excluded.games, place_sum = excluded.place_sum, wins = excluded.wins, top4 = excluded.top4,
        games_apex = excluded.games_apex, place_sum_apex = excluded.place_sum_apex,
        games_high = excluded.games_high, place_sum_high = excluded.place_sum_high
    where excluded.games > b.games;
  get diagnostics n = row_count;

  -- 픽률 분모: 그 시각 전체 참가자 수 (덱에 배정 안 된 보드 포함). deck_id = '*' 센티넬 행.
  insert into deck_stat_buckets as b (patch_id, deck_id, hour, games, place_sum, wins, top4)
  select m.patch_id, '*', date_trunc('hour', m.played_at), count(*), 0, 0, 0
  from raw.participants p join raw.matches m using (match_id)
  where m.patch_id = p_patch_id
  group by 1, 2, 3
  on conflict (patch_id, deck_id, hour) do update
    set games = excluded.games where excluded.games > b.games;
  return n;
end $$;
revoke all on function public.roll_up_stats(int) from public, anon, authenticated;
grant execute on function public.roll_up_stats(int) to service_role;

-- ---- deck_stats: 머티리얼라이즈드 뷰 → 버킷 위의 일반 뷰 (리프레시가 필요 없어진다) ----
drop materialized view if exists deck_stats cascade;   -- decks_bundle 이 딸려 내려감 → 아래서 재생성
drop materialized view if exists deck_trends cascade;

create view deck_stats as
with win as (select * from deck_stat_buckets where hour > now() - interval '7 days'),
     tot as (select patch_id, sum(games) as g from win where deck_id = '*' group by 1)
select
  b.patch_id, b.deck_id,
  sum(b.games)                                                                as games,
  round(sum(b.place_sum)::numeric / nullif(sum(b.games), 0), 2)               as avg_place,
  round(sum(b.wins)::numeric      / nullif(sum(b.games), 0), 4)               as win_rate,
  round(sum(b.top4)::numeric      / nullif(sum(b.games), 0), 4)               as top4_rate,
  round(sum(b.games)::numeric / nullif((select g from tot where tot.patch_id = b.patch_id), 0), 4) as pick_rate,
  sum(b.games_apex)                                                           as games_apex,
  round(sum(b.place_sum_apex)::numeric / nullif(sum(b.games_apex), 0), 2)     as avg_place_apex,
  sum(b.games_high)                                                           as games_high,
  round(sum(b.place_sum_high)::numeric / nullif(sum(b.games_high), 0), 2)     as avg_place_high
from win b
where b.deck_id <> '*'
group by b.patch_id, b.deck_id;

create view deck_trends as
select patch_id, deck_id, (hour at time zone 'UTC')::date as day,
       sum(games) as games, round(sum(place_sum)::numeric / nullif(sum(games), 0), 2) as avg_place
from deck_stat_buckets
where deck_id <> '*'
group by 1, 2, 3;

-- ---- decks_bundle 재생성 (0010 과 동일, deck_stats 가 뷰로 바뀌었을 뿐) ----
create or replace view decks_bundle as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.playstyle, d.carry_unit_id,
  d.core_unit_ids, d.levelling, d.difficulty,
  d.requires_augment, d.requires_special_item, d.qualifier_label, d.requirement_note,
  s.games, s.avg_place, s.win_rate, s.top4_rate, s.pick_rate,
  s.games_apex, s.avg_place_apex, s.games_high, s.avg_place_high,
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
  and s.games >= 30
  and s.avg_place < 4.75
  and d.patch_id = (select id from patches where is_current);

grant select on deck_stats, deck_trends, decks_bundle to anon, authenticated, service_role;

-- 뷰는 리프레시 대상이 아니다. 기존 호출부(cluster-decks, cron)가 깨지지 않도록 no-op 으로 남긴다.
create or replace function public.refresh_deck_stats()
returns void language plpgsql security definer set search_path = public as $$ begin end $$;

-- 버킷은 덱이 사라져도 8일간 남는다 → 이미 없어진 덱이 티어(특히 개수 고정인 S)를 차지하지 않도록
-- 살아있는 덱만 대상으로. 나머지 컷은 0012 와 동일.
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

-- ---- 기존 데이터로 버킷 1회 채우기 (적용 직후 사이트가 빈 통계로 떨어지지 않게) ----
select public.roll_up_stats(id) from patches where is_current;

-- ---- cron: 보드 6시간, 매치 24시간, 버킷 8일, 리프레시 잡 제거 ----
select cron.unschedule(jobid) from cron.job
 where jobname in ('refresh-deck-stats', 'strip-old-boards', 'cleanup-old-raw-matches', 'prune-stat-buckets');

-- 보드 원본: 클러스터링(3시간)이 두 번 볼 수 있으면 충분. 이제 통계는 버킷에 남으므로 오래 들고 있을 이유가 없다.
select cron.schedule('strip-old-boards', '7 * * * *',
  $$ update raw.participants set units = null, traits = null
     where units is not null
       and match_id in (select match_id from raw.matches where played_at < now() - interval '6 hours'); $$);

-- 등수/레벨 행도 버킷에 집계된 뒤엔 쓸모가 없다 (7일 보관은 아무데도 안 쓰이고 있었다).
select cron.schedule('cleanup-old-raw-matches', '37 * * * *',
  $$ delete from raw.matches where played_at < now() - interval '24 hours'; $$);

select cron.schedule('prune-stat-buckets', '47 4 * * *',
  $$ delete from deck_stat_buckets where hour < now() - interval '8 days'; $$);
