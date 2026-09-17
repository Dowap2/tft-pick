-- =========================================================
-- 0. 패치
-- =========================================================
create table patches (
  id          serial primary key,
  set_number  int  not null,
  version     text not null,
  label       text,
  is_current  boolean not null default false,
  started_at  date,
  created_at  timestamptz not null default now(),
  unique (set_number, version)
);
create unique index patches_one_current on patches (is_current) where is_current;

-- =========================================================
-- 1. 마스터 데이터
-- =========================================================
create table traits (
  id          text not null,
  patch_id    int  not null references patches(id) on delete cascade,
  name        text not null,
  img         text,
  breakpoints int[] not null default '{}',
  primary key (id, patch_id)
);

create table units (
  id          text not null,
  patch_id    int  not null references patches(id) on delete cascade,
  api_name    text not null,
  name        text not null,
  cost        smallint not null check (cost between 1 and 5),
  img         text,
  planner_code text,
  primary key (id, patch_id)
);

create table unit_traits (
  unit_id   text not null,
  trait_id  text not null,
  patch_id  int  not null,
  primary key (unit_id, trait_id, patch_id),
  foreign key (unit_id, patch_id)  references units(id, patch_id)  on delete cascade,
  foreign key (trait_id, patch_id) references traits(id, patch_id) on delete cascade
);

create type item_kind as enum ('component', 'completed', 'emblem', 'artifact', 'radiant', 'support');

create table items (
  id              text not null,
  patch_id        int  not null references patches(id) on delete cascade,
  api_name        text not null,
  name            text not null,
  kind            item_kind not null,
  recipe          text[],
  img             text,
  granted_trait_id text,              -- 엠블럼류만 채움 (예: '기원자 상징' → 'Origin')
  primary key (id, patch_id)
);

-- =========================================================
-- 2. 원천 데이터 (Riot Match-V5)
-- =========================================================
create schema raw;

create table raw.matches (
  match_id     text primary key,
  patch_id     int  not null references patches(id),
  game_version text not null,
  queue_id     int  not null,
  played_at    timestamptz not null,
  fetched_at   timestamptz not null default now()
);

create table raw.participants (
  match_id     text not null references raw.matches(match_id) on delete cascade,
  puuid        text not null,
  placement    smallint not null check (placement between 1 and 8),
  level        smallint not null,
  last_round   smallint,
  tier         text,
  units        jsonb,               -- 1~4등만 채움. 5~8등은 NULL
  traits       jsonb,               -- 1~4등만 채움. 5~8등은 NULL
  augments     text[] default '{}', -- 1~4등만 채움
  primary key (match_id, puuid)
);
create index participants_patch_idx on raw.participants (match_id);

-- =========================================================
-- 3. 정제 결과: 덱
-- =========================================================
create table decks (
  id                    text not null,
  patch_id              int  not null references patches(id) on delete cascade,
  name                  text not null,
  display_name          text,
  playstyle             text,
  carry_unit_id         text not null,
  core_unit_ids         text[] not null,        -- 정확히 3~4개, 필수 매칭 대상 (하드 게이트)
  levelling             text,
  difficulty            text,
  signature             jsonb not null,
  requires_augment      text[] default '{}',    -- 특정 증강 필요 시
  requires_special_item text[] default '{}',    -- 찬란한 아이템/특성 아이템 필요 시
  qualifier_label       text,                   -- 예: '기원자' — 덱 이름 접두어
  requirement_note       text,                  -- 예: '기원자 상징이 있어야 완성되는 덱입니다'
  is_published          boolean not null default true,
  primary key (id, patch_id),
  foreign key (carry_unit_id, patch_id) references units(id, patch_id)
);

create table deck_units (
  deck_id     text not null,
  patch_id    int  not null,
  unit_id     text not null,
  target_star smallint not null default 2 check (target_star between 1 and 3),
  -- 규칙: 1~3코 메인 캐리 = 3, 4~5코 유닛 = 2로 캡(3성 나와도 통계상 2), 그 외 = 2
  pos_row     smallint check (pos_row between 0 and 3),
  pos_col     smallint check (pos_col between 0 and 6),
  is_core     boolean not null default true,
  primary key (deck_id, patch_id, unit_id),
  foreign key (deck_id, patch_id) references decks(id, patch_id) on delete cascade,
  foreign key (unit_id, patch_id) references units(id, patch_id)
);

create type item_role as enum ('carry_core', 'carry_flex', 'tank', 'utility');
create table deck_items (
  deck_id   text not null,
  patch_id  int  not null,
  unit_id   text not null,
  item_id   text not null,
  role      item_role not null,
  priority  smallint not null default 1,
  pick_rate numeric(5,4),
  primary key (deck_id, patch_id, unit_id, item_id),
  foreign key (deck_id, patch_id) references decks(id, patch_id) on delete cascade,
  foreign key (item_id, patch_id) references items(id, patch_id)
);

create table deck_levels (
  deck_id   text not null,
  patch_id  int  not null,
  level     smallint not null check (level between 3 and 11),
  unit_ids  text[] not null,
  avg_place numeric(4,2),
  games     int not null default 0,
  primary key (deck_id, patch_id, level),
  foreign key (deck_id, patch_id) references decks(id, patch_id) on delete cascade
);

create table deck_augments (
  deck_id text not null, patch_id int not null, augment_id text not null,
  tier text not null,
  avg_place numeric(4,2), games int,
  primary key (deck_id, patch_id, augment_id),
  foreign key (deck_id, patch_id) references decks(id, patch_id) on delete cascade
);

create table deck_counters (
  deck_id text not null, patch_id int not null, against_deck_id text not null,
  place_change numeric(4,2) not null,
  primary key (deck_id, patch_id, against_deck_id),
  foreign key (deck_id, patch_id) references decks(id, patch_id) on delete cascade
);

create table participant_decks (
  match_id  text not null,
  puuid     text not null,
  patch_id  int  not null,
  deck_id   text not null,
  distance  real not null,
  primary key (match_id, puuid),
  foreign key (match_id, puuid) references raw.participants(match_id, puuid) on delete cascade,
  foreign key (deck_id, patch_id) references decks(id, patch_id) on delete cascade
);
create index participant_decks_deck_idx on participant_decks (patch_id, deck_id);

-- =========================================================
-- 4. 집계 (머티리얼라이즈드 뷰)
-- =========================================================
create materialized view deck_stats as
select
  pd.patch_id,
  pd.deck_id,
  count(*)                                             as games,
  round(avg(p.placement)::numeric, 2)                  as avg_place,
  round(avg((p.placement = 1)::int)::numeric, 4)       as win_rate,
  round(avg((p.placement <= 4)::int)::numeric, 4)      as top4_rate,
  round(count(*)::numeric
        / nullif((select count(*) from raw.participants rp join raw.matches rm using (match_id) where rm.patch_id = pd.patch_id), 0), 4)
                                                       as pick_rate
from participant_decks pd
join raw.participants p using (match_id, puuid)
group by pd.patch_id, pd.deck_id;
create unique index deck_stats_pk on deck_stats (patch_id, deck_id);

create materialized view deck_trends as
select pd.patch_id, pd.deck_id, date_trunc('day', m.played_at)::date as day,
       count(*) as games, round(avg(p.placement)::numeric, 2) as avg_place
from participant_decks pd
join raw.participants p using (match_id, puuid)
join raw.matches m using (match_id)
group by 1, 2, 3;
create unique index deck_trends_pk on deck_trends (patch_id, deck_id, day);

-- 티어 라벨은 별도 컬럼/함수로 계산 (아래 3번 섹션 참고). 여기서는 통계만.

-- 서빙용 번들 뷰
create view decks_bundle as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.playstyle, d.carry_unit_id,
  d.core_unit_ids, d.levelling, d.difficulty,
  d.requires_augment, d.requires_special_item, d.qualifier_label, d.requirement_note,
  s.games, s.avg_place, s.win_rate, s.top4_rate, s.pick_rate,
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
  and s.games >= 200
  and s.avg_place < 4.75
  and d.patch_id = (select id from patches where is_current);

-- =========================================================
-- 5. RLS: 공개 읽기, 쓰기는 service role만
-- =========================================================
alter table decks enable row level security;
create policy "public read decks" on decks for select using (true);
alter table units enable row level security;
create policy "public read units" on units for select using (true);
alter table items enable row level security;
create policy "public read items" on items for select using (true);
alter table traits enable row level security;
create policy "public read traits" on traits for select using (true);
alter table deck_units enable row level security;
create policy "public read deck_units" on deck_units for select using (true);
alter table deck_items enable row level security;
create policy "public read deck_items" on deck_items for select using (true);
alter table deck_levels enable row level security;
create policy "public read deck_levels" on deck_levels for select using (true);
alter table patches enable row level security;
create policy "public read patches" on patches for select using (true);
-- raw.* 는 RLS 정책 없이 service role 전용으로 둔다 (기본적으로 비공개)
