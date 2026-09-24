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
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
          background:
            "radial-gradient(900px 520px at 50% 8%, #16224a 0%, #0b1224 60%)",
          color: "#eef1f8",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoSrc} width={132} height={132} alt="" style={{ objectFit: "contain" }} />
          <div style={{ fontSize: 116, fontWeight: 600, letterSpacing: -3 }}>Alevo</div>
        </div>
        <div style={{ display: "flex", fontSize: 34, color: "#9ba5bf", letterSpacing: -0.5 }}>
          AI SDR for inbound and outbound
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#7cccff", marginTop: 6 }}>getalevo.com</div>
      </div>
    ),
    size,
  );
}
