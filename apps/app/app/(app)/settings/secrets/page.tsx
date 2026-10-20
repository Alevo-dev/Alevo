import { listOrgSecretKeys } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole } from "@alevo/auth";
import { Notice } from "@/components/ui/notice";
import { SECRET_KEYS } from "@/lib/secrets-registry";
import { SecretCard } from "./secrets-ui";

export const dynamic = "force-dynamic";

export default async function SecretsPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return <Notice tone="warning">You need an admin role to manage integrations.</Notice>;
    }
    throw error;
  }

  const org = await getCurrentOrg();
  const setKeys = org ? new Set(await listOrgSecretKeys(org.id)) : new Set<string>();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-heading font-semibold">API keys and secrets</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Stored encrypted per organization. Values are never shown again after you save them.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {SECRET_KEYS.map((s) => (
          <SecretCard
            key={s.key}
            secretKey={s.key}
            label={s.label}
            help={s.help}
            placeholder={s.placeholder}
            inputType={s.inputType}
            isSet={setKeys.has(s.key)}
            testable={s.key === "slack_webhook_url"}
          />
        ))}
      </div>
    </div>
  );
}
