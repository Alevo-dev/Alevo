import { AVATAR_PIXELS, MAX_AVATAR_BYTES } from "./avatar";

const toBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));

/**
 * Make the picture small before it leaves the browser: never cropped, its longest side 256px (it keeps its own
 * proportions; the widget fits the whole picture inside the circle), WebP (keeps a transparent background), lowering
 * the quality until it is under the limit. A typical result is 10 to 30 KB, whatever was chosen.
 */
export async function toAvatarWebp(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, AVATAR_PIXELS / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  let quality = 0.85;
  let blob = await toBlob(canvas, quality);
  while (blob && blob.size > MAX_AVATAR_BYTES && quality > 0.3) {
    quality -= 0.15;
    blob = await toBlob(canvas, quality);
  }
  if (!blob || blob.type !== "image/webp" || blob.size > MAX_AVATAR_BYTES) throw new Error("could not compress");
  return new File([blob], "avatar.webp", { type: "image/webp" });
}
