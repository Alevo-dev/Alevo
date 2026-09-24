import { ImageResponse } from "next/og";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px",
          background:
            "radial-gradient(1000px 500px at 20% 0%, #1a1f45 0%, #0a0e1a 55%)",
          color: "#eceaf3",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: "linear-gradient(120deg, #3b9eff, #7c3aed 55%, #d946ef)",
            }}
          />
          <div style={{ fontSize: 40, fontWeight: 600 }}>Alevo</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              maxWidth: 900,
              letterSpacing: -2,
              backgroundImage:
                "linear-gradient(120deg, #eceaf3 40%, #a78bfa 70%, #d946ef)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            The AI SDR that sounds human.
          </div>
          <div style={{ fontSize: 30, color: "#9aa3bd", maxWidth: 820 }}>
            Books meetings across email, forms, calls, and chat — warm,
            on-brand, and always on.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
