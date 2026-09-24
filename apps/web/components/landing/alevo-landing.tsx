/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTheme } from "next-themes";
import {
  siHubspot,
  siZoho,
  siCalendly,
  siCaldotcom,
  siGooglecalendar,
} from "simple-icons";
import { useTick, useReveal } from "./hooks";
import "./styles.css";

const GRAD = "linear-gradient(120deg,#38b6ff,#a06bff)";
const LOGO = "/uploads/logo1.png";
const pad2 = (n: number) => String(n).padStart(2, "0");

const ArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
);
const Check = ({ size = 16, color = "#3ddc97", w = 2.4 }: { size?: number; color?: string; w?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
);
const Phone = ({ color = "#38b6ff", size = 20 }: { color?: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
);

// Integration brand marks — real logos where available (simple-icons), else a
// brand-colored monogram. Rendered on a white badge so they read in both themes.
type Brand = { hex: string; path?: string };
const BRAND: Record<string, Brand> = {
  Salesforce: { hex: "#00A1E0" },
  HubSpot: { hex: `#${siHubspot.hex}`, path: siHubspot.path },
  Pipedrive: { hex: "#1FA363" },
  "Zoho CRM": { hex: `#${siZoho.hex}`, path: siZoho.path },
  Close: { hex: "#4361EE" },
  Calendly: { hex: `#${siCalendly.hex}`, path: siCalendly.path },
  "Cal.com": { hex: `#${siCaldotcom.hex}`, path: siCaldotcom.path },
  "Google Calendar": { hex: `#${siGooglecalendar.hex}`, path: siGooglecalendar.path },
  Outlook: { hex: "#0078D4" },
  Acuity: { hex: "#2B6CB0" },
};
function BrandBadge({ name, size = 24 }: { name: string; size?: number }) {
  const b = BRAND[name] ?? { hex: "#64748b" };
  const icon = Math.round(size * 0.58);
  const base: CSSProperties = { flex: "none", width: size, height: size, borderRadius: Math.round(size * 0.28), display: "flex", alignItems: "center", justifyContent: "center" };
  if (b.path) {
    return (
      <span title={name} style={{ ...base, background: "#fff", border: "1px solid rgba(0,0,0,.06)" }}>
        <svg width={icon} height={icon} viewBox="0 0 24 24" fill={b.hex}><path d={b.path} /></svg>
      </span>
    );
  }
  return <span title={name} style={{ ...base, background: b.hex, color: "#fff", fontSize: Math.round(size * 0.42), fontWeight: 700 }}>{name.charAt(0)}</span>;
}

export function AlevoLanding() {
  const root = useRef<HTMLDivElement>(null);
  const { t, motion } = useTick();
  useReveal(root);
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const [annual, setAnnual] = useState(false);
  const [faq, setFaq] = useState(0);

  const cyc = (n: number) => (motion ? t % n : n - 1);
  const play = motion ? "running" : "paused";

  /* --- feed --- */
  const events = (
    [
      ["CHAT", "in", "Answered pricing question for a visitor from Austin", "now"],
      ["CALL", "in", "Picked up (415) 555-0142 · qualified, booked demo", "12s"],
      ["EMAIL", "out", "Renewal offer sent to Luis Ortega at Brightline", "31s"],
      ["CRM", "sync", "Deal moved to Meeting Set in HubSpot", "44s"],
      ["FORM", "in", "New quote request from Northpeak Logistics · score 92", "1m"],
      ["COLD CALL", "out", "Booked Thu 2:30pm with ops lead at Crestway", "2m"],
      ["BOOKING", "sync", "Calendly event created, invite sent", "2m"],
      ["EMAIL", "out", "Step 2 of sequence sent to 48 new prospects", "3m"],
      ["CHAT", "in", "Handed hot lead to Sam with full transcript", "4m"],
      ["COLD CALL", "out", "Voicemail left for Priya Nair · follow-up queued", "5m"],
    ] as const
  ).map(([ch, k, text, time]) => ({ ch, text, time, inb: k === "in", outb: k === "out", sync: k === "sync" }));
  const feed = [...events, ...events];

  /* --- inbound: chat --- */
  const cs = cyc(9);
  const chat = (
    [
      ["u", 1, "Hi! Do you offer same-week installs?"],
      ["a", 3, "We do. Thursday and Friday are open this week. What zip code is the install for?"],
      ["u", 4, "94107"],
      ["a", 6, "You're in our service area. Want me to hold Thursday at 10:00am?"],
      ["s", 7, "Booked Thu 10:00am · synced to HubSpot"],
    ] as const
  ).map(([k, at, text]) => ({ text, show: cs >= at, isU: k === "u", isA: k === "a", isS: k === "s" }));
  const chatTyping = cs === 2 || cs === 5;

  /* --- inbound: form --- */
  const fs = cyc(8);
  const formFields = (
    [
      ["Full name", "Dana Whitfield"],
      ["Work email", "dana@northpeak.co"],
      ["Company", "Northpeak Logistics"],
      ["What do you need?", "Fleet tracking for 40 vans"],
    ] as const
  ).map(([label, value], i) => ({ label, value, filled: fs >= i + 1 }));
  const formDone = fs >= 5;
  const formFollow = fs >= 6;

  /* --- inbound: call --- */
  const ks = cyc(9);
  const secs = 3 + ks * 5;
  const callLines = (
    [
      ["CALLER", 1, "Hi, I'm calling about pricing for the Growth plan."],
      ["ALEVO", 3, "Happy to help. How many locations would you use it for?"],
      ["CALLER", 5, "Three, and we get about 200 calls a week."],
      ["ALEVO", 7, "Growth fits well. I can book a walkthrough with Sam tomorrow at 11. Does that work?"],
    ] as const
  ).map(([who, at, text]) => ({ who, text, show: ks >= at }));

  /* --- outbound: emails --- */
  const es = cyc(8);
  const statuses = ["DRAFTING", "SENT", "OPENED", "REPLIED"];
  const emails = (
    [
      ["MC", "Maya Chen", "New lead", "Your quote for 40 vehicles, plus two install dates"],
      ["LO", "Luis Ortega", "Customer", "Your renewal and a loyalty upgrade"],
      ["PN", "Priya Nair", "Prospect", "An idea for Crestway's dispatch team"],
      ["TB", "Tom Becker", "Customer", "Checking in 30 days after onboarding"],
    ] as const
  ).map(([initials, name, seg, subject], i) => {
    const st = Math.max(0, Math.min(3, es - i));
    const replied = st === 3 && i !== 2;
    return { initials, name, seg, subject, status: i === 2 && es - 2 >= 3 ? "OPENED" : statuses[st], replied, pending: !replied };
  });

  /* --- outbound: calls --- */
  const ls = cyc(10);
  const cur = Math.floor(ls / 2);
  const calls = (
    [
      ["Jordan Ellis", "VP Operations · Crestway Freight", "Meeting booked · Thu 2:30pm", true],
      ["Priya Nair", "Dispatch Manager · Halcyon Haul", "Voicemail left", false],
      ["Marcus Webb", "COO · Ridgeline Movers", "Interested · deck sent", true],
      ["Elena Park", "Fleet Director · Summit Cargo", "Call back Tue 9am", false],
    ] as const
  ).map(([name, co, outcome, good], i) => ({
    name, co, outcome, queued: i > cur, dialing: i === cur, won: i < cur && good, other: i < cur && !good,
    bg: i === cur ? "rgba(160,107,255,.07)" : "transparent",
  }));

  const crms = ["Salesforce", "HubSpot", "Pipedrive", "Zoho CRM", "Close"];
  const bookings = ["Calendly", "Cal.com", "Google Calendar", "Outlook", "Acuity"];
  const syncBase = [
    "Contact created in Salesforce", "Meeting booked in Google Calendar", "Deal stage updated in HubSpot",
    "Call notes logged to Pipedrive", "Rescheduled via Cal.com", "Lead owner assigned in Zoho CRM",
    "Outlook invite sent", "Renewal date updated in Close", "Acuity appointment confirmed",
  ];
  const syncLog = [...syncBase, ...syncBase];

  const convos = (1284 + t * 3).toLocaleString("en-US");
  const meetings = 47 + Math.floor(t / 4);

  const faqs = [
    ["Does it sound like a robot on the phone?", "No. Alevo uses a natural voice with realistic pacing and can be interrupted mid-sentence. You choose the voice, name and tone, and it always discloses it is an AI assistant where required."],
    ["Which CRMs and booking tools do you support?", "Salesforce, HubSpot, Pipedrive, Zoho CRM and Close, plus Calendly, Cal.com, Google Calendar, Outlook and Acuity. Enterprise plans include custom integrations through our API and webhooks."],
    ["Can it email existing customers, not only new leads?", "Yes. Alevo reads account history from your CRM to send renewals, upsell offers, onboarding check-ins and win-back messages, and it pauses automatically when a customer replies."],
    ["How long does setup take?", "Most teams go live in under a day. Connect your tools, upload your playbook and FAQs, and review a few test conversations before switching it on."],
    ["What happens when a lead needs a human?", "You set the handoff rules. Alevo can live-transfer calls, notify a rep in Slack or email, or book time on their calendar with the full transcript attached."],
  ];

  const cur_theme = mounted ? theme ?? "system" : "system";
  const themeBtns: { key: "light" | "dark" | "system"; label: string; icon: React.ReactNode }[] = [
    { key: "light", label: "Light", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg> },
    { key: "dark", label: "Dark", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg> },
    { key: "system", label: "System", icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><path d="M8 21h8M12 17v4" /></svg> },
  ];

  const monoTag: CSSProperties = { flex: "none", width: 74, textAlign: "center", fontSize: 10.5, letterSpacing: ".08em", padding: "5px 0", borderRadius: 6 };
  const inbCard: CSSProperties = { borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 10, display: "flex", flexDirection: "column" };
  const featTitle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, fontSize: 19, fontWeight: 600, letterSpacing: "-.02em" };
  const featP: CSSProperties = { fontSize: 15, lineHeight: 1.6, color: "var(--muted)", margin: "10px 0 0" };
  const chipBox: CSSProperties = { display: "flex", alignItems: "center", gap: 11, padding: "10px 16px", borderRadius: 12, border: "1px solid rgba(var(--ink),.08)", background: "var(--panel2)", fontSize: 14, fontWeight: 500 };

  return (
    <div ref={root} className="alevo">
      {/* HEADER */}
      <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", background: "rgba(var(--bgrgb),.72)", borderBottom: "1px solid rgba(var(--ink),.06)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 32 }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={LOGO} alt="Alevo" style={{ width: 30, height: 30, objectFit: "contain" }} />
            <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-.02em" }}>Alevo</span>
          </a>
          <nav data-navlinks="" style={{ display: "flex", gap: 28, fontSize: 14 }}>
            {[["Inbound", "#inbound"], ["Outbound", "#outbound"], ["Integrations", "#integrations"], ["Pricing", "#pricing"], ["FAQ", "#faq"]].map(([l, h]) => (
              <a key={h} href={h} className="lk-muted">{l}</a>
            ))}
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <div role="group" aria-label="Theme" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, border: "1px solid rgba(var(--ink),.1)", background: "rgba(var(--ink),.03)" }}>
              {themeBtns.map((b) => {
                const on = cur_theme === b.key;
                return (
                  <button key={b.key} onClick={() => setTheme(b.key)} aria-label={b.label} title={b.label} style={{ width: 30, height: 28, border: 0, borderRadius: 999, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .25s,color .25s", background: on ? "var(--text)" : "transparent", color: on ? "var(--bg)" : "var(--muted)" }}>{b.icon}</button>
                );
              })}
            </div>
            <a href="#" data-navlinks="" style={{ fontSize: 14, padding: "9px 14px" }}>Sign in</a>
            <a href="#cta" className="btn-grad-sm" style={{ fontSize: 14, fontWeight: 600, padding: "10px 16px", borderRadius: 999, color: "#06070b", background: GRAD }}>Book a demo</a>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section id="top" style={{ position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(rgba(var(--ink),.07) 1px,transparent 1px)", backgroundSize: "28px 28px", WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 30%,#000 30%,transparent 75%)", maskImage: "radial-gradient(ellipse 70% 60% at 50% 30%,#000 30%,transparent 75%)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 520, height: 520, left: -120, top: -160, borderRadius: "50%", background: "#38b6ff", opacity: 0.13, filter: "blur(120px)", pointerEvents: "none" }} />
        <div style={{ position: "absolute", width: 560, height: 560, right: -160, top: 60, borderRadius: "50%", background: "#a06bff", opacity: 0.14, filter: "blur(130px)", pointerEvents: "none" }} />
        <div style={{ position: "relative", maxWidth: 1200, margin: "0 auto", padding: "96px 24px 110px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,480px),1fr))", gap: 64, alignItems: "center" }}>
          <div data-reveal="">
            <div style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "6px 12px 6px 8px", borderRadius: 999, border: "1px solid rgba(var(--ink),.1)", background: "rgba(var(--ink),.03)", fontSize: 13, color: "var(--text3)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#3ddc97", animation: "pulse 1.6s infinite" }} />
              AI SDR for inbound and outbound
            </div>
            <h1 style={{ fontSize: "clamp(44px,6.2vw,76px)", lineHeight: 1.02, letterSpacing: "-.045em", fontWeight: 600, margin: "24px 0 0", textWrap: "balance" }}>
              Every lead answered. Every follow-up sent. <span style={{ background: "linear-gradient(120deg,#38b6ff 10%,#a06bff 80%)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>On autopilot.</span>
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--muted)", maxWidth: 540, margin: "24px 0 0", textWrap: "pretty" }}>Alevo replies to chats, captures form leads and picks up inbound calls in seconds. Then it works your pipeline with personalized emails and cold calls, and books meetings straight into your calendar and CRM.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 36 }}>
              <a href="#cta" className="btn-grad" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 16, padding: "15px 22px", borderRadius: 999, color: "#06070b", background: GRAD }}>Book a demo <ArrowRight /></a>
              <a href="#pricing" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", fontWeight: 500, fontSize: 16, padding: "15px 22px", borderRadius: 999, border: "1px solid rgba(var(--ink),.14)", color: "var(--text)" }}>Start 90-day free trial</a>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 28, marginTop: 44, fontSize: 14, color: "var(--dim)" }}>
              {["Live in under a day", "Works with your CRM", "90-day free trial"].map((x) => (
                <div key={x} style={{ display: "flex", alignItems: "center", gap: 8 }}><Check />{x}</div>
              ))}
            </div>
          </div>

          {/* agent panel */}
          <div data-reveal="" style={{ position: "relative" }}>
            <div style={{ position: "absolute", inset: -1, borderRadius: 24, background: "linear-gradient(140deg,rgba(56,182,255,.55),rgba(var(--ink),.04) 40%,rgba(160,107,255,.55))", pointerEvents: "none" }} />
            <div style={{ position: "relative", borderRadius: 23, background: "var(--panel2)", margin: 1, overflow: "hidden", boxShadow: "0 40px 120px var(--shadow)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 20px", borderBottom: "1px solid rgba(var(--ink),.06)" }}>
                <img src={LOGO} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
                <span style={{ fontSize: 14, fontWeight: 600 }}>Alevo agent</span>
                <span className="mono" style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, fontSize: 11, letterSpacing: ".08em", color: "#3ddc97" }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#3ddc97", animation: "pulse 1.6s infinite" }} />LIVE</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", borderBottom: "1px solid rgba(var(--ink),.06)" }}>
                {[["Conversations today", convos], ["Meetings booked", meetings], ["Avg. first reply", "0.8s"]].map(([lbl, val], i) => (
                  <div key={i} style={{ padding: "18px 20px", borderRight: i < 2 ? "1px solid rgba(var(--ink),.06)" : undefined }}>
                    <div style={{ fontSize: 12, color: "var(--dim)" }}>{lbl}</div>
                    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.03em", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>{val}</div>
                  </div>
                ))}
              </div>
              <div style={{ height: 340, overflow: "hidden", WebkitMaskImage: "linear-gradient(transparent,#000 12%,#000 82%,transparent)", maskImage: "linear-gradient(transparent,#000 12%,#000 82%,transparent)" }}>
                <div style={{ animation: "feedUp 30s linear infinite", animationPlayState: play }}>
                  {feed.map((e, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid rgba(var(--ink),.04)" }}>
                      <span className="mono" style={{ ...monoTag, color: e.inb ? "var(--blue-t)" : e.outb ? "var(--violet-t)" : "var(--green-t)", background: e.inb ? "rgba(56,182,255,.1)" : e.outb ? "rgba(160,107,255,.1)" : "rgba(61,220,151,.1)", border: `1px solid ${e.inb ? "rgba(56,182,255,.22)" : e.outb ? "rgba(160,107,255,.24)" : "rgba(61,220,151,.24)"}` }}>{e.ch}</span>
                      <span style={{ fontSize: 14, color: "var(--text2)", flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.text}</span>
                      <span className="mono" style={{ fontSize: 11, color: "var(--dim2)", flex: "none" }}>{e.time}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* INBOUND */}
      <section id="inbound" style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 24px 60px" }}>
        <div data-reveal="" style={{ maxWidth: 720 }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#38b6ff" }}>01 · INBOUND</div>
          <h2 style={{ fontSize: "clamp(34px,4.4vw,54px)", lineHeight: 1.05, letterSpacing: "-.04em", fontWeight: 600, margin: "16px 0 0", textWrap: "balance" }}>Answers in seconds, on every channel your buyers use.</h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "var(--muted)", margin: "18px 0 0", textWrap: "pretty" }}>Website chat, form fills and phone calls all land with the same agent. It qualifies, answers questions from your playbook, and books the meeting before the lead goes cold.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,340px),1fr))", gap: 20, marginTop: 56 }}>
          {/* chat card */}
          <div data-reveal="" className="card-blue" style={inbCard}>
            <div style={{ height: 360, borderRadius: 14, background: "var(--panel)", border: "1px solid rgba(var(--ink),.05)", padding: 16, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: "1px solid rgba(var(--ink),.06)", fontSize: 12, color: "var(--dim)" }}>
                <img src={LOGO} alt="" style={{ width: 18, height: 18, objectFit: "contain" }} />Chat · yoursite.com
              </div>
              {chat.map((m, i) => !m.show ? null : m.isU ? (
                <div key={i} style={{ alignSelf: "flex-end", maxWidth: "80%", padding: "9px 13px", borderRadius: "14px 14px 4px 14px", background: "var(--bubble)", fontSize: 13.5, lineHeight: 1.45, color: "var(--text)", animation: "rise .45s cubic-bezier(.2,.7,.2,1) both" }}>{m.text}</div>
              ) : m.isA ? (
                <div key={i} style={{ alignSelf: "flex-start", maxWidth: "84%", padding: "9px 13px", borderRadius: "14px 14px 14px 4px", background: "linear-gradient(120deg,rgba(56,182,255,.2),rgba(160,107,255,.2))", border: "1px solid rgba(140,150,255,.22)", fontSize: 13.5, lineHeight: 1.45, color: "var(--text)", animation: "rise .45s cubic-bezier(.2,.7,.2,1) both" }}>{m.text}</div>
              ) : (
                <div key={i} style={{ alignSelf: "center", display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, background: "rgba(61,220,151,.1)", border: "1px solid rgba(61,220,151,.25)", fontSize: 12, color: "var(--green-t)", animation: "rise .45s cubic-bezier(.2,.7,.2,1) both" }}><Check size={13} color="currentColor" w={2.6} />{m.text}</div>
              ))}
              {chatTyping && (
                <div style={{ alignSelf: "flex-start", display: "flex", gap: 4, padding: "12px 14px", borderRadius: "14px 14px 14px 4px", background: "rgba(160,107,255,.12)", animation: "rise .3s both" }}>
                  {[0, 0.15, 0.3].map((d) => <span key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: "#b9a0ff", animation: `blink 1s ${d}s infinite` }} />)}
                </div>
              )}
            </div>
            <div style={{ padding: "22px 14px 14px" }}>
              <div style={featTitle}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38b6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>Chatbot messaging</div>
              <p style={featP}>Replies to website visitors instantly, answers product and pricing questions, qualifies intent and books the call inside the chat window.</p>
            </div>
          </div>

          {/* form card */}
          <div data-reveal="" className="card-blue" style={inbCard}>
            <div style={{ height: 360, borderRadius: 14, background: "var(--panel)", border: "1px solid rgba(var(--ink),.05)", padding: 16, display: "flex", flexDirection: "column", gap: 10, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 10, borderBottom: "1px solid rgba(var(--ink),.06)", fontSize: 12, color: "var(--dim)" }}>Request a quote · web form</div>
              {formFields.map((f, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>{f.label}</span>
                  <div style={{ height: 34, borderRadius: 8, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.02)", padding: "0 11px", display: "flex", alignItems: "center", fontSize: 13, color: "var(--text)", overflow: "hidden", whiteSpace: "nowrap" }}>
                    {f.filled && <span style={{ animation: "rise .4s both" }}>{f.value}</span>}
                  </div>
                </div>
              ))}
              {formDone && (
                <div style={{ marginTop: 4, borderRadius: 10, padding: "11px 12px", background: "rgba(61,220,151,.08)", border: "1px solid rgba(61,220,151,.22)", display: "flex", flexDirection: "column", gap: 6, animation: "rise .45s both" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5, color: "var(--green-t)", fontWeight: 500 }}><span>Lead captured and qualified</span><span className="mono">SCORE 92</span></div>
                  {formFollow && <div style={{ fontSize: 12, color: "var(--text3)", animation: "rise .4s both" }}>Enriched · created in CRM · follow-up email sent in 14s</div>}
                </div>
              )}
            </div>
            <div style={{ padding: "22px 14px 14px" }}>
              <div style={featTitle}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#38b6ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /></svg>Form lead capture</div>
              <p style={featP}>Every form submission is enriched, scored and logged to your CRM, then followed up by email or call while the buyer is still on your site.</p>
            </div>
          </div>

          {/* call card */}
          <div data-reveal="" className="card-blue" style={inbCard}>
            <div style={{ height: 360, borderRadius: 14, background: "var(--panel)", border: "1px solid rgba(var(--ink),.05)", padding: 16, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingBottom: 10, borderBottom: "1px solid rgba(var(--ink),.06)" }}>
                <span style={{ position: "relative", width: 30, height: 30, borderRadius: "50%", background: "rgba(61,220,151,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid #3ddc97", animation: "ring 1.8s infinite" }} />
                  <Phone color="#3ddc97" size={14} />
                </span>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Inbound call · (415) 555-0142</span>
                  <span style={{ fontSize: 11, color: "var(--dim)" }}>Answered on first ring</span>
                </div>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "#3ddc97", fontVariantNumeric: "tabular-nums" }}>00:{pad2(secs)}</span>
              </div>
              <div style={{ padding: "4px 0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 3, height: 44 }}>
                  {Array.from({ length: 40 }, (_, i) => (
                    <span key={i} style={{ flex: 1, borderRadius: 2, height: `${40 + ((i * 37) % 60)}%`, background: i % 2 ? "#38b6ff" : "#a06bff", transform: "scaleY(.3)", animation: `wave ${0.8 + (i % 5) * 0.14}s ease-in-out ${-(i * 0.09).toFixed(2)}s infinite`, animationPlayState: play }} />
                  ))}
                </div>
              </div>
              {callLines.map((l, i) => !l.show ? null : (
                <div key={i} style={{ display: "flex", gap: 10, fontSize: 12.5, lineHeight: 1.45, animation: "rise .45s both" }}>
                  <span className="mono" style={{ flex: "none", width: 48, fontSize: 10.5, paddingTop: 2, color: "var(--dim)" }}>{l.who}</span>
                  <span style={{ color: "var(--text2)" }}>{l.text}</span>
                </div>
              ))}
            </div>
            <div style={{ padding: "22px 14px 14px" }}>
              <div style={featTitle}><Phone />Answers inbound calls</div>
              <p style={featP}>A natural-sounding voice agent picks up 24/7, handles questions, qualifies the caller and books time or transfers live to your team.</p>
            </div>
          </div>
        </div>
      </section>

      {/* OUTBOUND */}
      <section id="outbound" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div data-reveal="" style={{ maxWidth: 720 }}>
          <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#a06bff" }}>02 · OUTBOUND</div>
          <h2 style={{ fontSize: "clamp(34px,4.4vw,54px)", lineHeight: 1.05, letterSpacing: "-.04em", fontWeight: 600, margin: "16px 0 0", textWrap: "balance" }}>Pipeline that builds itself while your team sleeps.</h2>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: "var(--muted)", margin: "18px 0 0", textWrap: "pretty" }}>Alevo writes and sends personalized emails to new prospects and existing customers, and makes cold calls from your lists. Replies and outcomes flow straight back into your CRM.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,460px),1fr))", gap: 20, marginTop: 56 }}>
          {/* emails */}
          <div data-reveal="" className="card-violet" style={{ borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 10 }}>
            <div style={{ borderRadius: 14, background: "var(--panel)", border: "1px solid rgba(var(--ink),.05)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(var(--ink),.06)", fontSize: 12, color: "var(--dim)" }}>
                <span>Email sequences · today</span><span className="mono">4 of 312</span>
              </div>
              {emails.map((m, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderBottom: "1px solid rgba(var(--ink),.04)" }}>
                  <span style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", background: "var(--bubble)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--text3)" }}>{m.initials}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 500 }}>{m.name}<span style={{ fontSize: 11, fontWeight: 400, color: "var(--dim)" }}>{m.seg}</span></div>
                    <div style={{ fontSize: 13, color: "var(--muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 2 }}>{m.subject}</div>
                  </div>
                  {m.replied ? (
                    <span className="mono" style={{ flex: "none", fontSize: 10.5, letterSpacing: ".06em", padding: "5px 9px", borderRadius: 6, color: "var(--green-t)", background: "rgba(61,220,151,.1)", border: "1px solid rgba(61,220,151,.25)", animation: "rise .35s both" }}>REPLIED</span>
                  ) : (
                    <span className="mono" style={{ flex: "none", fontSize: 10.5, letterSpacing: ".06em", padding: "5px 9px", borderRadius: 6, color: "var(--violet-t)", background: "rgba(160,107,255,.08)", border: "1px solid rgba(160,107,255,.2)" }}>{m.status}</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ padding: "22px 14px 14px" }}>
              <div style={featTitle}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a06bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>Emails to new and existing customers</div>
              <p style={featP}>Cold sequences for new prospects, plus renewals, upsells and check-ins for current customers. Each message is written from CRM history and stops automatically on reply.</p>
            </div>
          </div>

          {/* cold calling */}
          <div data-reveal="" className="card-violet" style={{ borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 10 }}>
            <div style={{ borderRadius: 14, background: "var(--panel)", border: "1px solid rgba(var(--ink),.05)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(var(--ink),.06)", fontSize: 12, color: "var(--dim)" }}>
                <span>Call list · Q4 logistics accounts</span><span className="mono">AUTO-DIALER</span>
              </div>
              {calls.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "15px 18px", borderBottom: "1px solid rgba(var(--ink),.04)", transition: "background .4s", background: c.bg }}>
                  <span style={{ position: "relative", flex: "none", width: 34, height: 34, borderRadius: "50%", background: "var(--bubble)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {c.dialing && <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px solid #a06bff", animation: "ring 1.2s infinite" }} />}
                    <Phone color="var(--violet-t)" size={14} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 2 }}>{c.co}</div>
                  </div>
                  {c.queued && <span style={{ flex: "none", fontSize: 12, color: "var(--dim2)" }}>Queued</span>}
                  {c.dialing && <span style={{ flex: "none", fontSize: 12, color: "var(--violet-t)" }}>Dialing…</span>}
                  {c.won && <span style={{ flex: "none", fontSize: 12, color: "var(--green-t)", animation: "rise .35s both" }}>{c.outcome}</span>}
                  {c.other && <span style={{ flex: "none", fontSize: 12, color: "var(--text3)", animation: "rise .35s both" }}>{c.outcome}</span>}
                </div>
              ))}
            </div>
            <div style={{ padding: "22px 14px 14px" }}>
              <div style={featTitle}><Phone color="#a06bff" />AI cold calling</div>
              <p style={featP}>Works through your call lists, handles objections, leaves voicemails and books meetings. Every call is recorded, transcribed and summarized on the contact record.</p>
            </div>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS */}
      <section id="integrations" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}>
        <div data-reveal="" style={{ borderRadius: 28, border: "1px solid rgba(var(--ink),.08)", background: "radial-gradient(ellipse 60% 80% at 50% 0%,rgba(110,140,255,.1),transparent 70%),rgba(var(--ink),.02)", padding: "clamp(28px,5vw,64px)", overflow: "hidden" }}>
          <div style={{ maxWidth: 680 }}>
            <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#3ddc97" }}>03 · INTEGRATIONS</div>
            <h2 style={{ fontSize: "clamp(34px,4.4vw,54px)", lineHeight: 1.05, letterSpacing: "-.04em", fontWeight: 600, margin: "16px 0 0", textWrap: "balance" }}>Plugs into the CRM and calendar you already run.</h2>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: "var(--muted)", margin: "18px 0 0", textWrap: "pretty" }}>Two-way sync keeps contacts, deal stages, notes and bookings current. Alevo checks real availability before it offers a time, and reschedules or cancels when buyers ask.</p>
          </div>
          <div className="intg-flow">
            <div className="intg-col">
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--dim)", marginBottom: 4 }}>CRM</span>
              {crms.map((n) => (
                <div key={n} className="chip-blue" style={chipBox}>
                  <BrandBadge name={n} />
                  {n}
                </div>
              ))}
            </div>
            <div className="intg-row">
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--dim)" }}>CRM</span>
              <div className="intg-row-icons">{crms.map((n) => <BrandBadge key={n} name={n} size={42} />)}</div>
            </div>
            <div className="intg-line blue">
              <span className="flow-dot" />
              <span className="flow-dot d2" />
            </div>
            <div style={{ position: "relative", width: 150, height: 150, flex: "none", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "1px dashed rgba(var(--ink),.14)", animation: "spin 30s linear infinite", animationPlayState: play }} />
              <span style={{ position: "absolute", inset: 18, borderRadius: "50%", background: "radial-gradient(circle,rgba(110,140,255,.25),transparent 70%)" }} />
              <span style={{ position: "relative", width: 88, height: 88, borderRadius: 26, background: "var(--panel2)", border: "1px solid rgba(var(--ink),.12)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 60px rgba(90,120,255,.3)", animation: "float 5s ease-in-out infinite", animationPlayState: play }}>
                <img src={LOGO} alt="Alevo" style={{ width: 52, height: 52, objectFit: "contain" }} />
              </span>
            </div>
            <div className="intg-line violet">
              <span className="flow-dot" />
              <span className="flow-dot d2" />
            </div>
            <div className="intg-col">
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--dim)", marginBottom: 4 }}>BOOKING</span>
              {bookings.map((n) => (
                <div key={n} className="chip-violet" style={chipBox}>
                  <BrandBadge name={n} />
                  {n}
                </div>
              ))}
            </div>
            <div className="intg-row">
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".12em", color: "var(--dim)" }}>BOOKING</span>
              <div className="intg-row-icons">{bookings.map((n) => <BrandBadge key={n} name={n} size={42} />)}</div>
            </div>
          </div>
          <div style={{ marginTop: 48, overflow: "hidden", WebkitMaskImage: "linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)", maskImage: "linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)" }}>
            <div style={{ display: "flex", gap: 12, width: "max-content", animation: "slideX 45s linear infinite", animationPlayState: play }}>
              {syncLog.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderRadius: 999, border: "1px solid rgba(var(--ink),.07)", background: "rgba(var(--ink),.02)", fontSize: 13, color: "var(--text3)", whiteSpace: "nowrap" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3ddc97" }} />{s}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px 80px" }}>
        <div data-reveal="" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,300px),1fr))", borderTop: "1px solid rgba(var(--ink),.08)" }}>
          {[["STEP 1", "#38b6ff", "Connect", "Link your CRM, calendar, phone number and website in a few clicks. No engineering work needed."], ["STEP 2", "#7b91ff", "Train", "Upload your playbook, pricing and FAQs. Set the tone, qualification rules and when to hand off to a rep."], ["STEP 3", "#a06bff", "Launch", "Alevo starts working every channel at once. Your team gets booked meetings and full context on each lead."]].map(([tag, color, title, body]) => (
            <div key={tag} style={{ padding: "32px 28px 0 0" }}>
              <div className="mono" style={{ fontSize: 13, color }}>{tag}</div>
              <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-.03em", marginTop: 14 }}>{title}</div>
              <p style={{ fontSize: 15, lineHeight: 1.6, color: "var(--muted)", margin: "10px 0 0" }}>{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px" }}>
        <div data-reveal="" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 24 }}>
          <div style={{ maxWidth: 620 }}>
            <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#38b6ff" }}>PRICING</div>
            <h2 style={{ fontSize: "clamp(34px,4.4vw,54px)", lineHeight: 1.05, letterSpacing: "-.04em", fontWeight: 600, margin: "16px 0 0" }}>Plans that scale with your pipeline.</h2>
          </div>
          <div style={{ position: "relative", display: "flex", padding: 4, borderRadius: 999, border: "1px solid rgba(var(--ink),.1)", background: "rgba(var(--ink),.03)" }}>
            <span style={{ position: "absolute", top: 4, bottom: 4, width: "calc(50% - 4px)", borderRadius: 999, background: "var(--text)", transition: "left .35s cubic-bezier(.3,.8,.3,1)", left: annual ? "50%" : 4 }} />
            <button onClick={() => setAnnual(false)} style={{ position: "relative", border: 0, background: "transparent", cursor: "pointer", padding: "9px 18px", minWidth: 130, font: "inherit", fontSize: 14, fontWeight: 500, borderRadius: 999, transition: "color .3s", color: annual ? "var(--muted)" : "var(--bg)" }}>Monthly</button>
            <button onClick={() => setAnnual(true)} style={{ position: "relative", border: 0, background: "transparent", cursor: "pointer", padding: "9px 18px", minWidth: 130, font: "inherit", fontSize: 14, fontWeight: 500, borderRadius: 999, transition: "color .3s", color: annual ? "var(--bg)" : "var(--muted)" }}>Annual −20%</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,320px),1fr))", gap: 20, marginTop: 48, alignItems: "stretch" }}>
          {/* starter */}
          <div data-reveal="" style={{ borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 32, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em" }}>Starter</div>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)", margin: "8px 0 0", minHeight: 44 }}>For small teams that want every inbound lead answered.</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 24 }}><span style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-.05em", fontVariantNumeric: "tabular-nums" }}>{annual ? "$1,200" : "$1,500"}</span><span style={{ fontSize: 14, color: "var(--dim)" }}>/ month</span></div>
            <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 4 }}>{annual ? "Billed annually" : "Billed monthly"}</div>
            <a href="#cta" className="btn-outline" style={{ marginTop: 28, display: "flex", justifyContent: "center", padding: 13, borderRadius: 999, border: "1px solid rgba(var(--ink),.16)", fontWeight: 500, fontSize: 15 }}>Start 90-day free trial</a>
            <div style={{ height: 1, background: "rgba(var(--ink),.07)", margin: "28px 0 22px" }} />
            {["AI chatbot on your website", "Form lead capture and scoring", "Inbound call answering, 1 number", "500 AI conversations / month", "1,000 emails / month", "1 CRM and 1 calendar integration", "Email support"].map((f) => (
              <div key={f} style={{ display: "flex", gap: 12, fontSize: 14.5, lineHeight: 1.45, color: "var(--text2)", padding: "6px 0" }}><span style={{ flex: "none", marginTop: 2 }}><Check color="#38b6ff" /></span>{f}</div>
            ))}
          </div>

          {/* growth */}
          <div data-reveal="" style={{ position: "relative", borderRadius: 22, padding: 1, background: "linear-gradient(150deg,#38b6ff,rgba(var(--ink),.06) 45%,#a06bff)", boxShadow: "0 30px 90px rgba(100,110,255,.18)" }}>
            <div style={{ height: "100%", borderRadius: 21, background: "linear-gradient(180deg,var(--cardhi),var(--panel))", padding: 31, display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em" }}>Growth</span>
                <span className="mono" style={{ fontSize: 10.5, letterSpacing: ".1em", padding: "5px 10px", borderRadius: 999, color: "#06070b", background: GRAD }}>MOST POPULAR</span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)", margin: "8px 0 0", minHeight: 44 }}>Inbound and outbound together, with calling and sequences.</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 24 }}><span style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-.05em", fontVariantNumeric: "tabular-nums" }}>{annual ? "$2,000" : "$2,500"}</span><span style={{ fontSize: 14, color: "var(--dim)" }}>/ month</span></div>
              <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 4 }}>{annual ? "Billed annually" : "Billed monthly"}</div>
              <a href="#cta" className="btn-grad-sm" style={{ marginTop: 28, display: "flex", justifyContent: "center", padding: 13, borderRadius: 999, fontWeight: 600, fontSize: 15, color: "#06070b", background: GRAD }}>Start 90-day free trial</a>
              <div style={{ height: 1, background: "rgba(var(--ink),.07)", margin: "28px 0 22px" }} />
              {["Everything in Starter", "2,500 AI conversations / month", "AI cold calling, 1,000 minutes", "10,000 emails with sequences for new and existing customers", "Unlimited CRM and booking integrations", "Custom voice, persona and playbooks", "Live transfer and rep handoff rules", "Analytics and call recordings"].map((f) => (
                <div key={f} style={{ display: "flex", gap: 12, fontSize: 14.5, lineHeight: 1.45, color: "var(--text2)", padding: "6px 0" }}><span style={{ flex: "none", marginTop: 2 }}><Check color="#8f8cff" /></span>{f}</div>
              ))}
            </div>
          </div>

          {/* enterprise */}
          <div data-reveal="" style={{ borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 32, display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: "-.02em" }}>Enterprise</div>
            <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--muted)", margin: "8px 0 0", minHeight: 44 }}>For revenue teams with high volume, compliance and custom needs.</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 24 }}><span style={{ fontSize: 52, fontWeight: 600, letterSpacing: "-.05em" }}>Custom</span></div>
            <div style={{ fontSize: 13, color: "var(--dim)", marginTop: 4 }}>Volume-based pricing</div>
            <a href="#cta" className="btn-outline" style={{ marginTop: 28, display: "flex", justifyContent: "center", padding: 13, borderRadius: 999, border: "1px solid rgba(var(--ink),.16)", fontWeight: 500, fontSize: 15 }}>Talk to sales</a>
            <div style={{ height: 1, background: "rgba(var(--ink),.07)", margin: "28px 0 22px" }} />
            {["Everything in Growth", "Unlimited conversations and custom call volume", "Dedicated phone numbers and local presence", "Custom integrations, API and webhooks", "SSO / SAML and role-based access", "SOC 2 report and data residency options", "Dedicated success manager and SLA"].map((f) => (
              <div key={f} style={{ display: "flex", gap: 12, fontSize: 14.5, lineHeight: 1.45, color: "var(--text2)", padding: "6px 0" }}><span style={{ flex: "none", marginTop: 2 }}><Check color="#a06bff" /></span>{f}</div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" style={{ maxWidth: 1200, margin: "0 auto", padding: "80px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,380px),1fr))", gap: 48 }}>
        <div data-reveal="">
          <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: "#a06bff" }}>FAQ</div>
          <h2 style={{ fontSize: "clamp(34px,4.4vw,54px)", lineHeight: 1.05, letterSpacing: "-.04em", fontWeight: 600, margin: "16px 0 0" }}>Questions, answered.</h2>
        </div>
        <div data-reveal="" style={{ borderTop: "1px solid rgba(var(--ink),.08)" }}>
          {faqs.map(([q, a], i) => (
            <div key={i} style={{ borderBottom: "1px solid rgba(var(--ink),.08)" }}>
              <button onClick={() => setFaq((v) => (v === i ? -1 : i))} style={{ width: "100%", display: "flex", alignItems: "center", gap: 16, justifyContent: "space-between", textAlign: "left", background: "none", border: 0, color: "var(--text)", font: "inherit", fontSize: 18, fontWeight: 500, letterSpacing: "-.01em", padding: "22px 0", cursor: "pointer" }}>
                {q}
                <span style={{ flex: "none", width: 28, height: 28, borderRadius: "50%", border: "1px solid rgba(var(--ink),.14)", display: "flex", alignItems: "center", justifyContent: "center", transition: "transform .3s", transform: faq === i ? "rotate(45deg)" : "rotate(0deg)" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                </span>
              </button>
              {faq === i && <p style={{ margin: 0, padding: "0 48px 24px 0", fontSize: 15.5, lineHeight: 1.65, color: "var(--muted)", animation: "rise .35s both" }}>{a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="cta" style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px 100px" }}>
        <div data-reveal="" style={{ position: "relative", overflow: "hidden", borderRadius: 32, padding: "clamp(40px,7vw,96px)", background: "linear-gradient(125deg,#1583d6,#5a63e8 50%,#8a4fe6)" }}>
          <img src={LOGO} alt="" style={{ position: "absolute", right: -60, bottom: -80, width: 420, opacity: 0.16, pointerEvents: "none", animation: "float 7s ease-in-out infinite", animationPlayState: play }} />
          <h2 style={{ position: "relative", fontSize: "clamp(36px,5.2vw,68px)", lineHeight: 1.02, letterSpacing: "-.045em", fontWeight: 600, margin: 0, maxWidth: 760, color: "#ffffff", textWrap: "balance" }}>Give every lead a reply in under a second.</h2>
          <p style={{ position: "relative", fontSize: 19, lineHeight: 1.55, color: "#ffffff", margin: "22px 0 0", maxWidth: 520 }}>See Alevo handle your real inbound and outbound flows in a 20-minute demo.</p>
          <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 12, marginTop: 36 }}>
            <a href="#" className="btn-dark" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontWeight: 600, fontSize: 16, padding: "15px 24px", borderRadius: 999, background: "#0b1224", color: "#ffffff" }}>Book a demo <ArrowRight /></a>
            <a href="#pricing" className="btn-glass" style={{ display: "inline-flex", alignItems: "center", fontWeight: 500, fontSize: 16, padding: "15px 24px", borderRadius: 999, border: "1px solid rgba(255,255,255,.55)", color: "#ffffff" }}>Start 90-day free trial</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(var(--ink),.06)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "var(--dim)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}><img src={LOGO} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} /><span style={{ color: "var(--text)", fontWeight: 600 }}>Alevo</span><span>© 2026</span></div>
          <div style={{ display: "flex", gap: 24 }}>
            {["Privacy", "Terms", "Security", "Contact"].map((l) => <a key={l} href="#" className="lk-dim">{l}</a>)}
          </div>
        </div>
      </footer>
    </div>
  );
}
