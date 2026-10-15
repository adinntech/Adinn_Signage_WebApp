import { formatNumber, label } from "@/lib/format";
import { SCENARIO_LABEL, type Scenario, type Site } from "@/lib/api/sites";

export type CellKind = "text" | "number" | "unit" | "scenario";

/** Inline-editable site columns. Everything else (Site ID, sq.ft, status) is read-only. */
export const EDITABLE: Record<string, CellKind> = {
  shopName: "text",
  dealerName: "text",
  clientSiteCode: "text",
  location: "text",
  district: "text",
  address1: "text",
  address2: "text",
  pincode: "text",
  mobile: "text",
  gstin: "text",
  contactPerson: "text",
  width: "number",
  height: "number",
  unit: "unit",
  quantity: "number",
  boardType: "text",
  scenario: "scenario",
  remarks: "text",
};

const blank = (v: unknown) => v === undefined || v === null || v === "";

/** Missing-data flags computed from the row's own values. */
export function missingFlags(s: Site) {
  return {
    mobile: blank(s.mobile),
    address: blank(s.address1) && blank(s.address2),
    district: blank(s.district),
    measurement: blank(s.width) || blank(s.height),
  };
}

const MISSING_MSG: Record<string, string> = {
  mobile: "Mobile number is missing",
  address1: "Address is missing",
  district: "District is missing",
  width: "Size is missing",
  height: "Size is missing",
  sqft: "Size is missing",
};

/** Warning text for a cell given the row's own values, or undefined. */
export function cellWarning(s: Site, key: string): string | undefined {
  const m = missingFlags(s);
  if (key === "mobile" && m.mobile) return MISSING_MSG.mobile;
  if (key === "address1" && m.address) return MISSING_MSG.address1;
  if (key === "district" && m.district) return MISSING_MSG.district;
  if ((key === "width" || key === "height" || key === "sqft") && m.measurement) return MISSING_MSG[key];
  return undefined;
}

/** Raw string used to seed the editor. */
export function editValue(s: Site, key: string): string {
  const v = (s as unknown as Record<string, unknown>)[key];
  return blank(v) ? "" : String(v);
}

/** Idle display text. */
export function displayValue(s: Site, key: string): string {
  const v = (s as unknown as Record<string, unknown>)[key];
  if (blank(v)) return "";
  if (key === "sqft") return formatNumber(v as number);
  if (key === "scenario") return SCENARIO_LABEL[v as Scenario]?.split(" - ")[0] ?? String(v);
  if (key === "status") return label(String(v));
  return String(v);
}

export const SCENARIO_SHORT: Record<Scenario, string> = {
  MEASUREMENT_REQUIRED: "Scenario 1",
  CLIENT_PROVIDED: "Scenario 2",
};
