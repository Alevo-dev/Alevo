"use client";

import { useState } from "react";
import Link from "next/link";
import { appLinks } from "@/lib/site";

const GRAD = "linear-gradient(120deg,#38b6ff,#a06bff)";

const Check = ({ color }: { color: string }) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 2 }}><polyline points="20 6 9 17 4 12" /></svg>
);

const tiers = [
  {
    name: "Starter",
    blurb: "For small teams that want every inbound lead answered.",
    monthly: "$1,500",
    annual: "$1,200",
    href: appLinks.signup,
    cta: "Start 90-day free trial",
    highlight: false,
    check: "#38b6ff",
    features: ["AI chatbot on your website", "Form lead capture and scoring", "Inbound call answering, 1 number", "500 AI conversations / month", "1,000 emails / month", "1 CRM and 1 calendar integration", "Email support"],
  },
  {
    name: "Growth",
    blurb: "Inbound and outbound together, with calling and sequences.",
    monthly: "$2,500",
    annual: "$2,000",
    href: appLinks.signup,
    cta: "Start 90-day free trial",
    highlight: true,
    check: "#8f8cff",
    features: ["Everything in Starter", "2,500 AI conversations / month", "AI cold calling, 1,000 minutes", "10,000 emails with sequences for new and existing customers", "Unlimited CRM and booking integrations", "Custom voice, persona and playbooks", "Live transfer and rep handoff rules", "Analytics and call recordings"],
  },
  {
    name: "Enterprise",
    blurb: "For revenue teams with high volume, compliance and custom needs.",
    monthly: "Custom",
    annual: "Custom",
    href: "/contact",
    cta: "Talk to sales",
    highlight: false,
    check: "#a06bff",
    features: ["Everything in Growth", "Unlimited conversations and custom call volume", "Dedicated phone numbers and local presence", "Custom integrations, API and webhooks", "SSO / SAML and role-based access", "SOC 2 report and data residency options", "Dedicated success manager and SLA"],
  },
];

export function PricingCards() {
  const [annual, setAnnual] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 40 }}>
        <div style={{ position: "relative", display: "flex", padding: 4, borderRadius: 999, border: "1px solid rgba(var(--ink),.1)", background: "rgba(var(--ink),.03)" }}>
          <span style={{ position: "absolute", top: 4, bottom: 4, width: "calc(50% - 4px)", borderRadius: 999, background: "var(--text)", transition: "left .35s cubic-bezier(.3,.8,.3,1)", left: annual ? "50%" : 4 }} />
          <button onClick={() => setAnnual(false)} style={{ position: "relative", border: 0, background: "transparent", cursor: "pointer", padding: "9px 18px", minWidth: 130, fontSize: 14, fontWeight: 500, borderRadius: 999, transition: "color .3s", color: annual ? "var(--muted)" : "var(--bg)" }}>Monthly</button>
          <button onClick={() => setAnnual(true)} style={{ position: "relative", border: 0, background: "transparent", cursor: "pointer", padding: "9px 18px", minWidth: 130, fontSize: 14, fontWeight: 500, borderRadius: 999, transition: "color .3s", color: annual ? "var(--bg)" : "var(--muted)" }}>Annual −20%</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 20, alignItems: "stretch" }}>
        {tiers.map((t) => {
          const custom = t.monthly === "Custom";
          const price = annual ? t.annual : t.monthly;
          const body = (
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em" }}>{t.name}</span>
                {t.highlight ? <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".1em", padding: "5px 10px", borderRadius: 999, color: "#06070b", background: GRAD }}>MOST POPULAR</span> : null}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)", margin: "8px 0 0", minHeight: 44 }}>{t.blurb}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 24 }}>
                <span style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-.05em", fontVariantNumeric: "tabular-nums" }}>{price}</span>
                {!custom ? <span style={{ fontSize: 14, color: "var(--dim)" }}>/ month</span> : null}
              </div>
              <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 4 }}>{custom ? "Volume-based pricing" : annual ? "Billed annually" : "Billed monthly"}</div>
              <Link href={t.href} className={t.highlight ? "btn-grad-sm" : "btn-outline"} style={{ marginTop: 28, display: "flex", justifyContent: "center", padding: 13, borderRadius: 999, fontWeight: t.highlight ? 600 : 500, fontSize: 15, ...(t.highlight ? { color: "#06070b", background: GRAD } : { border: "1px solid rgba(var(--ink),.16)", color: "var(--text)" }) }}>{t.cta}</Link>
              <div style={{ height: 1, background: "rgba(var(--ink),.07)", margin: "28px 0 22px" }} />
              {t.features.map((f) => (
                <div key={f} style={{ display: "flex", gap: 12, fontSize: 14.5, lineHeight: 1.45, color: "var(--text2)", padding: "6px 0" }}><Check color={t.check} />{f}</div>
              ))}
            </>
          );
          return t.highlight ? (
            <div key={t.name} style={{ position: "relative", borderRadius: 22, padding: 1, background: "linear-gradient(150deg,#38b6ff,rgba(var(--ink),.06) 45%,#a06bff)", boxShadow: "0 30px 90px rgba(100,110,255,.18)" }}>
              <div style={{ height: "100%", borderRadius: 21, background: "linear-gradient(180deg,var(--cardhi),var(--panel))", padding: 31, display: "flex", flexDirection: "column" }}>{body}</div>
            </div>
          ) : (
            <div key={t.name} style={{ borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 32, display: "flex", flexDirection: "column" }}>{body}</div>
          );
        })}
      </div>

      <p style={{ textAlign: "center", marginTop: 28, fontSize: 14, color: "var(--muted)" }}>
        Every paid plan starts with a 90-day free trial — you only pay once Alevo is booking meetings.
      </p>
    </div>
  );
}
