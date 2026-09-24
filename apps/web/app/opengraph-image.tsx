import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { siteConfig } from "@/lib/site";

export const alt = siteConfig.ogImageAlt;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public/uploads/logo1.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "radial-gradient(1100px 560px at 12% -10%, #16224a 0%, #0b1224 55%)",
          color: "#eef1f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={60} height={60} alt="" style={{ objectFit: "contain" }} />
          <div style={{ fontSize: 40, fontWeight: 600, letterSpacing: -1 }}>Alevo</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 68, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, maxWidth: 980 }}>
            Every lead answered. Every follow-up sent.
          </div>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 700, letterSpacing: -2, backgroundImage: "linear-gradient(120deg,#38b6ff,#a06bff)", backgroundClip: "text", color: "transparent" }}>
            On autopilot.
          </div>
          <div style={{ display: "flex", fontSize: 27, color: "#9ba5bf", maxWidth: 900, marginTop: 8 }}>
            AI SDR for inbound and outbound — chat, forms, calls and email. Books meetings straight into your CRM.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", fontSize: 24, color: "#7cccff" }}>getalevo.com</div>
      </div>
    ),
    size,
  );
}
