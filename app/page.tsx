// 홈 — 빌드 타임 프리렌더. 입력 폼만 띄운다.
import { HomeForm } from "./home-form";

export const dynamic = "force-static";
// 홈에만 canonical 이 없었다. www.panlab.lol 이 같은 문서를 200 으로 주고 있어(리다이렉트 미설정)
// canonical 없이는 완전 중복 문서가 된다.
export const metadata = { alternates: { canonical: "/" } };

export default function Home() {
  return <HomeForm />;
}
