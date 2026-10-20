import { handleStart } from "@/lib/booking/oauth-connect";

export const dynamic = "force-dynamic";

export function GET() {
  return handleStart("m365");
}
