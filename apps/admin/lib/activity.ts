import { eq } from "drizzle-orm";
import { auditLog, finishPage, keysetOrder, keysetWhere, organizations, PAGE_SIZE, users, withService, type Cursor } from "@alevo/db";

const KEY = { at: auditLog.createdAt, id: auditLog.id };

/**
 * One page of the cross-org audit log, newest first, with the org and actor
 * names resolved in the same read. Service path; gated by the (admin) layout.
 */
export function activityPage(cursor: Cursor | null, size = PAGE_SIZE) {
  return withService((tx) =>
    tx
      .select({
        id: auditLog.id,
        action: auditLog.action,
        target: auditLog.target,
        orgId: auditLog.orgId,
        orgName: organizations.name,
        actor: users.email,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .leftJoin(organizations, eq(organizations.id, auditLog.orgId))
      .leftJoin(users, eq(users.id, auditLog.actorUserId))
      .where(keysetWhere(auditLog, KEY, cursor))
      .orderBy(...keysetOrder(KEY, cursor))
      .limit(size + 1),
  ).then((rows) => finishPage(rows, cursor, size));
}

export type ActivityRow = Awaited<ReturnType<typeof activityPage>>["rows"][number];
