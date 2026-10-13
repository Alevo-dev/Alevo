import { auditLog } from "./schema/audit";
import { withService } from "./with-tenant";

export type AuditEntry = {
  orgId?: string | null;
  actorUserId?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Append an audit entry. Best-effort: a logging failure must not break the
 * action it records, so errors are swallowed (and logged to the console).
 * Server-only (service path).
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await withService((tx) =>
      tx.insert(auditLog).values({
        orgId: entry.orgId ?? null,
        actorUserId: entry.actorUserId ?? null,
        action: entry.action,
        target: entry.target ?? null,
        metadata: entry.metadata ?? {},
      }),
    );
  } catch (error) {
    console.error("recordAudit failed:", error);
  }
}
