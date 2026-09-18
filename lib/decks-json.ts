// metatft 스냅샷 폴백 (135KB). lib/decks.ts 가 DB 실패 시에만 동적 import → Worker 콜드 스타트에서 파싱 안 함.
import decksJson from "./gen/decks.json";
import { DECK_NOTES } from "./deck-notes";
import type { Deck } from "./data";

export const DECKS_JSON: Deck[] = (decksJson as unknown as Deck[]).map((d) => ({ ...d, ...DECK_NOTES[d.name] }));
