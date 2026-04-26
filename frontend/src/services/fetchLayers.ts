import type { DataBounds } from "@/types/map";

export const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL as string;

if (!BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL is NOT set!");
}

if (BASE_URL.includes("127.0.0.1")) {
  throw new Error("❌ Production is using localhost! Set NEXT_PUBLIC_API_BASE_URL correctly.");
}

console.log("BASE_URL:", BASE_URL);

async function fetchJson(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Fetch failed: ${path} (${res.status})`);
  return res.json();
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

export async function fetchLatestRunId(): Promise<number> {
  const json = await fetchJson("/api/runs/latest");
  return json.run_id as number;
}

// runId wajib; template {z}/{x}/{y} diisi Leaflet saat render.
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
  console.log("FINAL TILE URL:", `${BASE_URL}/api/tiles/${layer}`);
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

// Endpoint ringan; rendering peta via MVT tiles (/api/tiles/…) oleh Leaflet.
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
    fetchJson(`/api/layers/values/aal?hazard=${h}&climate=${c}&run_id=${runId}`),
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
