/**
 * Field rules shared by the BD and Operations forms. They mirror the backend (backend/src/common/validators/contact.ts),
 * which stays authoritative; these only give instant feedback before the request is sent.
 */

/** Turns +91 98765 43210, 098765-43210 or 91 9876543210 into 9876543210. */
export function normalizeMobile(raw: string): string {
  let d = String(raw ?? "").replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

export const MOBILE_MESSAGE = "Mobile number must be exactly 10 digits (starting with 6-9)";
export const isMobile = (raw: string) => /^[6-9]\d{9}$/.test(normalizeMobile(raw));
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

export const PROJECT_CODE_RE = /^[A-Za-z0-9][A-Za-z0-9-]{3,19}$/;

/** Client code (2-8 letters/digits) derived from a name, e.g. "Coca Cola" -> "COCACO". */
export function clientCodeFrom(name: string, attempt = 0): string {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) || "CLIENT";
  return attempt === 0 ? base : `${base.slice(0, 8 - String(attempt).length)}${attempt}`;
}
