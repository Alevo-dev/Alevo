import { handleStart } from "@/lib/booking/oauth-connect";

export const dynamic = "force-dynamic";

export function GET(req: Request) {
  return handleStart("google", req);
}
