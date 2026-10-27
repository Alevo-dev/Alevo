"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

/**
 * Cookie notice for the marketing site. The choice lives in localStorage and
 * never leaves the browser. There are no optional cookies today; any future
 * analytics script must check `hasAnalyticsConsent()` (or listen for the
 * `alevo:consent` event) before loading, so the banner already gates it.
 */
const KEY = "alevo-cookie-consent";
const EVENT = "alevo:consent";

export type Consent = "accepted" | "declined";

function readConsent(): Consent | null {
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "accepted" || v === "declined" ? v : null;
  } catch {
    return null;
  }
}

function writeConsent(value: Consent) {
  try {
    window.localStorage.setItem(KEY, value);
  } catch {
    /* private mode: the banner shows again next visit, which is the safe default */
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

/** True only after the visitor accepted optional cookies. Safe to call on the server (false). */
export function hasAnalyticsConsent(): boolean {
  return typeof window !== "undefined" && readConsent() === "accepted";
}

function useConsent() {
  const [consent, setConsent] = useState<Consent | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Read after mount: localStorage is not available during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConsent(readConsent());
    setReady(true);
    const onChange = (e: Event) => setConsent((e as CustomEvent<Consent>).detail);
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return { consent, ready, choose: writeConsent };
}

const btn = {
  border: 0,
  cursor: "pointer",
  borderRadius: 999,
  padding: "10px 16px",
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
} as const;

/**
 * One slim bar fixed to the bottom edge of the screen, full width, only as tall
 * as its single line of text. While it is shown the body gets matching bottom
 * padding, so the page footer can still be scrolled fully into view above it.
 * Mounted once in the root layout; the `alevo` class brings the site's theme
 * variables along for every page.
 */
export function CookieBanner() {
  const { consent, ready, choose } = useConsent();
  const open = ready && !consent;
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !barRef.current) return;
    const bar = barRef.current;
    const apply = () => {
      document.body.style.paddingBottom = `${bar.offsetHeight}px`;
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => {
      ro.disconnect();
      document.body.style.paddingBottom = "";
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={barRef}
      role="region"
      aria-label="Cookie notice"
      className="alevo"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 60,
        // `.alevo` carries `min-height: 100dvh` for page shells — not for this bar.
        minHeight: 0,
        borderTop: "1px solid rgba(var(--ink),.1)",
        background: "var(--panel)",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "10px 24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px 24px",
        }}
      >
        <p style={{ flex: "1 1 360px", margin: 0, fontSize: 14, lineHeight: 1.45, color: "var(--text2)" }}>
          We use cookies to keep the site working and remember your preferences. No analytics or advertising cookies.{" "}
          <Link href="/cookies" className="lk-dim" style={{ textDecoration: "underline", whiteSpace: "nowrap" }}>
            Cookie policy
          </Link>
        </p>
        <div style={{ display: "flex", gap: 8, flex: "none" }}>
          <button type="button" onClick={() => choose("declined")} className="btn-ghost" style={{ ...btn, padding: "8px 14px", fontSize: 13.5, background: "transparent", border: "1px solid rgba(var(--ink),.14)", color: "var(--text)", fontWeight: 500 }}>
            Decline
          </button>
          <button type="button" onClick={() => choose("accepted")} style={{ ...btn, padding: "8px 16px", fontSize: 13.5, background: "var(--text)", color: "var(--bg)" }}>
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}

/** Current choice + the two buttons, for the Cookie Policy page. */
export function CookiePreferences() {
  const { consent, ready, choose } = useConsent();
  const label = !ready ? "…" : consent === "accepted" ? "Optional cookies accepted" : consent === "declined" ? "Optional cookies declined" : "No choice saved yet";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, border: "1px solid rgba(var(--ink),.08)", background: "rgba(var(--ink),.025)" }}>
      <span style={{ flex: "1 1 200px", fontSize: 14, color: "var(--text)" }} aria-live="polite">
        {label}
      </span>
      <button type="button" onClick={() => choose("declined")} style={{ ...btn, background: "transparent", border: "1px solid rgba(var(--ink),.14)", color: "var(--text)", fontWeight: 500 }}>
        Decline
      </button>
      <button type="button" onClick={() => choose("accepted")} style={{ ...btn, background: "var(--text)", color: "var(--bg)" }}>
        Accept
      </button>
    </div>
  );
}
