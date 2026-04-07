"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { BASE_MAP_LAYERS, LayerKey } from "../config/layers";

type Props = {
  map: L.Map | null;
  activeLayers: Record<LayerKey, boolean>;
};

export default function GeoServerLayerManager({ map, activeLayers }: Props) {
  const layerRefs = useRef<Partial<Record<LayerKey, L.TileLayer.WMS>>>({});

  useEffect(() => {
    if (!map) return;

    for (const config of BASE_MAP_LAYERS) {
      if (!layerRefs.current[config.key]) {
        const layer = L.tileLayer.wms(config.url, {
          layers: config.layers,
          format: config.format,
          transparent: config.transparent,
          version: config.version ?? "1.1.0",
        });

        if (typeof config.zIndex === "number") {
          layer.setZIndex(config.zIndex);
        }

        layerRefs.current[config.key] = layer;
      }
    }

    for (const config of BASE_MAP_LAYERS) {
      const layer = layerRefs.current[config.key];
      if (!layer) continue;

      const isActive = activeLayers[config.key];

      if (isActive && !map.hasLayer(layer)) {
        layer.addTo(map);
      } else if (!isActive && map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    }
  }, [map, activeLayers]);

  return null;
}