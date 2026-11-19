import type { Metadata } from "next";
import { spendByOrg, spendSeries, spendSummary, type SpendRow } from "@alevo/db";
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
  openai: { label: "AI (ChatGPT)", unit: "tokens" },
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
const tok = (n: number) => Math.round(n).toLocaleString("en-US");
/** The price per million tokens a figure works out to (cached input counts at its own rate, so this can sit below the list price). */
const rate = (cost: number, tokens: number) => (tokens > 0 ? usd((cost / tokens) * 1e6) : "—");

/** What our vendors cost us, by environment, so dev and staging testing is visible next to production. */
export default async function SpendPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  const days = parseWindow((await searchParams).window);
  const [rows, daily, orgRows] = await Promise.all([spendSummary(days), spendSeries(days), spendByOrg(days)]);
  const byOrg = new Map<string, { id: string; name: string; byEnv: Record<string, number>; total: number }>();
  for (const r of orgRows) {
    const id = r.orgId ?? "none";
    const o = byOrg.get(id) ?? { id, name: r.name ?? (id === "none" ? "Not tied to an organization" : "Deleted organization"), byEnv: {}, total: 0 };
    o.byEnv[r.env] = (o.byEnv[r.env] ?? 0) + r.costUsd;
    o.total += r.costUsd;
    byOrg.set(id, o);
  }
  const orgs = [...byOrg.values()].sort((a, b) => b.total - a.total);
  // Every model separately, all environments together, so a price change or a new model is easy to see.
  type ModelRow = { provider: string; model: string; calls: number; inTok: number; outTok: number; inUsd: number; outUsd: number; unsplitTok: number; unsplitUsd: number; costUsd: number };
  const byModel = new Map<string, ModelRow>();
  for (const r of rows) {
    if (!r.model) continue;
    const m = byModel.get(`${r.provider}/${r.model}`) ?? { provider: r.provider, model: r.model, calls: 0, inTok: 0, outTok: 0, inUsd: 0, outUsd: 0, unsplitTok: 0, unsplitUsd: 0, costUsd: 0 };
    m.calls += r.calls;
    m.inTok += r.inputTokens;
    m.outTok += r.outputTokens;
    m.inUsd += r.inputCostUsd;
    m.outUsd += r.outputCostUsd;
    m.unsplitTok += r.unsplitUnits;
    m.unsplitUsd += r.unsplitCostUsd;
    m.costUsd += r.costUsd;
    byModel.set(`${r.provider}/${r.model}`, m);
  }
  const models = [...byModel.values()].sort((a, b) => b.costUsd - a.costUsd);
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

      <Card padding="none">
        <CardHeader title="By organization" hint="Who the spend was for, across every environment." aside={usd(total)} />
        <Table>
          <thead>
            <tr>
              <Th>Organization</Th>
              {ENVS.map((e) => (
                <Th key={e.key} className="text-right">{e.label}</Th>
              ))}
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {orgs.length === 0 ? (
              <EmptyRow colSpan={5}>No spend recorded in this window.</EmptyRow>
            ) : (
              orgs.map((o) => (
                <Tr key={o.id}>
                  <Td className="font-medium text-ink">{o.name}</Td>
                  {ENVS.map((e) => (
                    <Td key={e.key} className={NUM}>{o.byEnv[e.key] ? usd(o.byEnv[e.key]!) : "—"}</Td>
                  ))}
                  <Td className={`${NUM} font-medium text-ink`}>{usd(o.total)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
      </Card>

      <Card padding="none">
        <CardHeader title="By model" hint="Input (what we send: the prompt and the passages) and output (the reply) are priced separately, per model, every environment together." aside={usd(models.reduce((t, m) => t + m.costUsd, 0))} />
        <Table>
          <thead>
            <tr>
              <Th>Model</Th>
              <Th className="text-right">Calls</Th>
              <Th className="text-right">Input tokens</Th>
              <Th className="text-right">Input cost</Th>
              <Th className="text-right">Output tokens</Th>
              <Th className="text-right">Output cost</Th>
              <Th className="text-right">Price per 1M in / out</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {models.length === 0 ? (
              <EmptyRow colSpan={8}>No AI spend recorded in this window.</EmptyRow>
            ) : (
              models.map((m) => (
                <Tr key={`${m.provider}/${m.model}`}>
                  <Td>
                    <span className="font-mono font-medium text-ink">{m.model}</span>
                    <span className="block text-label text-ink-muted">{PROVIDERS[m.provider]?.label ?? m.provider}</span>
                  </Td>
                  <Td className={NUM}>{m.calls.toLocaleString("en-US")}</Td>
                  <Td className={NUM}>{tok(m.inTok)}</Td>
                  <Td className={NUM}>{usd(m.inUsd)}</Td>
                  <Td className={NUM}>{tok(m.outTok)}</Td>
                  <Td className={NUM}>{usd(m.outUsd)}</Td>
                  <Td className={NUM}>
                    {rate(m.inUsd, m.inTok)} / {m.provider === "voyage" ? "n/a" : rate(m.outUsd, m.outTok)}
                  </Td>
                  <Td className={`${NUM} font-medium text-ink`}>{usd(m.costUsd)}</Td>
                </Tr>
              ))
            )}
          </tbody>
        </Table>
        {models.some((m) => m.unsplitTok > 0) && (
          <p className="border-t border-hairline px-4 py-2.5 text-label text-ink-muted">
            {`${tok(models.reduce((t, m) => t + m.unsplitTok, 0))} tokens (${usd(models.reduce((t, m) => t + m.unsplitUsd, 0))}) were recorded before input and output were tracked separately. They are in each model's total but not in the input and output columns.`}
          </p>
        )}
      </Card>

      {ENVS.map((e) => {
        const mine = rows.filter((r) => r.env === e.key).sort((a, b) => b.costUsd - a.costUsd);
        return (
          <Card key={e.key} padding="none">
            <CardHeader title={e.label} hint={e.hint} aside={usd(sum(mine))} />
            <Table>
              <thead>
                <tr>
                  <Th>Vendor</Th>
                  <Th>Model</Th>
                  <Th>Used for</Th>
                  <Th className="text-right">Calls</Th>
                  <Th className="text-right">Volume</Th>
                  <Th className="text-right">Cost</Th>
                  <Th>Figure</Th>
                </tr>
              </thead>
              <tbody>
                {mine.length === 0 ? (
                  <EmptyRow colSpan={7}>No spend recorded in this window.</EmptyRow>
                ) : (
                  mine.map((r) => (
                    <Tr key={`${r.provider}/${r.kind}/${r.model ?? ""}`}>
                      <Td className="font-medium text-ink">{PROVIDERS[r.provider]?.label ?? r.provider}</Td>
                      <Td className="font-mono text-ink-muted">{r.model ?? "—"}</Td>
                      <Td className="text-ink-muted">{KINDS[r.kind] ?? "Other"}</Td>
                      <Td className={NUM}>{r.calls.toLocaleString("en-US")}</Td>
                      <Td className={NUM}>
                        {Math.round(r.units).toLocaleString("en-US")} <span className="text-ink-muted">{PROVIDERS[r.provider]?.unit}</span>
                        {r.inputTokens + r.outputTokens > 0 && (r.provider === "anthropic" || r.provider === "openai") && (
                          <span className="block text-label text-ink-muted">{`${tok(r.inputTokens)} in · ${tok(r.outputTokens)} out`}</span>
                        )}
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
