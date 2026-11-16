import type { ToolDialogWidth } from "@/components/workspace/tool-dialog";

export const KEYS_NOTE = "Keys are stored encrypted. Values are never shown again after you save them.";

type Meta = { subtitle?: string; note: string; width: ToolDialogWidth };

/** What each tool's settings window says under its name and in its footer, and how wide it is (the Integrations boards). */
const META: Record<string, Meta> = {
  form: {
    subtitle: "Every submission opens a conversation the agent works.",
    note: "Every path runs the same spam checks. Submissions arrive under Conversations as web-form leads.",
    width: "lg",
  },
  chat: {
    subtitle: "Live chat on your site, answered by the agent.",
    note: "Each chat opens a conversation the agent works. Once a visitor shares an email, replies carry on by email.",
    width: "xl",
  },
  slack: {
    subtitle: "Alerts for qualified leads and escalations.",
    note: "Stored encrypted. Never shown again after you save.",
    width: "sm",
  },
};

export function dialogMeta(serviceId: string, description?: string): Meta {
  const m = META[serviceId];
  return { subtitle: m?.subtitle ?? description, note: m?.note ?? KEYS_NOTE, width: m?.width ?? "md" };
}
