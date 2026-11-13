export { getDb, type Db, type Tx } from "./client";
export { withTenant, withService, type TenantClaims } from "./with-tenant";
export { seal, open, signingKey, type SealedSecret } from "./crypto";
export { resealSecrets, type ResealReport } from "./reseal";
export { pgErrorCode, safeErrorMessage } from "./pg-error";
export {
  setOrgSecret,
  getOrgSecret,
  deleteOrgSecret,
  listOrgSecretKeys,
} from "./secrets";
export { recordAudit, type AuditEntry } from "./audit";
export { CONNECTION_PROVIDERS, recordWebhookDelivery, type DeliveryDirection, type WebhookProvider, type WebhookOutcome } from "./webhook-deliveries";
export { claimWebhookEvent, releaseWebhookEvent } from "./webhook-events";
export { currentPeriod, getUsage, recordUsage, type UsageRow } from "./usage";
export { hitRateLimit } from "./rate-limit";
export { encodeCursor, finishPage, keysetOrder, keysetWhere, PAGE_SIZE, pageCount, parseCursor, type Cursor, type Page, type PageDir } from "./paginate";
export { markAgentSkipped, countsTowardSpeed, replyOutcome, type AgentSkipReason } from "./conversation-flags";
export { funnelByOrg, funnelSeries, type FunnelBucket, type OrgFunnel } from "./metrics";
export { deletePlatformSecret, getPlatformSecret, platformSecretStatus, setPlatformSecret, type PlatformSecretKey } from "./platform-secrets";
export { isSuppressed, addSuppression } from "./suppressions";
export { recordConsent, revokeConsentForContact, revokeConsentForEmail } from "./consents";
export { ownerEmails } from "./onboarding/owner-emails";
export { isReady, readiness, type ReadinessFacts, type ReadinessItem, type ReadinessKey } from "./onboarding/readiness";
export { loadReadinessFacts } from "./onboarding/load-readiness";
export { DECLINE_KEYS, isDeclineKey, setSetupDecline, type DeclineKey } from "./onboarding/declines";
export { normalizeEmail, normalizePhone } from "./crm/identity";
export { claimIdentity, keeperOf, resolveContact, type ContactFields, type ContactIdentity, type Resolved } from "./crm/resolve-contact";
export * from "./schema";
