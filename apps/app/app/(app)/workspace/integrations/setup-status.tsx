import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import type { ServiceView } from "@/lib/integrations/services";

/**
 * The reminder at the top of a booking tool's Manage dialog: is it set up
 * properly, and is the agent actually using it? Connecting here is step one;
 * choosing it under Agent → Booking is step two.
 */
export function SetupStatus({ service }: { service: ServiceView }) {
  const setup = service.setup;
  if (!setup) return null;

  if (!setup.connected) {
    return (
      <Notice tone="warning">
        Not ready yet: {service.name} still needs its {setup.missing}.
        {setup.chosen && " It is the chosen booking tool, so the agent hands leads off until this is fixed."}
      </Notice>
    );
  }
  if (setup.chosen) {
    return <Notice tone="success">Connected and in use. The agent books through {service.name}.</Notice>;
  }
  return (
    <Notice>
      Connected. Turn booking on under <Link href="/workspace/agent">Agent → Booking</Link> to have the agent use it.
    </Notice>
  );
}
