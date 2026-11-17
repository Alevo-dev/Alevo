import type { Metadata } from "next";
import { spendSeries, spendSummary, type SpendRow } from "@alevo/db";
import { Card, CardHeader } from "@alevo/ui/card";
import { PageHeader } from "@alevo/ui/page-header";
import { Pill } from "@alevo/ui/pill";
import { StatTile } from "@alevo/ui/stat-tile";
import { EmptyRow, Table, Td, Th, Tr } from "@alevo/ui/table";
import { WindowSwitch } from "@alevo/ui/window-switch";
import { bucketCount, parseWindow, periodFor, toSeries, windowText, WINDOWS } from "@/lib/metrics-format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spend" };

const NUM = "tabular text-right font-mono";
const ENVS = [
  { key: "production", label: "Production", tone: "success" as const, hint: "Real customers." },
  { key: "staging", label: "Staging", tone: "warning" as const, hint: "Pre-launch testing on the shared database." },
  { key: "development", label: "Development", tone: "brand" as const, hint: "Local development on the shared database." },
];
/** What each provider is, and what its `units` count. */
const PROVIDERS: Record<string, { label: string; unit: string }> = {
  anthropic: { label: "AI (Claude)", unit: "tokens" },
  voyage: { label: "Embeddings (Voyage)", unit: "tokens" },
  twilio: { label: "Text messages (Twilio)", unit: "segments" },
  resend: { label: "Email (Resend)", unit: "emails" },
  vapi: { label: "Phone calls (Vapi)", unit: "minutes" },
};
const KINDS: Record<string, string> = {
  agent_turn: "Agent replies",
  call_summary: "Call summaries",
  profile_import: "Website import",
  embedding: "Knowledge base",
  sms_out: "Texts sent",
  sms_in: "Texts received",
  email_out: "Emails sent",
  call: "Calls",
};

const usd = (n: number) => (n >= 100 ? `$${Math.round(n).toLocaleString("en-US")}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(n === 0 ? 0 : 4)}`);
const sum = (rows: SpendRow[]) => rows.reduce((t, r) => t + r.costUsd, 0);

/** What our vendors cost us, by environment, so dev and staging testing is visible next to production. */
export default async function SpendPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const days = parseWindow((await searchParams).window);
  const [rows, daily] = await Promise.all([spendSummary(days), spendSeries(days)]);
  const n = bucketCount(days);
  const total = sum(rows);

  return (
    <div className="space-y-6">
      <PageHeader title="Spend" description={`What our vendors charge us for each environment, ${windowText(days)}.${usd(total)} in all.`}>
        <WindowSwitch value={days} windows={WINDOWS} />
      </PageHeader>

      <section className="grid grid-cols-1 border-y border-hairline sm:grid-cols-3" aria-label="Spend by environment">
        {ENVS.map((e) => {
          const mine = rows.filter((r) => r.env === e.key);
          const series = toSeries(daily.filter((d) => d.env === e.key).map((d) => ({ ago: d.ago, n: d.costUsd })), n);
          return (
            <StatTile key={e.key} label={e.label} value={usd(sum(mine))} hint={`${mine.reduce((t, r) => t + r.calls, 0).toLocaleString("en-US")} vendor calls`} series={series} unit="USD" period={periodFor(days)} tone={e.tone} />
          );
        })}
      </section>

      {ENVS.map((e) => {
        const mine = rows.filter((r) => r.env === e.key).sort((a, b) => b.costUsd - a.costUsd);
        return (
          <Card key={e.key} padding="none">
            <CardHeader title={e.label} hint={e.hint} aside={usd(sum(mine))} />
            <Table>
              <thead>
                <tr>
                  <Th>Vendor</Th>
                  <Th>What for</Th>
                  <Th className="text-right">Calls</Th>
                  <Th className="text-right">Volume</Th>
                  <Th className="text-right">Cost</Th>
                  <Th>Figure</Th>
                </tr>
              </thead>
              <tbody>
                {mine.length === 0 ? (
                  <EmptyRow colSpan={6}>No spend recorded in this window.</EmptyRow>
                ) : (
                  mine.map((r) => (
                    <Tr key={`${r.provider}/${r.kind}`}>
                      <Td className="font-medium text-ink">{PROVIDERS[r.provider]?.label ?? r.provider}</Td>
                      <Td className="text-ink-muted">{KINDS[r.kind] ?? r.kind}</Td>
                      <Td className={NUM}>{r.calls.toLocaleString("en-US")}</Td>
                      <Td className={NUM}>
                        {Math.round(r.units).toLocaleString("en-US")} <span className="text-ink-muted">{PROVIDERS[r.provider]?.unit}</span>
                      </Td>
                      <Td className={NUM}>{usd(r.costUsd)}</Td>
                      <Td>
                        <Pill tone={r.estimatedUsd > 0 ? "muted" : "success"}>{r.estimatedUsd > 0 ? "Estimated" : "From vendor"}</Pill>
                      </Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </Table>
          </Card>
        );
      })}

      <p className="text-label text-ink-muted">
        Costs are recorded as each call happens. AI, embedding, text and email figures are estimates from each vendor&apos;s public rates; phone calls use Vapi&apos;s own cost for the call. Vendors&apos; invoices are the final word.
      </p>
    </div>
  );
}
