# TFT PICK

지금 가진 아이템·유닛을 입력하면 갈 수 있는 롤토체스 덱 3개를 추천합니다. (Set 18)

```bash
npm run dev          # Next 정적 사이트 개발 서버 http://localhost:3000
npm run dev:api      # /api/recommend Worker (wrangler dev, :8787) — Node 22 (nvm use). .dev.vars 에 Supabase 키
npm run build:cf     # next build (output: export → out/)
npm run preview:cf   # wrangler dev — out/ + Worker 를 프로덕션과 같은 방식으로
npm run deploy:cf    # wrangler deploy

npm run sync         # 유닛/아이템/특성 (CommunityDragon → lib/gen)
node --env-file=.env.local scripts/collect-matches.mjs --max-matches 300   # Riot 매치 수집 → raw
node --env-file=.env.local scripts/cluster-decks.mjs                      # 정제 → decks/deck_* + deck_stats
```

## 배포 구조 (Cloudflare)

- **페이지 전부 정적**(`output: "export"` → `out/`) → Cloudflare Static Assets 가 직접 서빙. Worker 호출·CPU 0.
- **`/api/recommend` 만 Worker**(`worker/index.ts`, `assets.run_worker_first: ["/api/*"]`). 점수 로직은 `lib/recommend-api.ts` → `lib/score.ts` → `lib/engine/score.ts`.
- 덱 데이터는 빌드 시 Supabase 에서 읽어 정적 페이지에 굽고, API 는 요청 시(1시간 캐시) 읽음. 데이터 갱신 반영 = 재배포.

## 데이터 흐름

```
CommunityDragon ko_kr.json ──sync.mjs──▶ lib/gen/units.json, items.json, traits.json
metatft comps API          ──sync-meta.mjs──▶ lib/gen/decks.json
                                                    │
lib/data.ts (타입 + import) ◀───────────────────────┘
lib/score.ts  추천 점수 — 초반 진입 기준 (초반 조합 40 / 아이템 방향 25 / 캐리 보너스 15 / 메타 20, 3성 규칙)
lib/board.ts  배치도 (실측 pos 없으면 특성 휴리스틱)
app/          /  입력 → /recommend 상위 3 → /deck/[id] 상세 (레벨별 조합·배치도)
```

- 사이트는 런타임에 외부 API를 부르지 않음. `lib/gen/*.json`을 커밋해서 배포.
- `npm run sync [패치] [세트]` — 기본 `latest 18`. PBE는 `npm run sync pbe 18`.
- `npm run sync:meta [최대 평균순위]` — 기본 4.5 (S/A 티어). B까지 보려면 `4.75`.
- id 규칙: 유닛은 cdragon 캐릭터 폴더명(`tft18_ahri` → `ahri`), 아이템은 cdragon apiName(`TFT_Item_GuardianAngel` → `guardianangel`, 밤의 끝자락). metatft 이름과 다른 아이템은 `scripts/sync-meta.mjs`의 `ITEM_ALIAS`.

## 패치 때 할 일

1. `npm run sync` → 유닛/아이템 변동 확인
2. `npm run sync:meta` → 경고(매핑 안 된 유닛/아이템) 있으면 `ITEM_ALIAS` 보강
3. `npx tsc --noEmit && npm run build`
4. 커밋
