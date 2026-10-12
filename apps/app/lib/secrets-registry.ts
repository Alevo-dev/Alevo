/**
 * The set of per-org secrets the UI can manage. Adding a vendor key is a new
 * entry here plus the code that reads it via getOrgSecret(orgId, key).
 * Keep key names stable — they're the DB identifiers.
 */
export const SECRET_KEYS = [
  {
    key: "slack_webhook_url",
    label: "Slack webhook URL",
    help: "Incoming webhook for this org's notifications (qualified leads, escalations).",
    placeholder: "https://hooks.slack.com/services/…",
  },
  {
    key: "calcom_api_key",
    label: "Cal.com API key",
    help: "Used to read availability and book meetings via Cal.com.",
    placeholder: "cal_live_…",
  },
] as const;

export type SecretKey = (typeof SECRET_KEYS)[number]["key"];

const KEY_SET: ReadonlySet<string> = new Set(SECRET_KEYS.map((s) => s.key));
export function isSecretKey(value: string): value is SecretKey {
  return KEY_SET.has(value);
}
