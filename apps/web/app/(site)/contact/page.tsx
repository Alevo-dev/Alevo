import type { Metadata } from "next";
import { PageHead, Section, Container } from "@/components/landing/page-kit";
import { ContactForm } from "@/components/landing/contact-form";
import { siteConfig } from "@/lib/site";

export const metadata: Metadata = {
  title: "Book a demo",
  description:
    "See Alevo handle your real inbound and outbound flows in a 20-minute demo. Pick a time or send us a note.",
};

export default function ContactPage() {
  const booking = siteConfig.bookingUrl;
  const embedSrc = booking
    ? booking + (booking.includes("?") ? "&" : "?") + "gv=true"
    : "";

  return (
    <>
      <PageHead
        eyebrow="Book a demo"
        title="See Alevo work your pipeline."
        subtitle="A 20-minute walkthrough on your real inbound and outbound flows — no slides. Pick a time below, or send us a note and we’ll reach out."
      />

      <Section>
        <div style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,360px),1fr))", alignItems: "start" }}>
          {/* Scheduler */}
          <div>
            <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#38b6ff", marginBottom: 14 }}>PICK A TIME</div>
            {embedSrc ? (
              <div style={{ borderRadius: 18, overflow: "hidden", border: "1px solid rgba(var(--ink),.1)", background: "#fff" }}>
                <iframe
                  src={embedSrc}
                  title="Book a demo with Alevo"
                  width="100%"
                  height={640}
                  style={{ border: 0, display: "block" }}
                  loading="lazy"
                />
              </div>
            ) : (
              <div style={{ borderRadius: 18, border: "1px dashed rgba(var(--ink),.18)", background: "rgba(var(--ink),.02)", padding: 28, color: "var(--muted)", fontSize: 15, lineHeight: 1.6 }}>
                Live scheduling is being connected. In the meantime, send the form
                and we’ll email you a time within one business day.
              </div>
            )}
          </div>

          {/* Message form */}
          <div>
            <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#a06bff", marginBottom: 14 }}>OR SEND A NOTE</div>
            <ContactForm />
          </div>
        </div>
      </Section>

      <Section muted style={{ paddingTop: 56, paddingBottom: 56 }}>
        <Container style={{ padding: 0 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 28, fontSize: 14, color: "var(--muted)" }}>
            {[
              ["20 minutes, no deck", "Just your use case, running live."],
              ["Talk to a human", "Someone who’s carried a quota — not a bot."],
              ["No pressure", "See it work, then decide."],
            ].map(([t, d]) => (
              <div key={t} style={{ flex: "1 1 240px" }}>
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{t}</div>
                <div style={{ marginTop: 4 }}>{d}</div>
              </div>
            ))}
          </div>
        </Container>
      </Section>
    </>
  );
}
