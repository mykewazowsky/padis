export type FeatureProps = {
  id_kabkota?: string;
  kab_kota: string;
  prov: string;
  loss: number | null;
  aal_nonclimate?: number | null;
  aal_climate?: number | null;
};

export type GeoFeature = {
  type?: string;
  properties: FeatureProps;
  geometry?: any;
};

export type GeoJsonData = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export type AalSummary = {
  total_aal_nonclimate: number;
  total_aal_climate: number;
  count_nonclimate: number;
  count_climate: number;
  top_nonclimate_region: string;
  top_nonclimate_value: number;
  top_climate_region: string;
  top_climate_value: number;
};