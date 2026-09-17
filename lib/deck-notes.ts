// 덱 수동 보정. 키 = 자동 생성 이름(decks.json의 name). cluster id는 재계산마다 바뀌므로 이름으로 매칭.
// 값: 표시 이름 / 한 줄 플레이 가이드. 없는 덱은 자동 이름 그대로.
export const DECK_NOTES: Record<string, { name?: string; playstyle?: string }> = {
  "나무정령 이즈리얼 드레이븐": {
    name: "고밸류 드레이븐",
    playstyle: "나무정령 프론트로 초반 버티고 Fast 9 → 드레이븐·나르·아이번 5코 밸류. 드레이븐 3템 우선.",
  },
  "검은 가시 베이가": {
    name: "베이가 리롤",
    playstyle: "5렙에서 리롤해 베이가·렉사이·코부코 3성. 초반 2성 빨리 뜨면 연승 유지.",
  },
  "날렵이 말파이트": {
    name: "날렵이 말파이트 리롤",
    playstyle: "코부코·베이가·티모 3성 리롤 + 말파이트 탱. 7렙에서 멈추고 굴리기.",
  },
};
