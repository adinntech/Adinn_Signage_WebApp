import type { AllocationOverview } from "@/lib/api/allocation";

export const UNASSIGNED_COLOR = "#94a3b8";
export const IN_HOUSE_COLOR = "#059669";
const VENDOR_COLORS = ["#9333ea", "#2563eb", "#f97316", "#db2777", "#0d9488", "#ca8a04", "#4f46e5", "#e11d48"];

/** One stable colour per vendor on the map, green for the in-house team and grey for shops not yet allocated. */
export function colorFor(channel: string | null | undefined, vendorId: string | null | undefined, teams: AllocationOverview["teams"]) {
  if (channel === "IN_HOUSE") return IN_HOUSE_COLOR;
  if (channel === "VENDOR" && vendorId) {
    const i = teams.filter((t) => t.vendorId).findIndex((t) => t.vendorId === vendorId);
    return VENDOR_COLORS[(i < 0 ? 0 : i) % VENDOR_COLORS.length]!;
  }
  return UNASSIGNED_COLOR;
}
