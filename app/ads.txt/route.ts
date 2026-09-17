import { ADSENSE_CLIENT } from "@/lib/ads";

export const dynamic = "force-static";

// AdSense 소유 확인용 /ads.txt
export function GET() {
  const client = ADSENSE_CLIENT.replace(/^ca-/, "");
  const body = client ? `google.com, ${client}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
