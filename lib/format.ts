const dateFmt = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const numFmt = new Intl.NumberFormat("en-IN");
const curFmt = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const valid = (v?: string | number | Date | null) => {
  if (v === null || v === undefined || v === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const formatDate = (v?: string | number | Date | null) => {
  const d = valid(v);
  return d ? dateFmt.format(d) : "-";
};
export const formatDateTime = (v?: string | number | Date | null) => {
  const d = valid(v);
  return d ? dateTimeFmt.format(d) : "-";
};
export const formatNumber = (v?: number | null) => (v === null || v === undefined ? "-" : numFmt.format(v));
export const formatCurrency = (v?: number | null) => (v === null || v === undefined ? "-" : curFmt.format(v));
export const formatBytes = (n?: number | null) => {
  if (n === null || n === undefined) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
};
/** yyyy-mm-dd for <input type="date"> */
export const toDateInput = (v?: string | null) => {
  const d = valid(v);
  return d ? d.toISOString().slice(0, 10) : "";
};
/** yyyy-mm-ddThh:mm in local time for <input type="datetime-local"> */
export const toDateTimeInput = (d = new Date()) => {
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
};
export const label = (v: string) => v.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
