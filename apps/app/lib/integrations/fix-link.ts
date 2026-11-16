import { JUMP } from "@/lib/jump";
import type { ServiceView } from "./services";

/**
 * Where a "Needs attention" line sends you. The SMS number lives in the agent settings (Channels), so Twilio goes
 * there. Every other tool opens its own settings window: `#<section>:<tool>` makes the Integrations page open that
 * section and then the tool's window (`IntegrationTabs`, `ManageDialog`).
 */
export function fixFor(service: Pick<ServiceView, "id" | "group" | "name">): { href: string; label: string } {
  if (service.id === "twilio") return { href: JUMP.agentChannels, label: "Set the number" };
  return { href: `/workspace/integrations#${service.group}:${service.id}`, label: `Open ${service.name}` };
}
