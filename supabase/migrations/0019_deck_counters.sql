-- docs/티어기준.md §4.10: 덱 상성(카운터)을 우리 데이터로 계산한다.
--
-- participant_decks 에 한 매치의 8명이 어떤 덱을 굴렸는지 다 들어 있는데
-- deck_counters 는 0행이었다 (테이블도 UI 도 있는데 계산만 없었다).
--
-- 정의: place_change = (상대 덱 B 가 같은 로비에 있던 판에서 A 의 평균 등수) − (A 의 전체 평균 등수)
--       양수 = 그 덱을 만나면 내 등수가 나빠진다(불리), 음수 = 유리.
create or replace function public.compute_deck_counters(p_patch_id int, p_min_games int default 30)
returns int language plpgsql security definer set search_path = public, raw as $$
declare n int;
begin
  delete from deck_counters where patch_id = p_patch_id;

  with mine as (
    select pd.deck_id, pd.match_id, pd.puuid, p.placement
    from participant_decks pd
    join raw.participants p using (match_id, puuid)
    where pd.patch_id = p_patch_id
  ),
  base as (
    select deck_id, avg(placement) as avg_all from mine group by 1
  ),
  pairs as (
    select a.deck_id, b.deck_id as against_deck_id,
           avg(a.placement) as avg_with, count(*) as games
    from mine a
    join mine b on b.match_id = a.match_id and b.puuid <> a.puuid and b.deck_id <> a.deck_id
    group by 1, 2
  )
  insert into deck_counters (deck_id, patch_id, against_deck_id, place_change)
  select p.deck_id, p_patch_id, p.against_deck_id, round((p.avg_with - b.avg_all)::numeric, 2)
  from pairs p
  join base b on b.deck_id = p.deck_id
  where p.games >= p_min_games
    and exists (select 1 from decks d where d.id = p.deck_id and d.patch_id = p_patch_id)
    and exists (select 1 from decks d where d.id = p.against_deck_id and d.patch_id = p_patch_id)
    and abs(p.avg_with - b.avg_all) >= 0.15;   -- 노이즈 컷: 0.15등 미만 차이는 의미 없다

  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.compute_deck_counters(int, int) from public, anon, authenticated;
grant execute on function public.compute_deck_counters(int, int) to service_role;
