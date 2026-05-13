import type { DataBounds } from "@/types/map";

export const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL as string;

if (!BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is NOT set!");
}

const isProduction = process.env.NODE_ENV === "production";
const isLocalhost =
  BASE_URL.includes("127.0.0.1") || BASE_URL.includes("localhost");

if (isProduction && isLocalhost) {
  throw new Error("❌ Production is using localhost! Set NEXT_PUBLIC_API_BASE_URL correctly.");
}

async function fetchJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
  return res.json();
}

// Production data is filter-independent and never changes during a session.
// Cache it in module scope so filter changes don't re-fetch it.
let _productionCache: FeatureCollection | null = null;

async function fetchProduction(): Promise<FeatureCollection> {
  if (_productionCache) return _productionCache;
  const res = await fetch(`${BASE_URL}/api/layers/values/production`);
  if (!res.ok) throw new Error(`Fetch failed: /api/layers/values/production (${res.status})`);
  const json = await res.json();
  _productionCache = toFC((json.data as LayerItem[]) ?? []);
  return _productionCache;
}

export type LayerItem = {
  id_kabkota: string;
  kab_kota: string;
  prov: string;
  loss?: number | null;
  aal?: number | null;
  mean_value?: number | null;
  total_prod?: number | null;
  /** null ketika tidak ada data untuk kombinasi filter aktif */
  has_data?: boolean;
  /** hanya ada di endpoint production */
  centroid_lng?: number | null;
  centroid_lat?: number | null;
};

export type LatestRun = { runId: number; dataYear: number | null };

export async function fetchLatestRunId(hazard?: string): Promise<LatestRun> {
  const qs = hazard ? `?hazard=${encodeURIComponent(hazard)}` : "";
  const json = await fetchJson(`/api/runs/latest${qs}`);
  return {
    runId:    json.run_id    as number,
    dataYear: (json.data_year ?? null) as number | null,
  };
}

// runId is required so the map never mixes tiles from different analysis runs.
// The {z}/{x}/{y} placeholders are filled by Leaflet during tile rendering.
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
  return `${BASE_URL}/api/tiles/${layer}/{z}/{x}/{y}?${params}`;
}

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

// Lightweight value endpoints; actual geometry rendering uses MVT tiles
// (/api/tiles/...) in MapCanvas. Keeping values and geometry separate keeps
// filter changes responsive and avoids downloading large GeoJSON geometry.
// activeAal / activeHazard: skip fetching layer data when the layer is toggled off.
// Loss is always fetched (default active layer).
export async function fetchAllLayers({
  hazard,
  scenario,
  climate,
  runId,
  activeAal = true,
  activeHazard = true,
}: {
  hazard: string;
  scenario: string;
  climate: string;
  runId: number;
  activeAal?: boolean;
  activeHazard?: boolean;
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
  const empty = { data: [] as LayerItem[], data_bounds: null };

  const [production, lossJson, aalJson, hazardJson] = await Promise.all([
    fetchProduction(),
    fetchJson(`/api/layers/values/loss?hazard=${h}&scenario=${s}&climate=${c}&run_id=${runId}`),
    // hazard endpoint: scenario param = climate value, rp param = scenario value
    activeAal     ? fetchJson(`/api/layers/values/aal?hazard=${h}&climate=${c}&run_id=${runId}`)              : Promise.resolve(empty),
    activeHazard  ? fetchJson(`/api/layers/values/hazard?hazard=${h}&scenario=${c}&rp=${s}&run_id=${runId}`)  : Promise.resolve(empty),
  ]);

  return {
    regions:    null,
    production,
    loss:       toFC((lossJson.data   as LayerItem[]) ?? [], lossJson.data_bounds   ?? null),
    aal:        toFC((aalJson.data    as LayerItem[]) ?? [], aalJson.data_bounds    ?? null),
    hazard:     toFC((hazardJson.data as LayerItem[]) ?? [], hazardJson.data_bounds ?? null),
  };
}
