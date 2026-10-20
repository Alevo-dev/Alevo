import { handleCallback } from "@/lib/booking/oauth-connect";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return handleCallback("m365", request);
}
