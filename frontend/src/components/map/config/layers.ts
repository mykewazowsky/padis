export type LayerKey = "batas_adm" | "sawah";

export type WmsLayerConfig = {
  key: LayerKey;
  label: string;
  url: string;
  layers: string;
  format: string;
  transparent: boolean;
  version?: string;
  zIndex?: number;
};

export const MAP_LAYERS: WmsLayerConfig[] = [
  {
    key: "batas_adm",
    label: "Batas Administrasi",
    url: "http://localhost/geoserver/PADIS/wms",
    layers: "PADIS:batas_adm_kabkota",
    format: "image/png",
    transparent: true,
    version: "1.1.0",
    zIndex: 20,
  },
  {
    key: "sawah",
    label: "Sawah",
    url: "http://localhost/geoserver/PADIS/wms",
    layers: "PADIS:lulc_sawah",
    format: "image/png",
    transparent: true,
    version: "1.1.0",
    zIndex: 10,
  },
];