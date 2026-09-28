-- 에디터 덱(수제 덱) + 클러스터링이 덱 행을 지우지 않게 한다.
--
-- ★ 0020 을 틀린 전제로 만들었다. "cluster-decks 는 upsert 만 하고 지우지 않는다" 고 적었는데,
--   reset_decks 가 `delete from decks where patch_id = ?` 로 패치의 덱을 전부 지운다.
--   실측(2026-09-28): decks 38 = decks_bundle 27 + decks_retired 11 로 정확히 일치.
--   즉 decks 는 항상 "마지막 클러스터 출력" 이고, 클러스터가 더 이상 만들지 않는 덱은 사라진다.
--   → 0020 의 은퇴 페이지는 "표본 미달" 만 받았고, 정작 고치려던 "덱이 없어져서 404" 는 못 막았다.
--
-- 두 기능이 같은 원인을 공유한다: 에디터 덱도 3시간마다 지워지면 존재할 수 없다.
-- 그래서 삭제를 멈추고 "게시 여부" 로 바꾼다.
--
--   reset_decks(patch, keep_ids)
--     · 이번 출력에 없는 비(非)에디터 덱 → is_published = false  (행은 남는다 → 은퇴 페이지)
--     · 이번 출력에 있는 덱 → 자식 행(units/items/levels)만 비운다 (재작성 전 청소)
--     · 에디터 덱 → 건드리지 않는다
--
-- docs/티어기준.md §5.1 §5.2

alter table decks add column if not exists is_editorial boolean not null default false;
create index if not exists decks_editorial_idx on decks (patch_id) where is_editorial;

-- ---- reset_decks: 삭제 → 게시 해제 + 대상 덱의 자식만 청소 ----
drop function if exists public.reset_decks(int);
create or replace function public.reset_decks(p_patch_id int, p_keep_ids text[] default '{}')
returns void language plpgsql security definer set search_path = public as $$
begin
  -- 이번 클러스터 출력에 없는 덱은 내린다. 행과 자식은 남겨 은퇴 페이지가 마지막 모습을 보여준다.
  update decks set is_published = false
   where patch_id = p_patch_id and not is_editorial and not (id = any(p_keep_ids));

  -- 다시 쓸 덱은 자식을 비운다. 안 그러면 조합에서 빠진 유닛/아이템이 upsert 로 남는다.
  delete from deck_units  where patch_id = p_patch_id and deck_id = any(p_keep_ids);
  delete from deck_items  where patch_id = p_patch_id and deck_id = any(p_keep_ids);
  delete from deck_levels where patch_id = p_patch_id and deck_id = any(p_keep_ids);
end $$;
revoke all on function public.reset_decks(int, text[]) from public, anon, authenticated;
grant execute on function public.reset_decks(int, text[]) to service_role;

-- ---- 뷰 3종: 한 덱은 정확히 하나에만 나타난다 ----
-- 통계 덱 (티어 리스트·추천). 에디터 덱은 통계 기준을 탈 수 없으므로 뺀다.
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
  (select jsonb_agg(jsonb_build_object('id', da.augment_id, 'tier', da.tier, 'avg', da.avg_place, 'games', da.games) order by da.avg_place)
     from deck_augments da where da.deck_id = d.id and da.patch_id = d.patch_id)      as augments,
  (select jsonb_agg(jsonb_build_object('deckId', dc.against_deck_id, 'placeChange', dc.place_change))
     from deck_counters dc where dc.deck_id = d.id and dc.patch_id = d.patch_id)      as counters
from decks d
left join deck_stats s on s.patch_id = d.patch_id and s.deck_id = d.id
where d.is_published and not d.is_editorial
  and s.games >= 100
  and d.patch_id = (select id from patches where is_current);
grant select on decks_bundle to anon, authenticated, service_role;

-- 내려간 덱: 이제 두 경우를 다 받는다. (1) 클러스터가 더 이상 안 만듦 (2) 표본 100판 미만
create or replace view decks_retired as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.carry_unit_id, d.levelling,
  s.games, s.avg_place, s.win_rate, s.top4_rate,
  (select jsonb_agg(jsonb_build_object('unitId', du.unit_id, 'star', du.target_star))
     from deck_units du where du.deck_id = d.id and du.patch_id = d.patch_id) as units
from decks d
left join deck_stats s on s.patch_id = d.patch_id and s.deck_id = d.id
where not d.is_editorial
  and d.patch_id = (select id from patches where is_current)
  and (not d.is_published or coalesce(s.games, 0) < 100);
grant select on decks_retired to anon, authenticated, service_role;

-- 에디터 덱: 통계 기준을 타지 않는다. 티어도 없다.
create or replace view decks_editorial as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.playstyle, d.carry_unit_id,
  d.core_unit_ids, d.levelling, d.difficulty, d.requirement_note,
  (select jsonb_agg(jsonb_build_object('unitId', du.unit_id, 'star', du.target_star, 'pos', case when du.pos_row is null then null else jsonb_build_array(du.pos_row, du.pos_col) end, 'core', du.is_core))
     from deck_units du where du.deck_id = d.id and du.patch_id = d.patch_id)  as units,
  (select jsonb_agg(jsonb_build_object('unitId', di.unit_id, 'itemId', di.item_id, 'role', di.role, 'priority', di.priority) order by di.priority)
     from deck_items di where di.deck_id = d.id and di.patch_id = d.patch_id)  as items,
  (select jsonb_object_agg(dl.level, jsonb_build_object('units', dl.unit_ids, 'avg', null, 'count', 0))
     from deck_levels dl where dl.deck_id = d.id and dl.patch_id = d.patch_id) as levels
from decks d
where d.is_editorial and d.is_published
  and d.patch_id = (select id from patches where is_current);
grant select on decks_editorial to anon, authenticated, service_role;

-- ---- 쓰기 경로 ----------------------------------------------------------
-- service_role 키를 브라우저나 Worker 에 두지 않는다. 그 키가 새면 DB 전체가 열린다.
-- 대신 DB 안에 토큰을 두고, 그걸 검사하는 security definer 함수 하나만 anon 에 연다.
-- 피해 범위 = 이 함수가 할 수 있는 일(에디터 덱 저장) 뿐이다.
create table if not exists admin_secrets (key text primary key, value text not null);
revoke all on table admin_secrets from public, anon, authenticated;   -- 함수만 읽는다

-- 토큰 넣기 (한 번):
--   insert into admin_secrets values ('editorial_token', '<openssl rand -hex 32 결과>')
--   on conflict (key) do update set value = excluded.value;

create or replace function public.save_editorial_deck(p_token text, p_deck jsonb)
returns text language plpgsql security definer set search_path = public as $$
declare pid int; did text; expected text; ok boolean;
begin
  select value into expected from admin_secrets where key = 'editorial_token';
  -- 토큰이 없으면 잠긴 상태로 둔다 (기본값으로 열려 있으면 안 된다)
  if expected is null or p_token is null then raise exception '인증 실패'; end if;
  -- 길이 비교를 타지 않게 고정 시간 비교 흉내: 길이가 다르면 바로 실패
  if length(p_token) <> length(expected) or p_token <> expected then raise exception '인증 실패'; end if;

  select id into pid from patches where is_current;
  did := p_deck->>'id';
  -- 클러스터가 만드는 id(특성-캐리 슬러그)와 절대 겹치지 않게 접두어를 강제한다.
  -- 겹치면 에디터 덱이 통계 덱을 가리거나 그 반대가 된다.
  if did is null or did !~ '^ed-[a-z0-9-]{2,40}$' then raise exception 'id 는 ed- 로 시작하는 소문자 슬러그여야 한다: %', did; end if;

  insert into decks (id, patch_id, name, display_name, playstyle, carry_unit_id, core_unit_ids,
                     levelling, difficulty, signature, requirement_note, is_published, is_editorial)
  values (did, pid, p_deck->>'name', p_deck->>'name', p_deck->>'playstyle', p_deck->>'carryUnitId',
          array(select jsonb_array_elements_text(p_deck->'coreUnitIds')),
          p_deck->>'levelling', p_deck->>'difficulty', jsonb_build_object('editorial', true),
          p_deck->>'requirementNote', true, true)
  on conflict (id, patch_id) do update set
    name = excluded.name, display_name = excluded.display_name, playstyle = excluded.playstyle,
    carry_unit_id = excluded.carry_unit_id, core_unit_ids = excluded.core_unit_ids,
    levelling = excluded.levelling, difficulty = excluded.difficulty,
    requirement_note = excluded.requirement_note, is_published = true, is_editorial = true;

  delete from deck_units  where deck_id = did and patch_id = pid;
  delete from deck_items  where deck_id = did and patch_id = pid;
  delete from deck_levels where deck_id = did and patch_id = pid;

  insert into deck_units (deck_id, patch_id, unit_id, target_star, pos_row, pos_col, is_core)
  select did, pid, u->>'unitId', coalesce((u->>'star')::smallint, 2),
         nullif(u->'pos'->>0, '')::smallint, nullif(u->'pos'->>1, '')::smallint,
         coalesce((u->>'core')::boolean, true)
  from jsonb_array_elements(coalesce(p_deck->'units', '[]'::jsonb)) u;

  insert into deck_items (deck_id, patch_id, unit_id, item_id, role, priority)
  select did, pid, i->>'unitId', i->>'itemId', coalesce(i->>'role', 'utility')::item_role,
         coalesce((i->>'priority')::smallint, 1)
  from jsonb_array_elements(coalesce(p_deck->'items', '[]'::jsonb)) i;

  insert into deck_levels (deck_id, patch_id, level, unit_ids, avg_place, games)
  select did, pid, (kv.key)::smallint, array(select jsonb_array_elements_text(kv.value)), null, 0
  from jsonb_each(coalesce(p_deck->'levels', '{}'::jsonb)) kv;

  return did;
end $$;
revoke all on function public.save_editorial_deck(text, jsonb) from public;
grant execute on function public.save_editorial_deck(text, jsonb) to anon, authenticated, service_role;

create or replace function public.delete_editorial_deck(p_token text, p_id text)
returns boolean language plpgsql security definer set search_path = public as $$
declare expected text; n int;
begin
  select value into expected from admin_secrets where key = 'editorial_token';
  if expected is null or p_token is null or length(p_token) <> length(expected) or p_token <> expected then
    raise exception '인증 실패';
  end if;
  delete from decks where id = p_id and is_editorial       -- 통계 덱은 이 함수로 못 지운다
    and patch_id = (select id from patches where is_current);
  get diagnostics n = row_count;
  return n > 0;
end $$;
revoke all on function public.delete_editorial_deck(text, text) from public;
grant execute on function public.delete_editorial_deck(text, text) to anon, authenticated, service_role;
