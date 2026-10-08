import type { Metadata } from "next";
import { PageHead, Section, Container, CtaBand } from "@/components/landing/page-kit";

export const metadata: Metadata = {
  title: "About",
  description:
    "Why we built Alevo — an AI SDR that answers every lead and works your pipeline across inbound and outbound, so your team spends its time on conversations that count.",
};

const values = [
  ["Answer everyone", "Speed to lead wins deals. Every chat, form and call gets a real, useful reply in seconds — not hours."],
  ["Human when it matters", "Alevo qualifies and books, then hands off to a rep with full context the moment a person should take over."],
  ["Show the work", "Every message, call and decision is logged, transcribed and synced to your CRM. No black box."],
];

export default function AboutPage() {
  return (
    <>
      <PageHead
        eyebrow="About"
        title="Selling is human. The busywork isn’t."
        subtitle="We built Alevo so revenue teams stop losing leads to slow replies and manual follow-up — and spend their time on the conversations that actually move deals."
      />

      <Section>
        <Container style={{ padding: 0, maxWidth: 760 }}>
          <p style={{ fontSize: 19, lineHeight: 1.7, color: "var(--text2)" }}>
            Most pipelines leak in the same places: a chat that goes unanswered, a form that sits in an inbox, a
            callback that never happens, a follow-up that slips. The fix isn’t another dashboard — it’s a rep that
            never sleeps and never drops the thread.
          </p>
          <p style={{ fontSize: 19, lineHeight: 1.7, color: "var(--text2)", marginTop: 20 }}>
            Alevo answers inbound in seconds across chat, forms and calls, and works outbound with personalized email
            and cold calling — then books meetings straight into your calendar and CRM. It’s the teammate we always
            wanted: fast, consistent, and honest about when a human should step in.
          </p>
        </Container>
      </Section>

      <Section muted>
        <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#a06bff" }}>WHAT WE HOLD TO</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", gap: 20, marginTop: 32 }}>
          {values.map(([t, d]) => (
            <div key={t} style={{ borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "var(--panel2)", padding: 28 }}>
              <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-.02em" }}>{t}</div>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)", margin: "10px 0 0" }}>{d}</p>
            </div>
          ))}
        </div>
      </Section>

      <CtaBand title="Put Alevo to work." subtitle="See it handle your real inbound and outbound flows in a 20-minute demo." />
    </>
  );
}
