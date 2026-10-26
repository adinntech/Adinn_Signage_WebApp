/**
 * What a person may type into a field. The input removes everything else as they type or paste, so a wrong character
 * never appears. The server checks the same rules again, so this is a convenience and not the only guard.
 */
export type InputFormat =
  | "phone" // 10 digits, numbers only
  | "pincode" // 6 digits
  | "digits" // whole number
  | "decimal" // an amount or size: digits and one dot, at most 2 decimals
  | "coord" // latitude / longitude: optional minus, digits and one dot, at most 6 decimals
  | "gst" // 15 letters / digits, capitals
  | "pan" // 10 letters / digits, capitals
  | "ifsc" // 11 letters / digits, capitals
  | "account" // bank account number, up to 18 digits
  | "email"; // no spaces, lower case

const decimal = (v: string, places: number, signed = false) => {
  const neg = signed && v.trimStart().startsWith("-") ? "-" : "";
  const cleaned = v.replace(/[^0-9.]/g, "");
  const [whole = "", ...rest] = cleaned.split(".");
  const frac = rest.join("").slice(0, places);
  return `${neg}${whole}${rest.length ? "." : ""}${frac}`;
};

interface Spec { clean: (v: string) => string; max?: number; inputMode: "numeric" | "decimal" | "text" | "email" | "tel"; placeholder?: string; autoComplete?: string; title: string }

export const FORMATS: Record<InputFormat, Spec> = {
  phone: { clean: (v) => v.replace(/\D/g, "").slice(0, 10), max: 10, inputMode: "numeric", autoComplete: "tel-national", title: "10 digits, numbers only" },
  pincode: { clean: (v) => v.replace(/\D/g, "").slice(0, 6), max: 6, inputMode: "numeric", autoComplete: "postal-code", title: "6 digits, numbers only" },
  digits: { clean: (v) => v.replace(/\D/g, ""), inputMode: "numeric", title: "Numbers only" },
  decimal: { clean: (v) => decimal(v, 2), inputMode: "decimal", title: "Numbers only, up to 2 decimals" },
  coord: { clean: (v) => decimal(v, 6, true), inputMode: "decimal", title: "Numbers only, up to 6 decimals" },
  gst: { clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 15), max: 15, inputMode: "text", title: "15 characters: letters and numbers" },
  pan: { clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10), max: 10, inputMode: "text", title: "10 characters: letters and numbers" },
  ifsc: { clean: (v) => v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11), max: 11, inputMode: "text", title: "11 characters: letters and numbers" },
  account: { clean: (v) => v.replace(/\D/g, "").slice(0, 18), max: 18, inputMode: "numeric", title: "Numbers only, up to 18 digits" },
  email: { clean: (v) => v.replace(/\s/g, "").toLowerCase(), inputMode: "email", autoComplete: "email", title: "An email address" },
};

/** The same cleaning for values that are not typed into an <input> (for example pasted into a table cell). */
export const cleanInput = (format: InputFormat, value: string) => FORMATS[format].clean(value);

/** True when the text is a complete, valid value of that format (empty counts as valid; "required" is a separate rule). */
export function isValidFormat(format: InputFormat, value: string): boolean {
  const v = value.trim();
  if (v === "") return true;
  switch (format) {
    case "phone": return /^[6-9]\d{9}$/.test(v);
    case "pincode": return /^[1-9]\d{5}$/.test(v);
    case "gst": return /^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z\d]Z[A-Z\d]$/.test(v);
    case "pan": return /^[A-Z]{5}\d{4}[A-Z]$/.test(v);
    case "ifsc": return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v);
    case "account": return /^\d{9,18}$/.test(v);
    case "email": return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v);
    case "digits": return /^\d+$/.test(v);
    case "decimal": return /^\d+(\.\d{1,2})?$/.test(v);
    case "coord": return /^-?\d+(\.\d{1,6})?$/.test(v);
  }
}
