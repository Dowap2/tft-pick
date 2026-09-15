# TFT PICK

지금 가진 아이템·유닛을 입력하면 갈 수 있는 롤토체스 덱 3개를 추천합니다. (Set 18)

```bash
npm run dev          # http://localhost:3000
npm run sync         # 유닛/아이템/특성 데이터 갱신 (CommunityDragon)
npm run sync:meta    # 메타 덱 갱신 (metatft 통계)
```

## 데이터 흐름

```
CommunityDragon ko_kr.json ──sync.mjs──▶ lib/gen/units.json, items.json, traits.json
metatft comps API          ──sync-meta.mjs──▶ lib/gen/decks.json
                                                    │
lib/data.ts (타입 + import) ◀───────────────────────┘
lib/score.ts  추천 점수 (캐리 35 / 캐리템 30 / 서포트 15 / 메타 20)
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
