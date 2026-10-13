import { listOrgSecretKeys } from "@alevo/db";
import { ForbiddenError, getCurrentOrg, requireRole } from "@alevo/auth";
import { SECRET_KEYS } from "@/lib/secrets-registry";
import { SecretRow } from "./secrets-ui";

export const dynamic = "force-dynamic";

export default async function SecretsPage() {
  try {
    await requireRole("admin");
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return (
        <p className="text-muted-foreground">You need an admin role to manage integrations.</p>
      );
    }
    throw error;
  }

  const org = await getCurrentOrg();
  const setKeys = org ? new Set(await listOrgSecretKeys(org.id)) : new Set<string>();

  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl">Integrations</h1>
        <p className="mt-1 text-muted-foreground">
          Store per-organization credentials. Values are encrypted and never shown again.
        </p>
      </div>

      <div className="space-y-3">
        {SECRET_KEYS.map((s) => (
          <SecretRow
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
    </section>
  );
}
