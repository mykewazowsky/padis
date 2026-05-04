// src/components/map/config/layers.ts

// Legacy WMS config. The current dashboard uses vector-tile layers from PADIS.
export type LayerKey = "batas_adm" | "sawah" | string; 

export type WmsLayerConfig = {
  key: LayerKey;
  label: string;
  url: string;
  layers: string;
  format: string;
  transparent: boolean;
  version?: string;
  zIndex?: number;
  opacity?: number; // Tambahkan opacity untuk fleksibilitas visual
};

// URL WMS legacy, retained for compatibility if this manager is mounted again.
const GEOSERVER_WMS_URL = process.env.NEXT_PUBLIC_GEOSERVER_URL as string;

/**
 * Layer Dasar (Static Layers)
 * Layer yang selalu dimuat saat aplikasi dijalankan
 */
export const BASE_MAP_LAYERS: WmsLayerConfig[] = [
  {
    key: "batas_adm",
    label: "Batas Administrasi",
    url: GEOSERVER_WMS_URL,
    layers: "PADIS:batas_adm_kabkota",
    format: "image/png",
    transparent: true,
    version: "1.1.0",
    zIndex: 100, // Berikan zIndex tinggi agar batas wilayah selalu di atas sawah/hazard
  },
  {
    key: "sawah",
    label: "Lahan Sawah",
    url: GEOSERVER_WMS_URL,
    layers: "PADIS:lulc_sawah",
    format: "image/png",
    transparent: true,
    version: "1.1.0",
    zIndex: 10,
    opacity: 0.7,
  },
];

/**
 * Helper untuk membuat konfigurasi layer dinamis
 * Helper untuk konfigurasi WMS dinamis legacy.
 */
export const createDynamicLayerConfig = (
  key: string, 
  label: string, 
  qualifiedName: string, 
  zIndex: number = 50
): WmsLayerConfig => ({
  key,
  label,
  url: GEOSERVER_WMS_URL,
  layers: qualifiedName,
  format: "image/png",
  transparent: true,
  version: "1.1.0",
  zIndex,
});
