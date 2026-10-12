/**
 * Per-org encrypted secrets. Typed mirror of migration 0004. Service-path only
 * (RLS on, no policy/grant). Values are AES-256-GCM ciphertext; never store or
 * return plaintext. Access via setOrgSecret/getOrgSecret (see secrets.ts).
 */
import { index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { organizations, timestamps } from "./identity";

export const orgSecrets = pgTable(
  "org_secrets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    keyName: text("key_name").notNull(),
    ciphertext: text("ciphertext").notNull(),
    iv: text("iv").notNull(),
    authTag: text("auth_tag").notNull(),
    keyVersion: integer("key_version").notNull().default(1),
    ...timestamps,
  },
  (t) => [
    unique("org_secrets_org_key_unique").on(t.orgId, t.keyName),
    index("org_secrets_org_id_idx").on(t.orgId),
  ],
);
