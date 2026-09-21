// 홈 — 빌드 타임 프리렌더. 입력 폼만 띄운다.
import { HomeForm } from "./home-form";

export const dynamic = "force-static";

export default function Home() {
  return <HomeForm />;
}
