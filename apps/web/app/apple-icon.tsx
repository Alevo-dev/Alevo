import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Apple touch icon — generated from the single source logo, on a brand backdrop
// (iOS needs an opaque background).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default async function AppleIcon() {
  const logo = await readFile(join(process.cwd(), "public/uploads/logo1.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1224" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={116} height={116} alt="" style={{ objectFit: "contain" }} />
      </div>
    ),
    size,
  );
}
