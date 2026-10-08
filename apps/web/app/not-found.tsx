import Link from "next/link";
import "@/components/landing/styles.css";

export default function NotFound() {
  return (
    <div className="alevo" style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ textAlign: "center", maxWidth: 520 }}>
        <div style={{ fontSize: "clamp(72px,14vw,128px)", fontWeight: 600, letterSpacing: "-.05em", lineHeight: 1, backgroundImage: "linear-gradient(120deg,#38b6ff,#a06bff)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>404</div>
        <h1 style={{ fontSize: "clamp(24px,4vw,34px)", fontWeight: 600, letterSpacing: "-.03em", margin: "14px 0 0" }}>This page wandered off.</h1>
        <p style={{ color: "var(--muted)", fontSize: 16, margin: "12px 0 0" }}>The link may be broken, or the page may have moved.</p>
        <Link href="/" style={{ display: "inline-flex", marginTop: 28, padding: "14px 24px", borderRadius: 999, fontWeight: 600, color: "#06070b", background: "linear-gradient(120deg,#38b6ff,#a06bff)" }}>Back home</Link>
      </div>
    </div>
  );
}
