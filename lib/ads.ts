// AdSense 설정. 퍼블리셔 ID는 공개값이라 기본값, 슬롯은 Netlify 환경변수.
// ("use client" 모듈에서 export한 상수는 서버 컴포넌트에서 문자열이 아니라 클라이언트 참조로 잡혀서 여기 분리)
export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-8923116744431536";
export const ADSENSE_SLOTS = {
  left: process.env.NEXT_PUBLIC_ADSENSE_SLOT_LEFT,
  right: process.env.NEXT_PUBLIC_ADSENSE_SLOT_RIGHT,
};
