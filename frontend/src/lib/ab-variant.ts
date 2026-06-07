/**
 * A/B variant resolution for PADIS dashboard.
 *
 * Variant is read from URL param `?v=a` or `?v=b` on first visit and
 * persisted to localStorage so it stays consistent as the user navigates.
 *
 * Variant A (Control)   — dashboard tanpa product tour
 * Variant B (Treatment) — dashboard dengan product tour (default)
 *
 * Share links:
 *   Kelompok A: https://padis-webgis.vercel.app/dashboard?v=a
 *   Kelompok B: https://padis-webgis.vercel.app/dashboard?v=b
 */

export type ABVariant = "a" | "b";

const AB_STORAGE_KEY = "padis-ab-variant";

export function resolveABVariant(): ABVariant {
  if (typeof window === "undefined") return "b";

  // URL param takes priority — lets the facilitator assign a specific variant
  const urlParam = new URLSearchParams(window.location.search).get("v")?.toLowerCase();
  if (urlParam === "a" || urlParam === "b") {
    try { localStorage.setItem(AB_STORAGE_KEY, urlParam); } catch { /* ignore */ }
    return urlParam;
  }

  // Fall back to stored variant from a previous visit
  try {
    const stored = localStorage.getItem(AB_STORAGE_KEY);
    if (stored === "a" || stored === "b") return stored;
  } catch { /* ignore */ }

  // Default: variant B (with tour)
  return "b";
}

export function clearABVariant(): void {
  try { localStorage.removeItem(AB_STORAGE_KEY); } catch { /* ignore */ }
}
