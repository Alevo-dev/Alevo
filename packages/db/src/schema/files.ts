/**
 * File references (Cloudflare R2). Typed mirror of migration 0006. The object
 * lives in R2; this row holds the key + metadata. Tenant-scoped reads; writes
 * via the service path (presign/confirm routes).
 */
import { index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { organizations, timestamps, users } from "./identity";

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull().unique(),
    fileName: text("file_name"),
    contentType: text("content_type"),
    sizeBytes: integer("size_bytes"),
    uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    status: text("status").notNull().default("pending"),
    ...timestamps,
  },
  (t) => [index("files_org_id_idx").on(t.orgId)],
);
