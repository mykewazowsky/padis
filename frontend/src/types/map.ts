// types/map.ts
export type FeatureProps = {
  id_kabkota?: string;
  kab_kota: string;
  prov: string;
  // Thematic layer values — present only in their respective layer fetch
  loss?: number | null;
  aal?: number | null;
  mean_value?: number | null;
  total_prod?: number | null;
  // false when the region has no data for the current filter combination
  has_data?: boolean;
};

export type GeoFeature = {
  type: "Feature";
  properties: FeatureProps;
  geometry: null; // geometry-free; actual geometry lives in MVT tiles
};

/** Axis-aligned bounding box for the regions that actually have data. */
export type DataBounds = {
  min_lng: number;
  min_lat: number;
  max_lng: number;
  max_lat: number;
};

export type GeoJsonData = {
  type: "FeatureCollection";
  features: GeoFeature[];
  /** Present on thematic layers (loss/aal/hazard). Null when no data exists for current filters. */
  data_bounds?: DataBounds | null;
};

// =========================
// AAL SUMMARY TYPE
// =========================
export type AalSummary = {
  hazard: string;

  total_aal_climate: number | null;
  total_aal_nonclimate: number | null;

  change_percent?: number | null;
};
