import type { Metadata } from "next";
import Link from "next/link";
import { PageHead, Section, Container, CtaBand } from "@/components/landing/page-kit";

export const metadata: Metadata = {
  title: "Features",
  description:
    "One AI agent across chat, forms, inbound calls, email and cold calling — qualifying leads, booking meetings and syncing everything to your CRM.",
};

const IChat = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38b6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>);
const IForm = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38b6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></svg>);
const IPhone = ({ c = "#38b6ff" }: { c?: string }) => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>);
const IMail = () => (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a06bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>);

const inbound = [
  { icon: <IChat />, title: "Chatbot messaging", body: "Replies to website visitors instantly, answers product and pricing questions, qualifies intent and books the call inside the chat window." },
  { icon: <IForm />, title: "Form lead capture", body: "Every form submission is enriched, scored and logged to your CRM, then followed up by email or call while the buyer is still on your site." },
  { icon: <IPhone />, title: "Answers inbound calls", body: "A natural-sounding voice agent picks up 24/7, handles questions, qualifies the caller and books time or transfers live to your team." },
];
const outbound = [
  { icon: <IMail />, title: "Emails to new and existing customers", body: "Cold sequences for new prospects, plus renewals, upsells and check-ins for current customers — written from CRM history, paused automatically on reply." },
  { icon: <IPhone c="#a06bff" />, title: "AI cold calling", body: "Works through your call lists, handles objections, leaves voicemails and books meetings. Every call is recorded, transcribed and summarized on the contact record." },
];

function Grid({ eyebrow, color, title, body, items }: { eyebrow: string; color: string; title: string; body: string; items: { icon: React.ReactNode; title: string; body: string }[] }) {
  return (
    <Section>
      <div style={{ maxWidth: 720 }}>
        <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color }}>{eyebrow}</div>
        <h2 style={{ fontSize: "clamp(30px,4vw,46px)", lineHeight: 1.06, letterSpacing: "-.04em", fontWeight: 600, margin: "16px 0 0", textWrap: "balance" }}>{title}</h2>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: "var(--muted)", margin: "16px 0 0", textWrap: "pretty" }}>{body}</p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 20, marginTop: 40 }}>
        {items.map((f) => (
          <div key={f.title} style={{ borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 19, fontWeight: 600, letterSpacing: "-.02em" }}>{f.icon}{f.title}</div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)", margin: "12px 0 0" }}>{f.body}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

export default function FeaturesPage() {
  return (
    <>
      <PageHead
        eyebrow="Features"
        title="One agent across every channel your buyers use."
        subtitle="Alevo answers chats, forms and inbound calls in seconds, runs personalized email and cold-call outbound, and books meetings straight into your calendar and CRM."
      />
      <Grid eyebrow="01 · INBOUND" color="#38b6ff" title="Answers in seconds, on every channel." body="Website chat, form fills and phone calls all land with the same agent. It qualifies, answers from your playbook, and books the meeting before the lead goes cold." items={inbound} />
      <Grid eyebrow="02 · OUTBOUND" color="#a06bff" title="Pipeline that builds itself." body="Alevo writes and sends personalized emails and makes cold calls from your lists. Replies and outcomes flow straight back into your CRM." items={outbound} />
      <Section muted>
        <Container style={{ padding: 0 }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#3ddc97" }}>03 · INTEGRATIONS</div>
          <h2 style={{ fontSize: "clamp(28px,3.6vw,42px)", lineHeight: 1.06, letterSpacing: "-.04em", fontWeight: 600, margin: "16px 0 0", maxWidth: 720, textWrap: "balance" }}>Plugs into the CRM and calendar you already run.</h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "var(--muted)", margin: "16px 0 0", maxWidth: 680 }}>
            Two-way sync with Salesforce, HubSpot, Pipedrive, Zoho and Close, plus Calendly, Cal.com, Google Calendar, Outlook and Acuity.{" "}
            <Link href="/#integrations" style={{ color: "#38b6ff" }}>See the integrations →</Link>
          </p>
        </Container>
      </Section>
      <CtaBand />
    </>
  );
}
