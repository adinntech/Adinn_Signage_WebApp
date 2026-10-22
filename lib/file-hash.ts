/**
 * SHA-256 of a file's content as lowercase hex, computed in the browser so duplicates can be found
 * before anything is uploaded. Returns null where the Web Crypto API is unavailable (non-HTTPS pages);
 * the server still rejects duplicates in that case.
 */
export async function sha256Hex(file: File): Promise<string | null> {
  const subtle = typeof crypto !== "undefined" ? crypto.subtle : undefined;
  if (!subtle) return null;
  try {
    const digest = await subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return null;
  }
}
