-- docs/티어기준.md v3 반영. 이 파일이 문서와 다르면 문서가 옳다.
--  §5 §6 티어 근거를 apex 표본 한정 → 챌린저~에메랄드 전체 표본으로 (목표: 전 구간에서 공통으로 먹히는 덱)
--  랭크 그룹 컬럼(games_apex 등)은 진단용으로 그대로 남긴다 — "챌에선 되는데 에메에선 안 되는 덱" 을 나중에 가려내려면 필요.

drop materialized view if exists deck_stats cascade;   -- decks_bundle 이 딸려 내려감 → 아래서 재생성

create materialized view deck_stats as
select
  pd.patch_id, pd.deck_id,
  -- §5 기준 표본: 랭크 구분 없이 전부
  count(*)                                                              as games,
  round(avg(p.placement)::numeric, 2)                                   as avg_place,
  round(avg((p.placement = 1)::int)::numeric, 4)                        as win_rate,
  round(avg((p.placement <= 4)::int)::numeric, 4)                       as top4_rate,
  round(count(*)::numeric
        / nullif((select count(*) from raw.participants rp join raw.matches rm using (match_id) where rm.patch_id = pd.patch_id), 0), 4)
                                                                        as pick_rate,
  -- 아래는 진단용 (티어 계산에 쓰지 않음). 구간별로 성적이 갈리는 덱을 찾을 때.
  count(*) filter (where m.rank_group = 'apex')                                          as games_apex,
  round((avg(p.placement) filter (where m.rank_group = 'apex'))::numeric, 2)             as avg_place_apex,
  count(*) filter (where m.rank_group = 'high')                                          as games_high,
  round((avg(p.placement) filter (where m.rank_group = 'high'))::numeric, 2)             as avg_place_high
from participant_decks pd
join raw.participants p using (match_id, puuid)
join raw.matches m on m.match_id = pd.match_id
group by pd.patch_id, pd.deck_id;
create unique index deck_stats_pk on deck_stats (patch_id, deck_id);

-- ---- §5 자격: 전체 표본 30판 이상, 평균 등수 < 4.75 ----
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

grant select on deck_stats, decks_bundle to anon, authenticated, service_role;

-- ---- §6 티어 컷: OP / S / A 30% / B 40% / C 30% (v2 와 동일, 표본만 전체로) ----
create or replace function calculate_deck_tiers(target_patch_id int)
returns table(deck_id text, tier_label text) as $$
with qualified as (
  select s.deck_id, s.win_rate, s.avg_place
  from deck_stats s
  where s.patch_id = target_patch_id and s.games >= 30 and s.avg_place < 4.75
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
