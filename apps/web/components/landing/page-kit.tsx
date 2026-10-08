import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

export const GRAD = "linear-gradient(120deg,#38b6ff,#a06bff)";

export function Container({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", ...style }}>{children}</div>;
}

export function PageHead({
  eyebrow,
  title,
  subtitle,
  accent = "#38b6ff",
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  accent?: string;
}) {
  return (
    <section style={{ position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", width: 520, height: 520, left: -140, top: -180, borderRadius: "50%", background: "#38b6ff", opacity: 0.1, filter: "blur(120px)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", width: 560, height: 560, right: -180, top: 0, borderRadius: "50%", background: "#a06bff", opacity: 0.11, filter: "blur(130px)", pointerEvents: "none" }} />
      <Container style={{ position: "relative", paddingTop: 84, paddingBottom: 8 }}>
        {eyebrow ? <div className="mono" style={{ fontSize: 12, letterSpacing: ".14em", color: accent }}>{eyebrow}</div> : null}
        <h1 style={{ fontSize: "clamp(38px,5.4vw,64px)", lineHeight: 1.03, letterSpacing: "-.045em", fontWeight: 600, margin: "16px 0 0", maxWidth: 900, textWrap: "balance" }}>{title}</h1>
        {subtitle ? <p style={{ fontSize: 19, lineHeight: 1.55, color: "var(--muted)", margin: "20px 0 0", maxWidth: 660, textWrap: "pretty" }}>{subtitle}</p> : null}
      </Container>
    </section>
  );
}

export function Section({ children, id, muted, style }: { children: ReactNode; id?: string; muted?: boolean; style?: CSSProperties }) {
  return (
    <section id={id} style={{ padding: "72px 0", background: muted ? "rgba(var(--ink),.02)" : undefined, ...style }}>
      <Container>{children}</Container>
    </section>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <div style={{ borderRadius: 22, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)", padding: 28, ...style }}>{children}</div>;
}

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38b6ff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: 3 }}><polyline points="20 6 9 17 4 12" /></svg>
);

export function Bullet({ children }: { children: ReactNode }) {
  return <li style={{ display: "flex", gap: 12, fontSize: 15, lineHeight: 1.5, color: "var(--text2)", padding: "6px 0", listStyle: "none" }}><Check />{children}</li>;
}

/** Long-form prose block (legal pages). */
export function Prose({ children }: { children: ReactNode }) {
  return (
    <div className="prose" style={{ maxWidth: 760, color: "var(--text2)", fontSize: 16, lineHeight: 1.7 }}>
      {children}
    </div>
  );
}

/** Shared gradient "book a demo" band used at the foot of pages. */
export function CtaBand({ title = "See Alevo work your pipeline.", subtitle = "A 20-minute demo on your real inbound and outbound flows." }: { title?: string; subtitle?: string }) {
  return (
    <Section>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 32, padding: "clamp(36px,6vw,72px)", background: "linear-gradient(125deg,#1583d6,#5a63e8 50%,#8a4fe6)" }}>
        <h2 style={{ position: "relative", fontSize: "clamp(30px,4.4vw,52px)", lineHeight: 1.05, letterSpacing: "-.04em", fontWeight: 600, margin: 0, maxWidth: 620, color: "#fff", textWrap: "balance" }}>{title}</h2>
        <p style={{ position: "relative", fontSize: 18, lineHeight: 1.55, color: "#fff", margin: "18px 0 0", maxWidth: 480 }}>{subtitle}</p>
        <div style={{ position: "relative", display: "flex", flexWrap: "wrap", gap: 12, marginTop: 30 }}>
          <Link href="/contact" style={{ display: "inline-flex", alignItems: "center", fontWeight: 600, fontSize: 16, padding: "14px 24px", borderRadius: 999, background: "#0b1224", color: "#fff" }}>Book a demo</Link>
        </div>
      </div>
    </Section>
  );
}
