import { InfoStrip } from "@/components/ui/nav-kit";
import { Pill } from "@/components/ui/pill";
import { fmtShort } from "@/lib/format";

export type StripRow = {
  enabled: boolean;
  companyName: string | null;
  offering: string | null;
  idealCustomer: string | null;
  smsFromNumber: string | null;
  voiceEnabled: boolean;
  updatedAt: Date;
} | null | undefined;

/** Channels the agent answers on: web form and email always, plus SMS with a number, plus calls when on. */
export function liveChannels(row: StripRow): number {
  return 2 + (row?.smsFromNumber ? 1 : 0) + (row?.voiceEnabled ? 1 : 0);
}

/**
 * The status row under a Workspace page title (board `.info`): agent state, how much of
 * the profile is filled in, live channels, last save. Read-only, from the org's profile row.
 */
export function StatusStrip({ row, tz }: { row: StripRow; tz: string }) {
  const filled = [row?.companyName, row?.offering, row?.idealCustomer].filter(Boolean).length;
  const channels = liveChannels(row);
  return (
    <InfoStrip
      items={[
        { label: "Agent", value: <Pill tone={row?.enabled ? "success" : "muted"}>{row?.enabled ? "On" : "Off"}</Pill> },
        { label: "Profile", value: <><span className="font-mono">{filled} of 3</span> required fields</> },
        { label: "Channels live", value: `${channels} channels` },
        { label: "Last saved", value: row ? fmtShort(row.updatedAt, tz) : "Not yet" },
      ]}
    />
  );
}
