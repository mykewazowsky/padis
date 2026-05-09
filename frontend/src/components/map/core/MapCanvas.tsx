"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Filter, Layers3, LocateFixed, Palette, X } from "lucide-react";
import MapLegendPanel, { type LayerKey } from "./MapLegendPanel";
import MapLayerControlPanel from "./MapLayerControlPanel";
import { MapContainer, Marker, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import type {
  DivIcon,
  LatLngBoundsExpression,
  Layer,
  Map as LeafletMap,
} from "leaflet";
import type {
  Feature,
  Geometry,
  MultiPolygon,
  Polygon,
  Position,
} from "geojson";
import type { MobilePanel } from "@/components/dashboard/DashboardMapOverlay";
import type { DataBounds, FeatureProps, GeoJsonData } from "../../../types/map";
import { buildTileUrl, BASE_URL } from "@/services/fetchLayers";
import { useTheme } from "@/components/theme/ThemeProvider";

type StyleConfig = {
  border: string;
  hoverBorder: string;
  topBorder: string;
  baseOpacity: number;
  hoverOpacity: number;
};

const DEFAULT_STYLE_CONFIG: StyleConfig = {
  border: "#6b7280",
  hoverBorder: "#374151",
  topBorder: "#f59e0b",
  baseOpacity: 0.7,
  hoverOpacity: 0.85,
};

type MapCanvasProps = {
  data: GeoJsonData | null;
  hazard: string;
  scenario: string;
  climate: string;
  runId?: number;
  selectedRegion: string;
  mapRef: React.MutableRefObject<LeafletMap | null>;
  featureLayersRef: React.MutableRefObject<Record<string, Layer>>;
  jenksBreaks: number[];
  topRegionKeys: Set<string>;
  styleConfig?: StyleConfig;
  layers?: Partial<Record<LayerKey, GeoJsonData | null>>;
  getColorFromBreaks: (
    value: number | null | undefined,
    breaks: number[],
    hazard: string
  ) => string;
  formatCompactRupiah: (value: number | null | undefined) => string;
  onRegionSelect?: (region: string) => void;
  onResetView?: () => void;
  onFocusFilters?: () => void;
  isMapExpanded?: boolean;
  onMobilePanelChange?: (panel: MobilePanel) => void;
  mobileFilterContent?: ReactNode;
  resetViewSignal?: number;
  activeLayers: Record<LayerKey, boolean>;
  onToggleLayer: (key: LayerKey) => void;
  layerOpacity?: number;
  onOpacityChange?: (value: number) => void;
  dataBounds?: DataBounds | null;
  regionCentroids?: Record<string, [number, number]>;
};

type RegionFeature = Feature<Geometry, FeatureProps>;

type RegionLabel = {
  id: string;
  name: string;
  position: L.LatLngExpression;
};

type FixedLegendItem = {
  color: string;
  label: string;
};

type FeatureWithOptionalCentroidProps = FeatureProps & {
  centroid?: [number, number] | { lat: number; lng: number };
};

const DEFAULT_CENTER: [number, number] = [-2.5, 118.0];
const DEFAULT_ZOOM = 5;
const MIN_ZOOM = 4;
const MAX_ZOOM = 15;
const LABEL_MIN_ZOOM = 7;

const FIT_BOUNDS_PADDING: L.PointExpression = [16, 16];
const CLICK_FLY_DURATION = 0.7;
const RESET_DURATION = 0.6;

const INDONESIA_BOUNDS: LatLngBoundsExpression = [
  [-11.5, 94.0],
  [6.5, 141.5],
];

// Slightly wider than INDONESIA_BOUNDS so the elastic snap never triggers
// during normal exploration of the archipelago's edges.
const MAX_BOUNDS: LatLngBoundsExpression = [
  [-15.0, 88.0],
  [12.0, 148.0],
];

export type BasemapKey = "imagery" | "dark" | "light";

const BASEMAP_OPTIONS: Record<BasemapKey, { url: string; attribution: string }> = {
  imagery: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "&copy; Esri &mdash; Source: Esri, USGS, AeroGRID",
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CartoDB",
  },
  light: {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "&copy; OpenStreetMap contributors &copy; CartoDB",
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
  if (hazard === "drought") return { soft: "#fff3bf", dark: "#8a6300" };
  if (hazard === "flood") return { soft: "#eaf2ff", dark: "#174f92" };
  return { soft: "#f3e8ff", dark: "#5b21b6" };
}

function getHazardLegendTitle(hazard: string) {
  if (hazard === "flood") return "Indeks Banjir";
  if (hazard === "drought") return "Indeks Kekeringan";
  return "Indeks Bahaya";
}

function getHazardLegendSubtitle(hazard: string) {
  if (hazard === "flood") return "Kelas tetap - kedalaman genangan (m)";
  if (hazard === "drought") return "Kelas tetap - indeks kekeringan";
  return "Kelas tetap per hazard";
}

function formatHazardValue(value: number, hazard: string) {
  if (hazard === "flood") {
    return `${value.toLocaleString("id-ID", {
      maximumFractionDigits: 3,
    })} m`;
  }
  return value.toFixed(3);
}

function getFixedHazardLegendItems(
  hazard: string,
  breaks: number[],
  getColorFromBreaks: MapCanvasProps["getColorFromBreaks"]
): FixedLegendItem[] {
  if (hazard === "flood") {
    return [
      { color: getColorFromBreaks(0.25, breaks, hazard), label: "0 - <0,5 m" },
      { color: getColorFromBreaks(0.75, breaks, hazard), label: "0,5 - <1,0 m" },
      { color: getColorFromBreaks(1.5, breaks, hazard), label: "1,0 - <2,0 m" },
      { color: getColorFromBreaks(2.75, breaks, hazard), label: "2,0 - <3,5 m" },
      { color: getColorFromBreaks(3.6, breaks, hazard), label: ">=3,5 m" },
    ];
  }

  if (hazard === "drought") {
    return [
      { color: getColorFromBreaks(0.15, breaks, hazard), label: "0,00 - <0,30" },
      { color: getColorFromBreaks(0.375, breaks, hazard), label: "0,30 - <0,45" },
      { color: getColorFromBreaks(0.525, breaks, hazard), label: "0,45 - <0,60" },
      { color: getColorFromBreaks(0.675, breaks, hazard), label: "0,60 - <0,75" },
      { color: getColorFromBreaks(0.875, breaks, hazard), label: "0,75 - 1,00" },
    ];
  }

  return [];
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

function getVtStyle(
  props: Record<string, unknown>,
  activeLayers: Record<LayerKey, boolean>,
  getColorFromBreaks: MapCanvasProps["getColorFromBreaks"],
  jenksBreaks: number[],
  hazard: string,
  normalizedTopRegionKeys: Set<string>,
  selectedRegion: string,
  layerOpacity: number,
  basemapKey: BasemapKey
): Record<string, unknown> {
  const regionKey = normalizeRegionKey(props.kab_kota as string | undefined);
  const hasSelection = Boolean(selectedRegion);
  const isDimmed =
    hasSelection && regionKey !== normalizeRegionKey(selectedRegion);

  const isDark = basemapKey === "dark" || basemapKey === "imagery";

  if (!props.has_data) {
    return {
      fill: true,
      fillColor: isDark ? "#4b5563" : "#d1d5db",
      fillOpacity: isDimmed ? 0.06 : isDark ? 0.55 : 0.22,
      color: isDark ? "#6b7280" : "#9ca3af",
      weight: isDimmed ? 0.3 : 0.5,
      opacity: isDimmed ? 0.3 : 1,
    };
  }

  const isTopRegion = !isDimmed && normalizedTopRegionKeys.has(regionKey);

  let value: number | null | undefined = props.mean_value as
    | number
    | null
    | undefined;
  if (activeLayers.loss) value = props.loss as number | null | undefined;
  if (activeLayers.aal) value = props.aal as number | null | undefined;

  const fillOpacity = isDimmed ? Math.max(0.05, layerOpacity * 0.12) : layerOpacity;

  const defaultBorder = isDark ? "#94a3b8" : "#6b7280";

  return {
    fill: true,
    fillColor: getColorFromBreaks(value, jenksBreaks, hazard),
    fillOpacity,
    color: isDimmed
        ? (isDark ? "#374151" : "#d1d5db")
        : isTopRegion
          ? "#f59e0b"
          : defaultBorder,
    weight: isDimmed ? 0.3 : isTopRegion ? 1.3 : isDark ? 1.0 : 0.8,
    opacity: isDimmed ? 0.3 : 1,
    dashArray: isTopRegion ? "4 2" : undefined,
  };
}

// Formatter dipakai di tooltip dan legenda — harus sinkron.
function formatLayerValue(
  value: number | null | undefined,
  activeLayers: Record<LayerKey, boolean>,
  formatCompactRupiah: MapCanvasProps["formatCompactRupiah"],
  hazard: string
): string {
  if (value == null || Number.isNaN(value)) return "-";
  if (activeLayers.hazard) return formatHazardValue(value, hazard);
  if (activeLayers.loss || activeLayers.aal) return formatCompactRupiah(value);
  if (activeLayers.production) return `${value.toLocaleString("id-ID")} ton`;
  return formatCompactRupiah(value);
}

function getValueLabel(activeLayers: Record<LayerKey, boolean>): string {
  if (activeLayers.hazard) return "Indeks Bahaya";
  if (activeLayers.loss) return "Kerugian (Loss)";
  if (activeLayers.aal) return "Risiko Tahunan (AAL)";
  if (activeLayers.production) return "Total Produksi";
  return "Nilai";
}

function createTooltipHtml(params: {
  props: FeatureProps | null | undefined;
  accentColors: { soft: string; dark: string };
  formatCompactRupiah: MapCanvasProps["formatCompactRupiah"];
  activeLayers: Record<LayerKey, boolean>;
  normalizedTopRegionKeys: Set<string>;
  hazard: string;
  isDarkTheme: boolean;
}) {
  const {
    props,
    accentColors,
    formatCompactRupiah,
    activeLayers,
    normalizedTopRegionKeys,
    hazard,
    isDarkTheme,
  } = params;
  const safeKabKota = escapeHtml(props?.kab_kota ?? "-");
  const safeProv = escapeHtml(props?.prov ?? "-");
  const regionKey = normalizeRegionKey(props?.kab_kota);
  const isTop5 = normalizedTopRegionKeys.has(regionKey);
  const valueLabel = getValueLabel(activeLayers);
  const headerBg = isDarkTheme
    ? `linear-gradient(135deg, ${accentColors.dark}38, rgba(17, 28, 49, 0.96))`
    : accentColors.soft;
  const headerBorder = isDarkTheme ? `${accentColors.dark}66` : `${accentColors.dark}22`;
  const titleColor = isDarkTheme ? "#f8fbff" : accentColors.dark;
  const subtitleColor = isDarkTheme ? "#c7d4e7" : `${accentColors.dark}99`;
  const labelColor = isDarkTheme ? "#9fb0c8" : "#9ca3af";
  const valueColor = isDarkTheme ? "#f8fbff" : "#111827";
  const footerBg = isDarkTheme ? "#16233d" : "#f9fafb";
  const footerBorder = isDarkTheme ? "#22324d" : "#f3f4f6";
  const top5Bg = isDarkTheme ? "rgba(120, 53, 15, 0.34)" : "#fef3c7";
  const top5Text = isDarkTheme ? "#fcd34d" : "#92400e";
  const top5Border = isDarkTheme ? "rgba(251, 191, 36, 0.36)" : "#fcd34d";

  let value: number | null | undefined;
  if (activeLayers.hazard) value = props?.mean_value;
  else if (activeLayers.loss) value = props?.loss;
  else if (activeLayers.aal) value = props?.aal;
  else if (activeLayers.production) value = props?.total_prod;
  else value = props?.mean_value;

  const safeValue = escapeHtml(
    formatLayerValue(value, activeLayers, formatCompactRupiah, hazard)
  );

  const top5Badge = isTop5
    ? `<span style="
        display: inline-flex;
        align-items: center;
        gap: 3px;
        background: ${top5Bg};
        color: ${top5Text};
        border: 1px solid ${top5Border};
        border-radius: 999px;
        padding: 1px 7px;
        font-size: 9px;
        font-weight: 700;
        letter-spacing: 0.02em;
      ">★ Top 5</span>`
    : "";

  return `
    <div style="
      min-width: 160px;
      max-width: 200px;
      font-family: Figtree, sans-serif;
      line-height: 1.4;
      overflow: hidden;
    ">
      <div style="
        background: ${headerBg};
        margin: -8px -12px 8px -12px;
        padding: 7px 12px 6px;
        border-bottom: 1px solid ${headerBorder};
      ">
        <div style="font-size: 11.5px; font-weight: 800; color: ${titleColor}; margin-bottom: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
          ${safeKabKota}
        </div>
        <div style="font-size: 9.5px; color: ${subtitleColor};">
          ${safeProv}
        </div>
      </div>

      <div style="padding: 0 2px;">
        <div style="font-size: 9px; font-weight: 600; color: ${labelColor}; letter-spacing: 0.06em; text-transform: uppercase; margin-bottom: 3px;">
          ${escapeHtml(valueLabel)}
        </div>
        <div style="
          font-size: 13px;
          font-weight: 800;
          color: ${valueColor};
          margin-bottom: ${isTop5 ? "6px" : "0"};
        ">
          ${safeValue}
        </div>
        ${top5Badge}
      </div>

      <div style="
        margin: 7px -12px -8px;
        padding: 4px 12px;
        background: ${footerBg};
        border-top: 1px solid ${footerBorder};
        font-size: 9px;
        color: ${labelColor};
      ">
        Klik untuk zoom ke wilayah ini
      </div>
    </div>
  `;
}

function FitBounds({ selectedRegion }: { selectedRegion: string }) {
  const map = useMap();
  const hasFittedRef = useRef(false);

  useEffect(() => {
    if (hasFittedRef.current) return; // ResetViewController menangani reset berikutnya
    if (selectedRegion) return;
    hasFittedRef.current = true;
    const timer = window.setTimeout(() => {
      map.invalidateSize();
      map.fitBounds(INDONESIA_BOUNDS, { padding: FIT_BOUNDS_PADDING });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [map, selectedRegion]);

  return null;
}

function ResetViewController({
  resetViewSignal,
  dataBounds,
}: {
  resetViewSignal?: number;
  dataBounds?: DataBounds | null;
}) {
  const map = useMap();
  const lastHandledSignal = useRef(0);
  const dataBoundsRef = useRef(dataBounds);

  useEffect(() => {
    dataBoundsRef.current = dataBounds;
  }, [dataBounds]);

  useEffect(() => {
    if (!resetViewSignal || resetViewSignal === lastHandledSignal.current) return;
    lastHandledSignal.current = resetViewSignal;
    const bounds = dataBoundsRef.current;
    if (bounds) {
      map.flyToBounds(
        [[bounds.min_lat, bounds.min_lng], [bounds.max_lat, bounds.max_lng]],
        { padding: FIT_BOUNDS_PADDING, duration: RESET_DURATION }
      );
    } else {
      map.flyToBounds(INDONESIA_BOUNDS, { padding: FIT_BOUNDS_PADDING, duration: RESET_DURATION });
    }
  }, [resetViewSignal, map]);

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
    const updateZoom = () => onZoomChange(map.getZoom());
    updateZoom();
    map.on("zoomend", updateZoom);
    return () => { map.off("zoomend", updateZoom); };
  }, [map, onZoomChange]);

  return null;
}

// Zoom dari dropdown saja — klik peta langsung flyTo sendiri.
function ZoomToRegion({
  selectedRegion,
  regionCentroids,
  zoomSourceRef,
}: {
  selectedRegion: string;
  regionCentroids?: Record<string, [number, number]>;
  zoomSourceRef: React.MutableRefObject<"click" | null>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedRegion || !regionCentroids) return;
    if (zoomSourceRef.current === "click") {
      zoomSourceRef.current = null;
      return;
    }
    const coords = regionCentroids[selectedRegion.toLowerCase().trim()];
    if (!coords) return;
    map.flyTo(coords, 9, { duration: CLICK_FLY_DURATION });
  }, [selectedRegion, map, regionCentroids, zoomSourceRef]);

  return null;
}

export default function MapCanvas({
  data,
  layers,
  hazard,
  scenario,
  climate,
  runId,
  selectedRegion,
  mapRef,
  featureLayersRef: _featureLayersRef,
  jenksBreaks,
  topRegionKeys,
  styleConfig: _styleConfig = DEFAULT_STYLE_CONFIG,
  getColorFromBreaks,
  formatCompactRupiah,
  onRegionSelect,
  onResetView,
  onFocusFilters,
  isMapExpanded = false,
  onMobilePanelChange,
  mobileFilterContent,
  resetViewSignal = 0,
  activeLayers,
  onToggleLayer,
  dataBounds,
  regionCentroids,
}: MapCanvasProps) {
  const { theme } = useTheme();
  const isDarkTheme = theme === "dark";
  const vtLayersRef = useRef<Partial<Record<LayerKey | "selection" | "thematic", L.Layer>>>({});
  const popupRef = useRef<L.Popup | null>(null);
  const zoomSourceRef = useRef<"click" | null>(null);

  const [legendCollapsed, setLegendCollapsed] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [isMapReady, setIsMapReady] = useState(false);
  const [basemapKey, setBasemapKey] = useState<BasemapKey>("light");
  const [mobileSheetTab, setMobileSheetTab] = useState<MobilePanel>(null);
  const [layerOpacityMap, setLayerOpacityMap] = useState<Record<LayerKey, number>>({
    hazard: 1, loss: 1, aal: 1, production: 1, regions: 1,
  });

  const toggleMobileSheet = (tab: Exclude<MobilePanel, null>) => {
    setMobileSheetTab((prev) => (prev === tab ? null : tab));
  };

  const normalizedTopRegionKeys = useMemo(
    () => new Set(Array.from(topRegionKeys).map(normalizeRegionKey)),
    [topRegionKeys]
  );

  const hasRequiredFilters = Boolean(hazard && scenario && climate);

  const hasActiveTileLayer = Boolean(
    hasRequiredFilters &&
      (activeLayers.hazard ||
        activeLayers.loss ||
        activeLayers.aal ||
        activeLayers.production)
  );

  const accentColors = useMemo(() => getAccentColors(hazard), [hazard]);

  // Production punya VT layer sendiri dengan opacity terpisah.
  const activeLayerOpacity = useMemo(() => {
    if (activeLayers.hazard) return layerOpacityMap.hazard;
    if (activeLayers.loss) return layerOpacityMap.loss;
    if (activeLayers.aal) return layerOpacityMap.aal;
    return 1;
  }, [activeLayers, layerOpacityMap]);

  useEffect(() => {
    onMobilePanelChange?.(mobileSheetTab);
  }, [mobileSheetTab, onMobilePanelChange]);

  useEffect(() => {
    if (!isMapReady) return;
    const map = mapRef.current;
    if (!map) return;

    const frame = window.requestAnimationFrame(() => {
      map.invalidateSize();
    });
    const timer = window.setTimeout(() => {
      map.invalidateSize();
    }, 220);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [isMapExpanded, isMapReady, mapRef]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isMapReady) return;
    const map = mapRef.current;
    if (!map) return;

    let cancelled = false;

    (async () => {
      await import("leaflet.vectorgrid");
      if (cancelled) return;

    Object.values(vtLayersRef.current).forEach((layer) => {
      if (layer && map.hasLayer(layer)) map.removeLayer(layer);
    });
    vtLayersRef.current = {};

    if (!popupRef.current) {
      popupRef.current = L.popup({
        closeButton: false,
        autoPan: false,
        className: "vt-tooltip",
      });
    }

    const LVG = L as unknown as {
      vectorGrid: {
        protobuf: (url: string, opts: Record<string, unknown>) => L.Layer & {
          on: (event: string, handler: (e: Record<string, unknown>) => void) => void;
        };
      };
    };

    // Analysis layer dirender lebih dulu (di bawah production overlay).
    const analysisKey: LayerKey | null = activeLayers.hazard
      ? "hazard"
      : activeLayers.loss
        ? "loss"
        : activeLayers.aal
          ? "aal"
          : null;

    if (analysisKey && hasRequiredFilters) {
      const tileUrl = buildTileUrl(analysisKey, hazard, scenario, climate, runId ?? 0);

      const vtLayer = LVG.vectorGrid.protobuf(tileUrl, {
        vectorTileLayerStyles: {
          [analysisKey]: (props: Record<string, unknown>) =>
            getVtStyle(
              props,
              activeLayers,
              getColorFromBreaks,
              jenksBreaks,
              hazard,
              normalizedTopRegionKeys,
              selectedRegion,
              activeLayerOpacity,
              basemapKey
            ),
        },
        interactive: true,
        maxNativeZoom: 12,
        pane: "overlayPane",
      });

      vtLayer.on("mouseover", (e) => {
        const ev = e as unknown as { layer: { properties: FeatureProps }; latlng: L.LatLng };
        popupRef.current
          ?.setContent(createTooltipHtml({
            props: ev.layer.properties,
            accentColors,
            formatCompactRupiah,
            activeLayers,
            normalizedTopRegionKeys,
            hazard,
            isDarkTheme,
          }))
          .setLatLng(ev.latlng)
          .openOn(map);
      });
      vtLayer.on("mouseout", () => { popupRef.current?.close(); });
      vtLayer.on("click", (e) => {
        const ev = e as unknown as { layer: { properties: FeatureProps }; latlng: L.LatLng };
        zoomSourceRef.current = "click";
        onRegionSelect?.(ev.layer.properties?.kab_kota ?? "");
        if (ev.latlng) map.flyTo(ev.latlng, 9, { duration: CLICK_FLY_DURATION });
      });

      vtLayer.addTo(map);
      vtLayersRef.current.thematic = vtLayer;
    }

    // Production dirender di atas analysis layer.
    if (activeLayers.production && hasRequiredFilters) {
      const prodOpacity = layerOpacityMap.production;
      const prodUrl = buildTileUrl("production", hazard, scenario, climate, runId ?? 0);

      const isDark = basemapKey === "dark" || basemapKey === "imagery";
      const prodLayer = LVG.vectorGrid.protobuf(prodUrl, {
        vectorTileLayerStyles: {
          production: (props: Record<string, unknown>) => {
            const rk = normalizeRegionKey(props.kab_kota as string | undefined);
            const hasSel = Boolean(selectedRegion);
            const isDim = hasSel && rk !== normalizeRegionKey(selectedRegion);
            return {
              fill: true,
              fillColor: "#ffa200",
              fillOpacity: isDim ? Math.max(0.05, prodOpacity * 0.12) : prodOpacity,
              color: isDim ? (isDark ? "#374151" : "#d1d5db") : "#ffb700",
              weight: isDim ? 0.3 : isDark ? 1.4 : 1.2,
              opacity: isDim ? 0.3 : 1,
            };
          },
        },
        interactive: true,
        maxNativeZoom: 12,
        pane: "overlayPane",
      });

      const productionOnlyLayers: Record<LayerKey, boolean> = { regions: false, hazard: false, loss: false, aal: false, production: true };

      prodLayer.on("mouseover", (e) => {
        const ev = e as unknown as { layer: { properties: FeatureProps }; latlng: L.LatLng };
        popupRef.current
          ?.setContent(createTooltipHtml({
            props: ev.layer.properties,
            accentColors,
            formatCompactRupiah,
            activeLayers: productionOnlyLayers,
            normalizedTopRegionKeys,
            hazard,
            isDarkTheme,
          }))
          .setLatLng(ev.latlng)
          .openOn(map);
      });
      prodLayer.on("mouseout", () => { popupRef.current?.close(); });
      prodLayer.on("click", (e) => {
        const ev = e as unknown as { layer: { properties: FeatureProps }; latlng: L.LatLng };
        zoomSourceRef.current = "click";
        onRegionSelect?.(ev.layer.properties?.kab_kota ?? "");
        if (ev.latlng) map.flyTo(ev.latlng, 9, { duration: CLICK_FLY_DURATION });
      });

      prodLayer.addTo(map);
      vtLayersRef.current.production = prodLayer;
    }

    // Batas administrasi — outline only, non-interactive.
    if (activeLayers.regions) {
      const regionUrl = `${BASE_URL}/api/tiles/regions/{z}/{x}/{y}`;

      const regionLayer = LVG.vectorGrid.protobuf(regionUrl, {
        vectorTileLayerStyles: {
          regions: () => ({
            fill: false,
            fillOpacity: 0,
            color: "#9ca3af",
            weight: 1,
            opacity: 0.6,
          }),
        },
        interactive: false,
        maxNativeZoom: 12,
        pane: "overlayPane",
      });

      regionLayer.addTo(map);
      vtLayersRef.current.regions = regionLayer;
    }

    if (selectedRegion) {
      const selectionUrl = `${BASE_URL}/api/tiles/regions/{z}/{x}/{y}`;
      const selectedKey = normalizeRegionKey(selectedRegion);

      const selectionLayer = LVG.vectorGrid.protobuf(selectionUrl, {
        vectorTileLayerStyles: {
          regions: (props: Record<string, unknown>) => {
            const isSelected =
              normalizeRegionKey(props.kab_kota as string | undefined) === selectedKey;
            return {
              fill: false,
              fillOpacity: 0,
              color: getSelectedBorderColor(hazard),
              weight: isSelected ? 3 : 0,
              opacity: isSelected ? 1 : 0,
            };
          },
        },
        interactive: false,
        maxNativeZoom: 12,
        pane: "overlayPane",
      });

      selectionLayer.addTo(map);
      vtLayersRef.current.selection = selectionLayer;
    }
    })();

    return () => { cancelled = true; };
  }, [
    isMapReady,
    mapRef,
    activeLayers,
    hazard,
    scenario,
    climate,
    runId,
    jenksBreaks,
    hasRequiredFilters,
    getColorFromBreaks,
    formatCompactRupiah,
    accentColors,
    onRegionSelect,
    normalizedTopRegionKeys,
    selectedRegion,
    activeLayerOpacity,
    layerOpacityMap.production,
    basemapKey,
    isDarkTheme,
  ]);

  const legendItems = useMemo(() => {
    if (!jenksBreaks.length) return [];
    if (activeLayers.hazard) {
      return getFixedHazardLegendItems(hazard, jenksBreaks, getColorFromBreaks);
    }
    return jenksBreaks.map((upper, index) => {
      const lower = index === 0 ? 0 : (jenksBreaks[index - 1] ?? 0);
      const sampleValue = upper ?? lower;
      return {
        color: getColorFromBreaks(sampleValue, jenksBreaks, hazard),
        label: `${formatLayerValue(lower, activeLayers, formatCompactRupiah, hazard)} - ${formatLayerValue(upper, activeLayers, formatCompactRupiah, hazard)}`,
      };
    });
  }, [jenksBreaks, hazard, activeLayers, getColorFromBreaks, formatCompactRupiah]);

  const legendTitle = activeLayers.hazard
    ? getHazardLegendTitle(hazard)
    : activeLayers.loss
      ? "Kerugian (Loss)"
      : activeLayers.aal
        ? "Risiko Tahunan (AAL)"
        : "Legenda";

  const legendSubtitle = activeLayers.hazard
    ? getHazardLegendSubtitle(hazard)
    : activeLayers.loss || activeLayers.aal
      ? "Log-quantile - mengikuti filter aktif"
      : "Distribusi kelas data";

  const hasAnalysisLayer = activeLayers.hazard || activeLayers.loss || activeLayers.aal;
  const hasLegend = hasAnalysisLayer && legendItems.length > 0;

  useEffect(() => {
    if (mobileSheetTab === "legend" && !hasLegend) {
      setMobileSheetTab("layer");
    }
  }, [hasLegend, mobileSheetTab]);

  const mobileActionButtons = [
    {
      key: "filter",
      label: "Filter",
      icon: Filter,
      onClick: () => {
        toggleMobileSheet("filter");
      },
      disabled: !mobileFilterContent && !onFocusFilters,
      active: mobileSheetTab === "filter",
    },
    {
      key: "layer",
      label: "Layer",
      icon: Layers3,
      onClick: () => toggleMobileSheet("layer"),
      disabled: false,
      active: mobileSheetTab === "layer",
    },
    {
      key: "reset",
      label: "Reset tampilan",
      icon: LocateFixed,
      onClick: onResetView,
      disabled: !onResetView,
      active: false,
    },
  ];

  if (hasLegend) {
    mobileActionButtons.push({
      key: "legend",
      label: "Legenda",
      icon: Palette,
      onClick: () => toggleMobileSheet("legend"),
      disabled: false,
      active: mobileSheetTab === "legend",
    });
  }

  // Nama dari production features — mencakup semua kabupaten.
  const regionNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const f of (layers?.production?.features ?? [])) {
      const name = f?.properties?.kab_kota;
      if (name) map[name.toLowerCase().trim()] = name;
    }
    return map;
  }, [layers?.production]);

  const showLabels =
    (currentZoom >= LABEL_MIN_ZOOM && hasActiveTileLayer) ||
    (currentZoom >= 8 && activeLayers.regions);

  const regionLabels = useMemo<RegionLabel[]>(() => {
    if (!showLabels || !regionCentroids || !Object.keys(regionCentroids).length) return [];
    return Object.entries(regionCentroids).map(([key, coords], index) => ({
      id: `label-${key}-${index}`,
      name: regionNameMap[key] ?? key,
      position: coords as L.LatLngExpression,
    }));
  }, [showLabels, regionCentroids, regionNameMap]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapContainer
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        maxBounds={MAX_BOUNDS}
        maxBoundsViscosity={0.7}
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
        <TileLayer
          key={basemapKey}
          attribution={BASEMAP_OPTIONS[basemapKey].attribution}
          url={BASEMAP_OPTIONS[basemapKey].url}
        />
        <FitBounds selectedRegion={selectedRegion} />
        <ResetViewController
          resetViewSignal={resetViewSignal}
          dataBounds={dataBounds}
        />

        {showLabels &&
          regionLabels.map((item) => {
            const fontSize =
              currentZoom >= 10 ? "10px" :
              currentZoom >= 9  ? "9px"  :
              currentZoom >= 8  ? "8px"  : "7px";
            const opacity =
              currentZoom >= 10 ? 1    :
              currentZoom >= 9  ? 0.90 :
              currentZoom >= 8  ? 0.75 : 0.60;

            const icon: DivIcon = L.divIcon({
              className: "kabkota-label-icon",
              html: `
                <div style="
                  font-family: Figtree, sans-serif;
                  font-size: ${fontSize};
                  font-weight: 700;
                  color: #ffffff;
                  line-height: 1.1;
                  white-space: nowrap;
                  pointer-events: none;
                  transform: translate(-50%, -50%);
                  padding: 1px 4px;
                  opacity: ${opacity};
                  text-shadow:
                    0 0 3px rgba(0,0,0,0.95),
                    0 0 6px rgba(0,0,0,0.7),
                    1px  1px 0 rgba(0,0,0,0.8),
                   -1px -1px 0 rgba(0,0,0,0.8),
                    1px -1px 0 rgba(0,0,0,0.8),
                   -1px  1px 0 rgba(0,0,0,0.8);
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

        <ZoomToRegion
          selectedRegion={selectedRegion}
          regionCentroids={regionCentroids}
          zoomSourceRef={zoomSourceRef}
        />
      </MapContainer>

      <div className="pointer-events-none absolute left-4 top-4 z-[1061] flex gap-2 md:hidden">
        {mobileActionButtons.map((button) => {
          const Icon = button.icon;
          return (
            <button
              key={button.key}
              type="button"
              onClick={button.onClick}
              disabled={button.disabled}
              className={`pointer-events-auto flex h-11 w-11 items-center justify-center rounded-xl border shadow-md backdrop-blur transition ${
                button.active
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                  : "border-[var(--dashboard-border-solid)] bg-[var(--dashboard-control-bg)] text-[var(--color-primary)]"
              } disabled:cursor-not-allowed disabled:opacity-50`}
              aria-label={button.label}
              title={button.label}
            >
              <Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>

      <div className="hidden md:block">
        <MapLayerControlPanel
          activeLayers={activeLayers}
          onToggleLayer={onToggleLayer}
          layerOpacity={layerOpacityMap}
          onOpacityChange={(key, val) =>
            setLayerOpacityMap((prev) => ({ ...prev, [key]: val }))
          }
          basemap={basemapKey}
          onBasemapChange={setBasemapKey}
          hazard={hazard}
        />
      </div>

      {hasLegend && (
        <div className="hidden md:block">
          <MapLegendPanel
            title={legendTitle}
            subtitle={legendSubtitle}
            items={legendItems}
            collapsed={legendCollapsed}
            onToggle={() => setLegendCollapsed((prev) => !prev)}
            showTop5Indicator={activeLayers.loss && topRegionKeys.size > 0}
          />
        </div>
      )}

      {mobileSheetTab !== null && (
        <>
          <button
            type="button"
            className="absolute inset-0 z-[1061] bg-[var(--dashboard-sheet-backdrop)] md:hidden"
            aria-label="Tutup bottom sheet"
            onClick={() => setMobileSheetTab(null)}
          />
          <div
            className={`absolute inset-x-3 z-[1062] md:hidden ${
              mobileSheetTab === "filter" ? "bottom-1.5" : "bottom-2"
            }`}
          >
            <div
              className={`flex flex-col overflow-hidden rounded-[22px] border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface)] shadow-xl backdrop-blur ${
                mobileSheetTab === "filter"
                  ? "max-h-[min(57vh,29rem)]"
                  : "max-h-[min(54vh,26rem)]"
              }`}
            >
              <div className="sticky top-0 z-20 flex-shrink-0 bg-[var(--dashboard-surface)] backdrop-blur">
                <div
                  className={`flex items-center justify-between gap-3 border-b border-[var(--dashboard-border-soft)] px-4 ${
                    mobileSheetTab === "filter" ? "py-3" : "py-3"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--dashboard-text)]">
                      {mobileSheetTab === "filter"
                        ? "Filter Analisis"
                        : mobileSheetTab === "layer"
                          ? "Pengaturan Layer"
                          : legendTitle}
                    </p>
                    {mobileSheetTab === "filter" ? (
                      <p className="truncate text-[11px] text-[var(--dashboard-text-muted)]">Atur parameter analisis peta</p>
                    ) : mobileSheetTab === "legend" ? (
                      <p className="truncate text-[11px] text-[var(--dashboard-text-muted)]">{legendSubtitle}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setMobileSheetTab(null)}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] text-[var(--dashboard-text-muted)] shadow-sm"
                    aria-label="Tutup bottom sheet"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div
                  className={`border-b border-[var(--dashboard-border-soft)] px-3 ${
                    mobileSheetTab === "filter" ? "pb-2.5 pt-1.5" : "py-2"
                  }`}
                >
                  <div
                    className={`grid gap-2 rounded-xl bg-[var(--dashboard-surface-muted)] p-1 ${
                      hasLegend ? "grid-cols-3" : "grid-cols-2"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleMobileSheet("filter")}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                        mobileSheetTab === "filter"
                          ? "bg-[var(--color-primary)] text-white shadow-sm"
                          : "text-[var(--dashboard-text-soft)]"
                      }`}
                    >
                      Filter
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMobileSheet("layer")}
                      className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                        mobileSheetTab === "layer"
                          ? "bg-[var(--dashboard-surface-solid)] text-[var(--color-primary)] shadow-sm"
                          : "text-[var(--dashboard-text-soft)]"
                      }`}
                    >
                      Layer
                    </button>
                    {hasLegend ? (
                      <button
                        type="button"
                        onClick={() => toggleMobileSheet("legend")}
                        className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                          mobileSheetTab === "legend"
                            ? "bg-[var(--dashboard-surface-solid)] text-[var(--color-primary)] shadow-sm"
                            : "text-[var(--dashboard-text-soft)]"
                        }`}
                      >
                        Legenda
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div
                className={`min-h-0 flex-1 overflow-y-auto ${
                  mobileSheetTab === "filter"
                    ? "px-3 pb-3 pt-3"
                    : "px-3 pb-3 pt-3"
                }`}
              >
                {mobileSheetTab === "filter" ? (
                  mobileFilterContent ?? (
                    <div className="rounded-xl border border-dashed border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-muted)] px-4 py-5 text-sm text-[var(--dashboard-text-muted)]">
                      Filter belum tersedia.
                    </div>
                  )
                ) : mobileSheetTab === "layer" ? (
                  <div className="[&>div]:!static [&>div]:!w-full">
                    <MapLayerControlPanel
                      activeLayers={activeLayers}
                      onToggleLayer={onToggleLayer}
                      layerOpacity={layerOpacityMap}
                      onOpacityChange={(key, val) =>
                        setLayerOpacityMap((prev) => ({ ...prev, [key]: val }))
                      }
                      basemap={basemapKey}
                      onBasemapChange={setBasemapKey}
                      hazard={hazard}
                      compact
                    />
                  </div>
                ) : (
                  <MapLegendPanel
                    title={legendTitle}
                    subtitle={legendSubtitle}
                    items={legendItems}
                    collapsed={legendCollapsed}
                    onToggle={() => setLegendCollapsed((prev) => !prev)}
                    showTop5Indicator={activeLayers.loss && topRegionKeys.size > 0}
                    inline
                  />
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
