export type ImportErrorCode = "invalid" | "blocked" | "unreachable" | "empty" | "rate_limited" | "extract_failed";

export class ImportError extends Error {
  constructor(public code: ImportErrorCode) {
    super(code);
  }
}

const MESSAGES: Record<ImportErrorCode, string> = {
  invalid: "Enter a valid website address.",
  blocked: "That address isn't allowed.",
  unreachable: "We couldn't reach that site. Check the address and try again.",
  empty: "We found very little readable text. The site may be built with JavaScript. Fill the profile in manually.",
  rate_limited: "You've imported a few times already. Try again in an hour.",
  extract_failed: "We couldn't read the details from that site. Try again.",
};

export const importMessage = (code: ImportErrorCode): string => MESSAGES[code];
