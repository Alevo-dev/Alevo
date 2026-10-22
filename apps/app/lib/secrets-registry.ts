/**
 * The set of per-org secrets the UI can manage. Adding a vendor key is a new
 * entry here plus the code that reads it via getOrgSecret(orgId, key).
 * Keep key names stable — they're the DB identifiers.
 */

export type SecretKey =
  | "slack_webhook_url"
  | "calcom_api_key"
  | "calcom_webhook_secret"
  | "calendly_webhook_secret";

/** Form field name prefix for a secret: the field is `secret.<key>`. */
export const FIELD_PREFIX = "secret.";

export type SecretSpec = {
  key: SecretKey;
  label: string;
  help: string;
  placeholder: string;
  /** Input type for the form field (url shows the value + gets browser validation). */
  inputType: "url" | "password";
  /** Optional format check; returns an error message, or null if valid. */
  validate?: (value: string) => string | null;
};

function validateSlackWebhook(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "Enter a valid URL.";
  }
  if (url.protocol !== "https:") return "URL must start with https://.";
  if (url.hostname !== "hooks.slack.com") {
    return "Must be a Slack webhook URL (hooks.slack.com).";
  }
  return null;
}

export const SECRET_KEYS: readonly SecretSpec[] = [
  {
    key: "slack_webhook_url",
    label: "Slack webhook URL",
    help: "Incoming webhook for this org's notifications (qualified leads, escalations).",
    placeholder: "https://hooks.slack.com/services/…",
    inputType: "url",
    validate: validateSlackWebhook,
  },
  {
    key: "calcom_api_key",
    label: "Cal.com API key",
    help: "Used to read availability and book meetings via Cal.com.",
    placeholder: "cal_live_…",
    inputType: "password",
  },
  {
    key: "calcom_webhook_secret",
    label: "Cal.com webhook secret",
    help: "Signs Cal.com booking webhooks so we can verify them. Set the same secret on the Cal.com webhook pointing at /api/webhooks/calcom.",
    placeholder: "whatever secret you set in Cal.com",
    inputType: "password",
  },
  {
    key: "calendly_webhook_secret",
    label: "Cal­endly webhook signing key",
    help: "Verifies Calendly booking webhooks. From the Calendly webhook subscription pointing at /api/webhooks/calendly.",
    placeholder: "Calendly signing key",
    inputType: "password",
  },
];

const KEY_SET: ReadonlySet<string> = new Set(SECRET_KEYS.map((s) => s.key));

export function isSecretKey(value: string): value is SecretKey {
  return KEY_SET.has(value);
}

export function getSecretSpec(key: SecretKey): SecretSpec {
  const spec = SECRET_KEYS.find((s) => s.key === key);
  if (!spec) throw new Error(`Unknown secret: ${key}`);
  return spec;
}
