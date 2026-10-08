/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import "./styles.css";
import { appLinks } from "@/lib/site";

const LOGO = "/uploads/logo1.png";
const GRAD = "linear-gradient(120deg,#38b6ff,#a06bff)";

const NAV: [string, string][] = [
  ["Inbound", "/#inbound"],
  ["Outbound", "/#outbound"],
  ["Integrations", "/#integrations"],
  ["Pricing", "/#pricing"],
  ["FAQ", "/#faq"],
];

const Burger = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
);
const XIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
);
const Sun = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>);
const Moon = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>);
const Monitor = () => (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="3" rx="2" /><path d="M8 21h8M12 17v4" /></svg>);

const THEME_OPTS: [string, ReactNode][] = [
  ["light", <Sun key="l" />],
  ["dark", <Moon key="d" />],
  ["system", <Monitor key="s" />],
];

function ThemeToggle({ w = 30, h = 28 }: { w?: number; h?: number }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  const cur = mounted ? theme ?? "system" : "system";
  return (
    <div role="group" aria-label="Theme" style={{ display: "flex", gap: 2, padding: 3, borderRadius: 999, border: "1px solid rgba(var(--ink),.1)", background: "rgba(var(--ink),.03)" }}>
      {THEME_OPTS.map(([k, icon]) => {
        const on = cur === k;
        return (
          <button key={k} onClick={() => setTheme(k)} aria-label={k} title={k} style={{ width: w, height: h, border: 0, borderRadius: 999, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background .25s,color .25s", background: on ? "var(--text)" : "transparent", color: on ? "var(--bg)" : "var(--muted)" }}>{icon}</button>
        );
      })}
    </div>
  );
}

function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header style={{ position: "sticky", top: 0, zIndex: 50, backdropFilter: "blur(14px)", WebkitBackdropFilter: "blur(14px)", background: "rgba(var(--bgrgb),.72)", borderBottom: "1px solid rgba(var(--ink),.06)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "14px 24px", display: "flex", alignItems: "center", gap: 32 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={LOGO} alt="Alevo" style={{ width: 30, height: 30, objectFit: "contain" }} />
            <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-.02em" }}>Alevo</span>
          </Link>
          <nav data-navlinks="" style={{ display: "flex", gap: 28, fontSize: 14 }}>
            {NAV.map(([l, h]) => (
              <Link key={h} href={h} className="lk-muted">{l}</Link>
            ))}
          </nav>
          <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
            <div className="desk-actions">
              <ThemeToggle />
              <a href={appLinks.login} style={{ fontSize: 14, padding: "9px 14px" }}>Sign in</a>
              <Link href="/contact" className="btn-grad-sm" style={{ fontSize: 14, fontWeight: 600, padding: "10px 16px", borderRadius: 999, color: "#06070b", background: GRAD }}>Book a demo</Link>
            </div>
            <button className="burger" aria-label="Open menu" aria-expanded={open} onClick={() => setOpen(true)}><Burger /></button>
          </div>
        </div>
      </header>

      <div className="menu-wrap" data-open={open}>
        <div className="mobile-menu">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 24px", borderBottom: "1px solid rgba(var(--ink),.06)" }}>
            <Link href="/" onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={LOGO} alt="Alevo" style={{ width: 30, height: 30, objectFit: "contain" }} />
              <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-.02em" }}>Alevo</span>
            </Link>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ThemeToggle w={32} />
              <button aria-label="Close menu" onClick={() => setOpen(false)} style={{ display: "flex", background: "none", border: 0, color: "var(--text)", cursor: "pointer", padding: 6 }}><XIcon /></button>
            </div>
          </div>
          <nav style={{ display: "flex", flexDirection: "column", padding: "10px 24px" }}>
            {NAV.map(([l, h]) => (
              <Link key={h} href={h} onClick={() => setOpen(false)} style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-.02em", padding: "16px 0", color: "var(--text)" }}>{l}</Link>
            ))}
          </nav>
          <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
            <Link href="/contact" onClick={() => setOpen(false)} className="btn-grad" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontWeight: 600, fontSize: 16, padding: "16px 22px", borderRadius: 999, color: "#06070b", background: GRAD }}>Book a demo</Link>
            <a href={appLinks.login} style={{ textAlign: "center", fontSize: 15, color: "var(--muted)" }}>Sign in</a>
          </div>
        </div>
      </div>
    </>
  );
}

function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid rgba(var(--ink),.06)" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px", display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center", justifyContent: "space-between", fontSize: 13, color: "var(--dim)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <img src={LOGO} alt="" style={{ width: 22, height: 22, objectFit: "contain" }} />
          <span style={{ color: "var(--text)", fontWeight: 600 }}>Alevo</span>
          <span>© 2026</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
          <Link href="/privacy" className="lk-dim">Privacy</Link>
          <Link href="/terms" className="lk-dim">Terms</Link>
          <Link href="/security" className="lk-dim">Security</Link>
          <Link href="/contact" className="lk-dim">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

/** Wraps a marketing page in the Alevo design shell (scoped .alevo styles). */
export function AlevoShell({ children }: { children: ReactNode }) {
  return (
    <div className="alevo" style={{ display: "flex", flexDirection: "column", minHeight: "100dvh" }}>
      <SiteHeader />
      <main style={{ flex: 1 }}>{children}</main>
      <SiteFooter />
    </div>
  );
}
