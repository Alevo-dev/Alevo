import { Pill } from "@/components/ui/pill";
import { initials } from "@/lib/format";

export type CalendarMember = { id: string; name: string; email: string | null; role: string };

/**
 * The Calendar panel's people block (board: "Your calendar" + "Team calendars"). The app has ONE
 * org-level calendar that everyone shares, so each member reads Connected when the org has one
 * connected and Not connected otherwise. Nothing per person is stored.
 */
export function TeamCalendars({ calendar, me, members }: { calendar: string | null; me: CalendarMember | undefined; members: CalendarMember[] }) {
  const state = calendar ? <Pill tone="success">Connected</Pill> : <Pill tone="muted">Not connected</Pill>;
  return (
    <div className="border-t border-hairline">
      <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
        <div className="min-w-0">
          <p className="font-semibold text-ink">Your calendar</p>
          <p className="truncate text-[12.5px] text-ink-muted">{calendar ? `${calendar}, shared by the whole workspace` : "Connect a calendar above so the agent can book."}</p>
        </div>
        {state}
      </div>
      <div className="border-t border-hairline bg-sunken px-3.5 py-[7px] text-[12px] font-[550] uppercase tracking-[0.05em] text-ink-muted">Team calendars</div>
      <ul>
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 border-t border-hairline/70 px-3.5 py-2 first:border-t-0">
            <span aria-hidden="true" className="inline-flex size-[26px] shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-ink">
              {initials(m.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-[550] text-ink">
                {m.name}
                {m.id === me?.id && <span className="font-normal text-ink-muted"> (you)</span>}
              </p>
              {m.email && m.email !== m.name && <p className="truncate text-[12.5px] text-ink-muted">{m.email}</p>}
            </div>
            <span className="hidden text-label capitalize text-ink-muted sm:inline">{m.role}</span>
            {state}
          </li>
        ))}
      </ul>
    </div>
  );
}
