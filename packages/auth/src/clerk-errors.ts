/**
 * Clerk's backend SDK throws a ClerkAPIResponseError whose `message` is just the
 * HTTP status text ("Unprocessable Entity", or ""). The reason a person can act
 * on lives in `errors[0].longMessage`, and `meta.paramName` names the field.
 * Pure: no Clerk import, so it is unit-testable.
 */
type ClerkShaped = { clerkError?: boolean; errors?: { message?: string; longMessage?: string; meta?: { paramName?: string } }[] };

export function clerkRejection(error: unknown): { message: string; param: string | undefined } | null {
  if (!error || typeof error !== "object" || !("clerkError" in error) || !Array.isArray((error as ClerkShaped).errors)) return null;
  const first = (error as ClerkShaped).errors![0];
  return { message: first?.longMessage || first?.message || "Clerk rejected the request.", param: first?.meta?.paramName };
}

/** A Clerk rejection with a readable message; `param` is the Clerk field it is about (e.g. `email_address`). */
export class ClerkRejectedError extends Error {
  constructor(
    message: string,
    public readonly param?: string,
  ) {
    super(message);
    this.name = "ClerkRejectedError";
  }
}

/** Run a Clerk backend call; a Clerk rejection becomes a ClerkRejectedError, anything else passes through. */
export async function clerk<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const rejection = clerkRejection(error);
    if (rejection) throw new ClerkRejectedError(rejection.message, rejection.param);
    throw error;
  }
}
