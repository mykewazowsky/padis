"use client";

import "leaflet/dist/leaflet.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import MapLegendPanel, { type LayerKey } from "./MapLegendPanel";
import MapLayerControlPanel from "./MapLayerControlPanel";
import {
  GeoJSON,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type {
  DivIcon,
  GeoJSON as LeafletGeoJSON,
  LatLngBoundsExpression,
  Layer,
  Map as LeafletMap,
  PathOptions,
} from "leaflet";
import type {
  Feature,
  FeatureCollection,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { FeatureProps, GeoJsonData } from "../../../types/map";

type Props = {
  data: GeoJsonData | null;
  hazard: string;
  scenario: string;
  climate: string;
  selectedRegion: string;
  mapRef: React.MutableRefObject<LeafletMap | null>;
  featureLayersRef: React.MutableRefObject<Record<string, Layer>>;
  jenksBreaks: number[];
  topRegionKeys: Set<string>;
  styleConfig: {
    border: string;
    hoverBorder: string;
    topBorder: string;
    baseOpacity: number;
    hoverOpacity: number;
  };
  getColorFromBreaks: (
    value: number | null | undefined,
    breaks: number[],
    hazard: string
  ) => string;
  formatCompactRupiah: (value: number | null | undefined) => string;
  onRegionSelect?: (region: string) => void;
  resetViewSignal?: number;
  activeLayers: Record<LayerKey, boolean>;
  onToggleLayer: (key: LayerKey) => void;
};

type RegionFeature = Feature<Geometry, FeatureProps>;

type RegionLabel = {
  id: string;
  name: string;
  position: L.LatLngExpression;
};

type BoundedLayer = Layer & {
  getBounds?: () => L.LatLngBounds;
  setStyle?: (style: PathOptions) => void;
  bringToFront?: () => BoundedLayer;
  bindTooltip?: (content: string, options?: L.TooltipOptions) => unknown;
  on?: (eventMap: L.LeafletEventHandlerFnMap) => unknown;
};

type FeatureWithOptionalCentroidProps = FeatureProps & {
  centroid?: [number, number] | { lat: number; lng: number };
};

const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];
const DEFAULT_ZOOM = 5;
const LABEL_MIN_ZOOM = 7;

const FIT_BOUNDS_PADDING: L.PointExpression = [16, 16];
const FOCUS_BOUNDS_PADDING: L.PointExpression = [32, 32];
const FLY_DURATION = 0.5;
const RESET_DURATION = 0.6;

const INDONESIA_BOUNDS: LatLngBoundsExpression = [
  [-11.5, 94.0],
  [6.5, 141.5],
];

const BASEMAP = {
  attribution: "&copy; OpenStreetMap contributors",
  url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

const GEOSERVER_WMS_URL = "http://localhost/geoserver/PADIS/wms";
const SAWAH_PANE = "wms-sawah-pane";
const BATAS_ADM_PANE = "wms-batas-pane";

const WMS_CONFIG: Record<
  Exclude<LayerKey, "geojson">,
  {
    pane: string;
    zIndex: number;
    layers: string;
  }
> = {
  sawah: {
    pane: SAWAH_PANE,
    zIndex: 320,
    layers: "PADIS:lulc_sawah",
  },
  batas_adm: {
    pane: BATAS_ADM_PANE,
    zIndex: 330,
    layers: "PADIS:batas_adm_kabkota",
  },
};

function normalizeRegionKey(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSelectedBorderColor(hazard: string) {
  if (hazard === "drought") return "#b45309";
  if (hazard === "flood") return "#174f92";
  return "#5b21b6";
}

function getAccentColors(hazard: string) {
  if (hazard === "drought") {
    return { soft: "#fff3bf", dark: "#8a6300" };
  }

  if (hazard === "flood") {
    return { soft: "#eaf2ff", dark: "#174f92" };
  }

  return { soft: "#f3e8ff", dark: "#5b21b6" };
}

function getLabelFontSize(zoom: number) {
  if (zoom >= 10) return 12;
  if (zoom >= 9) return 11;
  if (zoom >= 8) return 10;
  if (zoom >= 7) return 9;
  return 8;
}

function getLabelPadding(zoom: number) {
  if (zoom >= 10) return "2px 6px";
  if (zoom >= 9) return "2px 5px";
  return "1px 4px";
}

function isPolygonGeometry(
  geometry: Geometry | null | undefined
): geometry is Polygon | MultiPolygon {
  return geometry?.type === "Polygon" || geometry?.type === "MultiPolygon";
}

function getRingCentroid(ring: Position[]): [number, number] | null {
  if (!ring.length) return null;

  let twiceArea = 0;
  let x = 0;
  let y = 0;

  for (let i = 0; i < ring.length - 1; i += 1) {
    const current = ring[i];
    const next = ring[i + 1];

    if (!current || !next) continue;

    const [x1, y1] = current;
    const [x2, y2] = next;
    const factor = x1 * y2 - x2 * y1;

    twiceArea += factor;
    x += (x1 + x2) * factor;
    y += (y1 + y2) * factor;
  }

  if (Math.abs(twiceArea) < 1e-7) {
    const first = ring[0];
    return first ? [first[0], first[1]] : null;
  }

  const areaFactor = twiceArea * 3;
  return [x / areaFactor, y / areaFactor];
}

function getFeatureLabelPosition(
  feature: RegionFeature
): L.LatLngExpression | null {
  const props = feature.properties as FeatureWithOptionalCentroidProps | null;
  const centroid = props?.centroid;

  if (Array.isArray(centroid) && centroid.length === 2) {
    return [centroid[1], centroid[0]];
  }

  if (
    centroid &&
    !Array.isArray(centroid) &&
    typeof centroid === "object" &&
    "lat" in centroid &&
    "lng" in centroid &&
    typeof centroid.lat === "number" &&
    typeof centroid.lng === "number"
  ) {
    return [centroid.lat, centroid.lng];
  }

  if (!isPolygonGeometry(feature.geometry)) return null;

  if (feature.geometry.type === "Polygon") {
    const outerRing = feature.geometry.coordinates[0];
    const point = outerRing ? getRingCentroid(outerRing) : null;
    return point ? [point[1], point[0]] : null;
  }

  let bestRing: Position[] | null = null;
  let bestSize = -1;

  for (const polygon of feature.geometry.coordinates) {
    const outerRing = polygon[0];
    if (!outerRing?.length) continue;

    if (outerRing.length > bestSize) {
      bestRing = outerRing;
      bestSize = outerRing.length;
    }
  }

  const point = bestRing ? getRingCentroid(bestRing) : null;
  return point ? [point[1], point[0]] : null;
}

function buildFeatureStyle(params: {
  feature: RegionFeature;
  normalizedSelectedRegion: string;
  normalizedTopRegionKeys: Set<string>;
  selectedBorderColor: string;
  styleConfig: Props["styleConfig"];
  getColorFromBreaks: Props["getColorFromBreaks"];
  jenksBreaks: number[];
  hazard: string;
}): PathOptions {
  const {
    feature,
    normalizedSelectedRegion,
    normalizedTopRegionKeys,
    selectedBorderColor,
    styleConfig,
    getColorFromBreaks,
    jenksBreaks,
    hazard,
  } = params;

  const props = feature.properties;
  const regionKey = normalizeRegionKey(props?.kab_kota);
  const isSelected =
    Boolean(normalizedSelectedRegion) && regionKey === normalizedSelectedRegion;
  const isTopRegion = normalizedTopRegionKeys.has(regionKey);

  let color = styleConfig.border;
  let weight = 0.8;
  let dashArray: string | undefined;
  let fillOpacity = styleConfig.baseOpacity;

  if (isSelected) {
    color = selectedBorderColor;
    weight = 3.2;
    fillOpacity = 1;
  } else if (isTopRegion) {
    color = styleConfig.topBorder;
    weight = 1.3;
    dashArray = "4 2";
    fillOpacity = 0.9;
  }

  return {
    color,
    weight,
    dashArray,
    fillColor: getColorFromBreaks(props?.loss, jenksBreaks, hazard),
    fillOpacity,
  };
}

function createTooltipHtml(params: {
  props: FeatureProps | null | undefined;
  accentColors: { soft: string; dark: string };
  formatCompactRupiah: Props["formatCompactRupiah"];
}) {
  const { props, accentColors, formatCompactRupiah } = params;
  const safeKabKota = escapeHtml(props?.kab_kota ?? "-");
  const safeProv = escapeHtml(props?.prov ?? "-");
  const safeLoss = escapeHtml(formatCompactRupiah(props?.loss));

  return `
    <div style="
      min-width: 140px;
      font-family: Figtree, Figtree, sans-serif;
      color: #111827;
      line-height: 1.35;
    ">
      <div style="
        font-size: 12px;
        font-weight: 800;
        margin-bottom: 3px;
      ">
        ${safeKabKota}
      </div>

      <div style="
        font-size: 10px;
        color: #6b7280;
        margin-bottom: 6px;
      ">
        ${safeProv}
      </div>

      <div style="
        display: inline-flex;
        align-items: center;
        border-radius: 999px;
        padding: 3px 8px;
        font-size: 10px;
        font-weight: 700;
        background: ${accentColors.soft};
        color: ${accentColors.dark};
      ">
        ${safeLoss}
      </div>
    </div>
  `;
}

function FitBounds({
  selectedRegion,
}: {
  selectedRegion: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedRegion) return;

    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(INDONESIA_BOUNDS, {
        padding: FIT_BOUNDS_PADDING,
      });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [map, selectedRegion]);

  return null;
}

function ResetViewController({
  resetViewSignal,
  selectedRegion,
}: {
  resetViewSignal?: number;
  selectedRegion: string;
}) {
  const map = useMap();

  useEffect(() => {
    if (!resetViewSignal) return;

    if (!selectedRegion) {
      map.flyToBounds(INDONESIA_BOUNDS, {
        padding: FIT_BOUNDS_PADDING,
        duration: RESET_DURATION,
      });
      return;
    }

    map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
      duration: RESET_DURATION,
    });
  }, [resetViewSignal, map, selectedRegion]);

  return null;
}

function MapInstanceBinder({
  mapRef,
  onReady,
}: {
  mapRef: React.MutableRefObject<LeafletMap | null>;
  onReady: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    mapRef.current = map;
    onReady();
  }, [map, mapRef, onReady]);

  return null;
}

function ForceResize() {
  const map = useMap();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 120);

    return () => window.clearTimeout(timer);
  }, [map]);

  return null;
}

function LabelZoomWatcher({
  onZoomChange,
}: {
  onZoomChange: (zoom: number) => void;
}) {
  const map = useMap();

  useEffect(() => {
    const updateZoom = () => {
      onZoomChange(map.getZoom());
    };

    updateZoom();
    map.on("zoomend", updateZoom);

    return () => {
      map.off("zoomend", updateZoom);
    };
  }, [map, onZoomChange]);

  return null;
}

function RegionZoomController({
  selectedRegion,
  featureLayersRef,
  geoJsonVisible,
  layerBuildVersion,
}: {
  selectedRegion: string;
  featureLayersRef: React.MutableRefObject<Record<string, Layer>>;
  geoJsonVisible: boolean;
  layerBuildVersion: number;
}) {
  const map = useMap();
  const lastZoomedRegionRef = useRef<string>("");

  useEffect(() => {
    if (!selectedRegion || !geoJsonVisible) {
      lastZoomedRegionRef.current = "";
      return;
    }

    const normalizedKey = normalizeRegionKey(selectedRegion);
    const targetLayer = featureLayersRef.current[normalizedKey] as
      | BoundedLayer
      | undefined;

    if (!targetLayer?.getBounds) return;

    const zoomKey = `${normalizedKey}::${layerBuildVersion}`;
    if (lastZoomedRegionRef.current === zoomKey) return;

    lastZoomedRegionRef.current = zoomKey;

    const rafId = window.requestAnimationFrame(() => {
      map.invalidateSize();

      const bounds = targetLayer.getBounds?.();
      if (!bounds) return;

      map.flyToBounds(bounds, {
        padding: FOCUS_BOUNDS_PADDING,
        duration: FLY_DURATION,
      });
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [selectedRegion, geoJsonVisible, map, featureLayersRef, layerBuildVersion]);

  return null;
}

export default function MapCanvas({
  data,
  hazard,
  scenario,
  climate,
  selectedRegion,
  mapRef,
  featureLayersRef,
  jenksBreaks,
  topRegionKeys,
  styleConfig,
  getColorFromBreaks,
  formatCompactRupiah,
  onRegionSelect,
  resetViewSignal = 0,
  activeLayers,
  onToggleLayer,
}: Props) {
  const geoJsonRef = useRef<LeafletGeoJSON | null>(null);
  const wmsLayersRef = useRef<
    Record<Exclude<LayerKey, "geojson">, L.TileLayer.WMS | null>
  >({
    batas_adm: null,
    sawah: null,
  });

  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [isMapReady, setIsMapReady] = useState(false);
  const [layerBuildVersion, setLayerBuildVersion] = useState(0);

  const normalizedSelectedRegion = useMemo(
    () => normalizeRegionKey(selectedRegion),
    [selectedRegion]
  );

  const normalizedTopRegionKeys = useMemo(() => {
    return new Set(
      Array.from(topRegionKeys).map((key) => normalizeRegionKey(key))
    );
  }, [topRegionKeys]);

  const hasRequiredFilters = Boolean(hazard && scenario && climate);

  const canShowGeoJson = Boolean(
    data && hasRequiredFilters && activeLayers.geojson
  );

  const selectedBorderColor = useMemo(
    () => getSelectedBorderColor(hazard),
    [hazard]
  );

  const accentColors = useMemo(() => getAccentColors(hazard), [hazard]);

  const getFeatureStyle = useCallback(
    (feature?: RegionFeature): PathOptions => {
      if (!feature) return {};

      return buildFeatureStyle({
        feature,
        normalizedSelectedRegion,
        normalizedTopRegionKeys,
        selectedBorderColor,
        styleConfig,
        getColorFromBreaks,
        jenksBreaks,
        hazard,
      });
    },
    [
      normalizedSelectedRegion,
      normalizedTopRegionKeys,
      selectedBorderColor,
      styleConfig,
      getColorFromBreaks,
      jenksBreaks,
      hazard,
    ]
  );

  useEffect(() => {
    featureLayersRef.current = {};
    setLayerBuildVersion((prev) => prev + 1);
  }, [data, hazard, scenario, climate, featureLayersRef]);

  useEffect(() => {
    if (!isMapReady) return;

    const map = mapRef.current;
    if (!map) return;

    (
      Object.entries(WMS_CONFIG) as Array<
        [
          Exclude<LayerKey, "geojson">,
          (typeof WMS_CONFIG)[Exclude<LayerKey, "geojson">]
        ]
      >
    ).forEach(([key, config]) => {
      let pane = map.getPane(config.pane);

      if (!pane) {
        pane = map.createPane(config.pane);
        pane.style.zIndex = String(config.zIndex);
        pane.style.pointerEvents = "none";
      }

      if (!wmsLayersRef.current[key]) {
        wmsLayersRef.current[key] = L.tileLayer.wms(GEOSERVER_WMS_URL, {
          layers: config.layers,
          format: "image/png",
          transparent: true,
          version: "1.1.0",
          pane: config.pane,
        });
      }

      const layer = wmsLayersRef.current[key];
      if (!layer) return;

      if (activeLayers[key]) {
        if (!map.hasLayer(layer)) {
          layer.addTo(map);
        }
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    });
  }, [activeLayers, isMapReady, mapRef]);

  const handleZoomIn = useCallback(() => {
    mapRef.current?.zoomIn();
  }, [mapRef]);

  const handleZoomOut = useCallback(() => {
    mapRef.current?.zoomOut();
  }, [mapRef]);

  const legendItems = useMemo(() => {
    if (!jenksBreaks.length) return [];

    return jenksBreaks.map((upper, index) => {
      const lower = index === 0 ? 0 : (jenksBreaks[index - 1] ?? 0);
      const sampleValue = upper ?? lower;

      return {
        color: getColorFromBreaks(sampleValue, jenksBreaks, hazard),
        label: `${formatCompactRupiah(lower)} - ${formatCompactRupiah(upper)}`,
      };
    });
  }, [jenksBreaks, hazard, getColorFromBreaks, formatCompactRupiah]);

  const showLabels = currentZoom >= LABEL_MIN_ZOOM && canShowGeoJson;

  const regionLabels = useMemo<RegionLabel[]>(() => {
    if (!showLabels || !data?.features?.length) return [];

    return data.features
      .map((rawFeature, index) => {
        const feature = rawFeature as RegionFeature;
        const props = feature.properties;
        const name = props?.kab_kota?.trim();

        if (!name) return null;

        const position = getFeatureLabelPosition(feature);
        if (!position) return null;

        return {
          id: `${normalizeRegionKey(name)}-${index}`,
          name,
          position,
        };
      })
      .filter((item): item is RegionLabel => Boolean(item));
  }, [data, showLabels]);

  const geoJsonData = useMemo(() => {
    if (!data) return null;
    return data as FeatureCollection<Geometry, FeatureProps>;
  }, [data]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        className="h-full w-full"
        scrollWheelZoom
        ref={mapRef as never}
        zoomControl={false}
      >
        <MapInstanceBinder
          mapRef={mapRef}
          onReady={() => setIsMapReady(true)}
        />

        <ForceResize />
        <LabelZoomWatcher onZoomChange={setCurrentZoom} />
        <TileLayer attribution={BASEMAP.attribution} url={BASEMAP.url} />
        <FitBounds selectedRegion={selectedRegion} />

        <ResetViewController
          resetViewSignal={resetViewSignal}
          selectedRegion={selectedRegion}
        />

        <RegionZoomController
          selectedRegion={selectedRegion}
          featureLayersRef={featureLayersRef}
          geoJsonVisible={canShowGeoJson}
          layerBuildVersion={layerBuildVersion}
        />

        {canShowGeoJson && geoJsonData && (
          <GeoJSON
            key={`${hazard}-${scenario}-${climate}-${geoJsonData.features.length}`}
            ref={(instance) => {
              geoJsonRef.current = instance;
            }}
            data={geoJsonData}
            style={(feature) => getFeatureStyle(feature as RegionFeature)}
            onEachFeature={(feature, layer) => {
              const typedFeature = feature as RegionFeature;
              const typedLayer = layer as BoundedLayer;
              const props = typedFeature.properties;
              const rawRegionName = props?.kab_kota ?? "";
              const normalizedRegionName = normalizeRegionKey(rawRegionName);

              featureLayersRef.current[normalizedRegionName] = typedLayer;

              typedLayer.bindTooltip?.(
                createTooltipHtml({
                  props,
                  accentColors,
                  formatCompactRupiah,
                }),
                {
                  sticky: true,
                  direction: "top",
                  opacity: 0.96,
                }
              );

              typedLayer.on?.({
                mouseover: (e: L.LeafletMouseEvent) => {
                  const hoveredKey = normalizeRegionKey(props?.kab_kota);
                  const isSelected =
                    Boolean(normalizedSelectedRegion) &&
                    hoveredKey === normalizedSelectedRegion;
                  const isTop = normalizedTopRegionKeys.has(hoveredKey);
                  const target = e.target as BoundedLayer;

                  target.setStyle?.({
                    weight: isSelected ? 3.2 : isTop ? 1.8 : 1.5,
                    color: isSelected
                      ? selectedBorderColor
                      : styleConfig.hoverBorder,
                    fillOpacity: isSelected ? 1 : styleConfig.hoverOpacity,
                    dashArray: isSelected
                      ? undefined
                      : isTop
                        ? "4 2"
                        : undefined,
                  });

                  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    target.bringToFront?.();
                  }
                },

                mouseout: () => {
                  typedLayer.setStyle?.(getFeatureStyle(typedFeature));
                },

                click: () => {
                  const bounds = typedLayer.getBounds?.();
                  if (bounds) {
                    mapRef.current?.flyToBounds(bounds, {
                      padding: FOCUS_BOUNDS_PADDING,
                      duration: FLY_DURATION,
                    });
                  }

                  onRegionSelect?.(rawRegionName);
                },
              });
            }}
          />
        )}

        {showLabels &&
          regionLabels.map((item) => {
            const fontSize = 9; // fixed
            const padding = "2px 5px"; // fixed

            const icon: DivIcon = L.divIcon({
              className: "kabkota-label-icon",
              html: `
                <div style="
                  font-family: Figtree, Figtree, sans-serif;
                  font-size: ${fontSize}px;
                  font-weight: 600;
                  color: #ffffff;
                  line-height: 1.1;
                  white-space: nowrap;
                  pointer-events: none;
                  transform: translate(-50%, -50%);
                  padding: ${padding};
                  border-radius: 4px;

                  text-shadow: none;
                  box-shadow: none;
                ">
                  ${escapeHtml(item.name)}
                </div>
              `,
              iconSize: [0, 0],
              iconAnchor: [0, 0],
            });

            return (
              <Marker
                key={item.id}
                position={item.position}
                icon={icon}
                interactive={false}
                keyboard={false}
              />
            );
          })}
      </MapContainer>

      <MapLayerControlPanel
        activeLayers={activeLayers}
        onToggleLayer={onToggleLayer}
      />

      <MapLegendPanel
        title="Legenda"
        items={legendItems}
        collapsed={legendCollapsed}
        onToggle={() => setLegendCollapsed((prev) => !prev)}
      />
    </div>
  );
}