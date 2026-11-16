import { describe, expect, it } from "vitest";
import { avatarKey, AVATAR_SIZES, isAvatarSize, looksLikeWebp } from "../lib/chat/avatar";

const bytes = (s: string, n = 20) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)).concat(Array(n).fill(0)));

describe("chat avatar", () => {
  it("knows its three sizes", () => {
    expect(Object.keys(AVATAR_SIZES)).toEqual(["sm", "md", "lg"]);
    expect(isAvatarSize("lg")).toBe(true);
    expect(isAvatarSize("xl")).toBe(false);
    expect(isAvatarSize(undefined)).toBe(false);
  });
  it("accepts only a WebP file", () => {
    const webp = Uint8Array.from([...Array.from("RIFF", (c) => c.charCodeAt(0)), 1, 2, 3, 4, ...Array.from("WEBP", (c) => c.charCodeAt(0)), 0, 0]);
    expect(looksLikeWebp(webp)).toBe(true);
    expect(looksLikeWebp(bytes("\x89PNG\r\n\x1a\n"))).toBe(false);
    expect(looksLikeWebp(bytes("<svg xmlns="))).toBe(false);
    expect(looksLikeWebp(new Uint8Array(4))).toBe(false);
  });
  it("keeps the picture under the org's avatars folder", () => {
    expect(avatarKey("org1", "abc")).toBe("organizations/org1/avatars/chat-abc.webp");
  });
});
