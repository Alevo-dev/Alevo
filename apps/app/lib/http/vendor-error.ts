/**
 * One readable line for a failed vendor response: "<label> failed (403): Google
 * Calendar API has not been used in project …". Vendors bury the reason in the
 * body (Google `error.message`, Graph `error.message`, OAuth `error_description`),
 * and a bare status code sends the admin to the docs instead of the fix. Pure
 * `formatVendorError` is tested; `vendorError` reads the body safely.
 */
export function formatVendorError(label: string, status: number, body: unknown): string {
  const reason = reasonFrom(body);
  return reason ? `${label} failed (${status}): ${reason}` : `${label} failed (${status})`;
}

function reasonFrom(body: unknown): string | null {
  if (!body || typeof body !== "object") return typeof body === "string" && body.trim() ? body.trim().slice(0, 300) : null;
  const b = body as { error?: unknown; error_description?: unknown; message?: unknown };
  if (typeof b.error_description === "string") return b.error_description;
  if (typeof b.error === "string") return b.error;
  if (b.error && typeof b.error === "object") {
    const e = b.error as { message?: unknown; code?: unknown };
    if (typeof e.message === "string") return e.message;
  }
  if (typeof b.message === "string") return b.message;
  return null;
}

/** Build the Error for a non-OK response, reading its JSON (or text) body once. */
export async function vendorError(res: Response, label: string): Promise<Error> {
  let body: unknown = null;
  try {
    const text = await res.text();
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  } catch {
    body = null;
  }
  return new Error(formatVendorError(label, res.status, body));
}
