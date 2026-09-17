// AdSense 소유 확인용 /ads.txt — 환경변수로 퍼블리셔 ID 주입
export function GET() {
  const client = (process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "ca-pub-8923116744431536").replace(/^ca-/, "");
  const body = client ? `google.com, ${client}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
