-- 내려간 덱의 URL 을 살려둔다.
--
-- 덱 id 는 (최고특성 + 캐리 + 레벨링) 에서 나온다 (docs/티어기준.md §4.7·§4.8). 수집 주기마다
-- 클러스터링이 다시 돌고, 자격(§5: games >= 100, avg_place < 4.75) 에서 떨어지면 decks_bundle
-- 에서 사라진다. output: export 라 그 URL 은 다음 배포에서 하드 404 가 된다.
-- 실측: 배포본 22개 중 6개가 몇 시간 만에 교체됐다 (27%).
--
-- /deck/* 는 사이트에서 본문이 가장 긴 페이지인데(중앙값 1,090자) URL 이 안 살아남아서
-- 색인을 쌓을 수 없었다. cluster-decks 는 upsert 만 하고 지우지 않으므로 decks 행은 남아 있다 —
-- 새로 저장할 건 없고, 자격에서 떨어진 덱을 읽을 창구만 없었다.
--
-- 티어 기준은 건드리지 않는다. 이 뷰의 덱은 티어 리스트에도, 추천에도, 사이트맵에도 안 나온다.
-- 예전 링크로 들어온 사람에게 404 대신 "내려갔다 + 마지막 성적" 을 보여주는 용도다.
-- 같은 특성+캐리 조합이 다시 올라오면 id 가 같으므로 그 페이지가 그대로 되살아난다.

create or replace view decks_retired as
select
  d.patch_id, d.id, coalesce(d.display_name, d.name) as name, d.carry_unit_id, d.levelling,
  s.games, s.avg_place, s.win_rate, s.top4_rate,
  (select jsonb_agg(jsonb_build_object('unitId', du.unit_id, 'star', du.target_star))
     from deck_units du where du.deck_id = d.id and du.patch_id = d.patch_id) as units
from decks d
left join deck_stats s on s.patch_id = d.patch_id and s.deck_id = d.id
where d.is_published
  and d.patch_id = (select id from patches where is_current)
  -- decks_bundle(0018) 의 조건을 정확히 뒤집는다. 한쪽에만 나타나야 하고 둘 다에 나오면 안 된다.
  and not (coalesce(s.games, 0) >= 100 and coalesce(s.avg_place, 9) < 4.75);

grant select on decks_retired to anon, authenticated, service_role;
