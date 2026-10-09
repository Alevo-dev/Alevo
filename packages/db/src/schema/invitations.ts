/**
 * Organization invitations. Typed mirror of migration 0003. Mirrors Clerk org
 * invitations and carries the intended app role (Clerk's 2 roles can't express
 * our 4). Tenant-scoped reads; writes via the service path after requireRole.
 */
import { index, pgEnum, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { appRole, organizations, timestamps, users } from "./identity";

export const invitationStatus = pgEnum("invitation_status", [
  "pending",
  "accepted",
  "revoked",
]);

export const orgInvitations = pgTable(
  "org_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: appRole("role").notNull().default("rep"),
    status: invitationStatus("status").notNull().default("pending"),
    clerkInvitationId: text("clerk_invitation_id").unique(),
    invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [index("org_invitations_org_id_idx").on(t.orgId)],
);

export type InvitationStatus = (typeof invitationStatus.enumValues)[number];
