/**
 * CSV for the clients export. RFC 4180 quoting, plus a guard against formula
 * injection: a cell a spreadsheet would read as a formula (starts with = + - @,
 * or a tab / carriage return) gets a leading apostrophe so it stays text.
 */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : v instanceof Date ? v.toISOString() : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
