// 증강 데이터 (서버 전용 — 200KB 라 클라이언트 번들에 넣지 않음)
import augmentsJson from "./gen/augments.json";
import augmentTiersJson from "./gen/augment_tiers.json";

export type Augment = { name: string; img: string; desc: string };
export const AUGMENTS = augmentsJson as Record<string, Augment>;
export const AUGMENT_TIERS = augmentTiersJson as Record<string, string>;
