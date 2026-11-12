import "server-only";
import { and, eq, ne } from "drizzle-orm";
import { orgProfiles, withService } from "@alevo/db";

/**
 * The webhook finds the org by its Vapi number record, so a record belongs to one
 * org only. When `orgId` takes it over, any other org still holding it lets go and
 * its calls switch off (it no longer has that number).
 */
export async function releaseVapiNumber(orgId: string, vapiPhoneNumberId: string): Promise<void> {
  await withService((tx) =>
    tx
      .update(orgProfiles)
      .set({ vapiPhoneNumberId: null, voiceEnabled: false, updatedAt: new Date() })
      .where(and(eq(orgProfiles.vapiPhoneNumberId, vapiPhoneNumberId), ne(orgProfiles.orgId, orgId))),
  );
}
