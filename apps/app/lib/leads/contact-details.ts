import { cache } from "react";
import { eq } from "drizzle-orm";
import { orgProfiles, organizations, withService } from "@alevo/db";

/** What the public contact form shows about the business. A blank field is simply not shown. */
export type ContactDetails = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  hours: string;
};

/** Deduped per request: generateMetadata, the page and the JSON endpoint all ask. Null = no such org. */
export const loadContactDetails = cache(async (orgId: string): Promise<ContactDetails | null> => {
  // A malformed id would make Postgres throw on the uuid cast; treat it as "no such form".
  if (!/^[0-9a-f-]{36}$/i.test(orgId)) return null;
  const [row] = await withService((tx) =>
    tx
      .select({
        id: organizations.id,
        orgName: organizations.name,
        companyName: orgProfiles.companyName,
        email: orgProfiles.contactEmail,
        phone: orgProfiles.contactPhone,
        address: orgProfiles.businessAddress,
        hours: orgProfiles.contactHours,
      })
      .from(organizations)
      .leftJoin(orgProfiles, eq(orgProfiles.orgId, organizations.id))
      .where(eq(organizations.id, orgId))
      .limit(1),
  );
  if (!row) return null;
  return {
    id: row.id,
    name: row.companyName || row.orgName,
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    hours: row.hours ?? "",
  };
});
