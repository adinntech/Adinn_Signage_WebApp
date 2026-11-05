/** What a GST number tells by itself (no lookup): the state, the PAN inside it and the kind of business the PAN says. */
const STATES: Record<string, string> = {
  "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab", "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana", "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh", "10": "Bihar",
  "11": "Sikkim", "12": "Arunachal Pradesh", "13": "Nagaland", "14": "Manipur", "15": "Mizoram", "16": "Tripura", "17": "Meghalaya", "18": "Assam", "19": "West Bengal", "20": "Jharkhand",
  "21": "Odisha", "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat", "26": "Dadra & Nagar Haveli and Daman & Diu", "27": "Maharashtra", "28": "Andhra Pradesh (old)", "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
  "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry", "35": "Andaman & Nicobar Islands", "36": "Telangana", "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other territory", "99": "Centre jurisdiction",
};
const ENTITY: Record<string, string> = { P: "Individual / proprietor", C: "Company", H: "Hindu Undivided Family", F: "Firm / LLP", A: "Association of persons", T: "Trust", B: "Body of individuals", L: "Local authority", J: "Artificial juridical person", G: "Government" };

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export interface GstinInfo { pan: string; stateCode: string; state: string; entity: string }

/** Details inside a complete GST number, or null while it is not a valid-looking one. */
export function gstinInfo(raw: string): GstinInfo | null {
  const g = raw.trim().toUpperCase();
  if (!GSTIN_RE.test(g)) return null;
  const pan = g.slice(2, 12);
  const code = g.slice(0, 2);
  return { pan, stateCode: code, state: STATES[code] ?? "Unknown state code", entity: ENTITY[pan[3]!] ?? "Other" };
}
