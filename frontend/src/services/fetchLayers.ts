import type { DataBounds } from "@/types/map";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL as string;

if (!BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is NOT set!");
}

console.log("BASE_URL:", BASE_URL);

async function fetchJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
  return res.json();
}

// ─── Value-only types (no geometry) ──────────────────────────────────────────

export type LayerItem = {
  id_kabkota: string;
  kab_kota: string;
  prov: string;
  loss?: number | null;
  aal?: number | null;
  mean_value?: number | null;
  total_prod?: number | null;
  /** false when this region has no data for the current filter combination */
  has_data?: boolean;
};

// ─── Latest run_id ────────────────────────────────────────────────────────────

/** Fetches the most recent run_id from the backend. */
export async function fetchLatestRunId(): Promise<number> {
  const json = await fetchJson("/api/runs/latest");
  return json.run_id as number;
}

// ─── Tile URL builder ─────────────────────────────────────────────────────────

/**
 * Builds the Leaflet tile URL template for a given layer + filter params.
 * The {z}/{x}/{y} tokens are filled by Leaflet at render time.
 * runId is required — always pass the value from /api/runs/latest.
 */
export function buildTileUrl(
  layer: string,
  hazard: string,
  scenario: string,
  climate: string,
  runId: number
): string {
  const params = new URLSearchParams({
    hazard:   hazard.toLowerCase(),
    scenario: scenario.toLowerCase(),
    climate:  climate.toLowerCase(),
    run_id:   String(runId),
  });
  console.log("TILE PARAMS:", { layer, hazard, climate, scenario, runId });
  return `${BASE_URL}/api/tiles/${layer}/{z}/{x}/{y}?${params}`;
}

// ─── Lightweight fetch — values only (no geometry) ────────────────────────────

type FeatureCollection = {
  type: "FeatureCollection";
  features: { type: "Feature"; geometry: null; properties: LayerItem }[];
  data_bounds?: DataBounds | null;
};

function toFC(items: LayerItem[], bounds: DataBounds | null = null): FeatureCollection {
  return {
    type: "FeatureCollection",
    features: items.map((item) => ({
      type: "Feature",
      geometry: null,
      properties: item,
    })),
    data_bounds: bounds,
  };
}

/**
 * Fetches geometry-free attribute values for all analytical layers in parallel.
 *
 * Returns FeatureCollections that include:
 *   - `has_data` per feature: false when no data for current filter combo
 *   - `data_bounds`: the spatial extent of data-bearing regions (for map fitBounds)
 *
 * Actual rendering is done via vector tiles (/api/tiles/…) fetched by Leaflet.
 */
export async function fetchAllLayers({
  hazard,
  scenario,
  climate,
  runId,
}: {
  hazard: string;
  scenario: string;
  climate: string;
  runId: number;
}): Promise<{
  regions: null;
  production: FeatureCollection;
  loss: FeatureCollection;
  aal: FeatureCollection;
  hazard: FeatureCollection;
}> {
  const h = hazard.toLowerCase();
  const s = scenario.toLowerCase();
  const c = climate.toLowerCase();

  const [prodJson, lossJson, aalJson, hazardJson] = await Promise.all([
    fetchJson(`/api/layers/values/production`),
    fetchJson(`/api/layers/values/loss?hazard=${h}&scenario=${s}&climate=${c}&run_id=${runId}`),
    fetchJson(`/api/layers/values/aal?hazard=${h}&climate=${c}`),
    // hazard endpoint: scenario param = climate value, rp param = scenario value
    fetchJson(`/api/layers/values/hazard?hazard=${h}&scenario=${c}&rp=${s}&run_id=${runId}`),
  ]);

  return {
    regions:    null,
    production: toFC((prodJson.data   as LayerItem[]) ?? []),
    loss:       toFC((lossJson.data   as LayerItem[]) ?? [], lossJson.data_bounds   ?? null),
    aal:        toFC((aalJson.data    as LayerItem[]) ?? [], aalJson.data_bounds    ?? null),
    hazard:     toFC((hazardJson.data as LayerItem[]) ?? [], hazardJson.data_bounds ?? null),
  };
}
