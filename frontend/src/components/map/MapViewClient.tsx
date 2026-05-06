"use client";

import { useMemo, useRef, type ReactNode } from "react";
import type { Layer, Map as LeafletMap } from "leaflet";
import MapCanvas from "./core/MapCanvas";
import type { MobilePanel } from "@/components/dashboard/DashboardMapOverlay";
import type { LayerKey } from "@/components/map/core/MapLegendPanel";
import type { DataBounds, GeoJsonData } from "@/types/map";

type Props = {
  scenario: string;
  hazard: string;
  climate: string;
  runId: number;
  selectedRegion: string;
  onRegionSelect?: (region: string) => void;
  onResetView?: () => void;
  onFocusFilters?: () => void;
  isMapExpanded?: boolean;
  onMobilePanelChange?: (panel: MobilePanel) => void;
  mobileFilterContent?: ReactNode;

  data: GeoJsonData | null;
  dataBounds?: DataBounds | null;

  layers: {
    regions: GeoJsonData | null;
    production: GeoJsonData | null;
    loss: GeoJsonData | null;
    aal: GeoJsonData | null;
    hazard: GeoJsonData | null;
  };

  resetViewSignal?: number;
  activeLayers: Record<LayerKey, boolean>;
  onToggleLayer: (key: LayerKey) => void;
  regionCentroids?: Record<string, [number, number]>;
};

function formatCompactRupiah(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Rp 0";

  const abs = Math.abs(value);

  if (abs >= 1_000_000_000_000)
    return `Rp ${(value / 1_000_000_000_000).toFixed(1)} T`;
  if (abs >= 1_000_000_000)
    return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  if (abs >= 1_000_000)
    return `Rp ${(value / 1_000_000).toFixed(1)} jt`;

  return `Rp ${value}`;
}

// green=low risk, red=high risk
const RISK_PALETTE = ["#1a9850", "#91cf60", "#fee08b", "#fc8d59", "#d73027"];
const FLOOD_HAZARD_BREAKS = [0.5, 1, 2, 3.5, Number.POSITIVE_INFINITY];
const DROUGHT_HAZARD_BREAKS = [0.3, 0.45, 0.6, 0.75, 1];

// Quantile — untuk data yang distribusinya merata (production)
function quantileBreaks(values: number[], k = 5): number[] {
  if (!values.length) return [];
  const sorted = [...values].sort((a, b) => a - b);
  const breaks: number[] = [];
  for (let i = 1; i < k; i++) {
    breaks.push(sorted[Math.floor((i / k) * sorted.length)]);
  }
  breaks.push(sorted[sorted.length - 1]);
  return breaks;
}

// Kelas tetap untuk indeks banjir/kekeringan agar perbandingan RP/skenario stabil.
function getFixedHazardBreaks(hazard: string): number[] {
  if (hazard === "flood") return FLOOD_HAZARD_BREAKS;
  if (hazard === "drought") return DROUGHT_HAZARD_BREAKS;
  return [];
}

// Log-Quantile — untuk data miring kanan (loss, AAL) agar kelas tidak didominasi outlier
function logQuantileBreaks(values: number[], k = 5): number[] {
  if (!values.length) return [];
  const positives = values.filter((v) => v > 0);
  if (positives.length < k) return quantileBreaks(values, k);
  const logVals = positives.map((v) => Math.log10(v + 1));
  const logBreaks = quantileBreaks(logVals, k);
  return logBreaks.map((b) => +(Math.pow(10, b) - 1).toFixed(2));
}

function getColor(
  value: number | null | undefined,
  breaks: number[],
  _hazard: string
): string {
  if (value == null || Number.isNaN(value)) return "#e5e7eb";
  for (let i = 0; i < breaks.length; i++) {
    if (value <= breaks[i]) return RISK_PALETTE[i] ?? RISK_PALETTE[RISK_PALETTE.length - 1];
  }
  return RISK_PALETTE[RISK_PALETTE.length - 1];
}

export default function MapViewClient({
  scenario,
  hazard,
  climate,
  runId,
  selectedRegion,
  onRegionSelect,
  onResetView,
  onFocusFilters,
  isMapExpanded = false,
  onMobilePanelChange,
  mobileFilterContent,
  data,
  dataBounds,
  layers,
  resetViewSignal = 0,
  activeLayers,
  onToggleLayer,
  regionCentroids,
}: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const featureLayersRef = useRef<Record<string, Layer>>({});

  // Nilai per layer aktif, dipakai untuk skala warna yang akurat.
  const activeValues = useMemo(() => {
    if (activeLayers.hazard && layers?.hazard?.features?.length) {
      return layers.hazard.features.map(
        (f: any) => Number(f?.properties?.mean_value ?? 0)
      );
    }
    if (activeLayers.aal && layers?.aal?.features?.length) {
      return layers.aal.features.map(
        (f: any) => Number(f?.properties?.aal ?? 0)
      );
    }
    if (activeLayers.loss && layers?.loss?.features?.length) {
      return layers.loss.features.map(
        (f: any) => Number(f?.properties?.loss ?? 0)
      );
    }
    return [];
  }, [layers.loss, layers.aal, layers.hazard, activeLayers.loss, activeLayers.aal, activeLayers.hazard]);

  const breaks = useMemo(() => {
    if (!activeValues.length) return [];
    if (activeLayers.hazard) return getFixedHazardBreaks(hazard);
    if (activeLayers.aal || activeLayers.loss) return logQuantileBreaks(activeValues);
    return quantileBreaks(activeValues);
  }, [activeValues, activeLayers.hazard, activeLayers.aal, activeLayers.loss, hazard]);

  const topRegionKeys = useMemo(() => {
    if (!layers?.loss?.features?.length) return new Set<string>();

    return new Set(
      [...layers.loss.features]
        .sort(
          (a: any, b: any) =>
            (b.properties?.loss ?? 0) - (a.properties?.loss ?? 0)
        )
        .slice(0, 5)
        .map((f: any) =>
          f.properties?.kab_kota?.toLowerCase().trim()
        )
    );
  }, [layers.loss]);

  return (
    <div className="relative h-full w-full">
      <MapCanvas
        data={data}
        dataBounds={dataBounds}
        layers={layers}

        hazard={hazard}
        scenario={scenario}
        climate={climate}
        runId={runId}
        selectedRegion={selectedRegion}

        mapRef={mapRef}
        featureLayersRef={featureLayersRef}

        jenksBreaks={breaks}
        topRegionKeys={topRegionKeys}

        getColorFromBreaks={getColor}
        formatCompactRupiah={formatCompactRupiah}

        onRegionSelect={onRegionSelect}
        onResetView={onResetView}
        onFocusFilters={onFocusFilters}
        isMapExpanded={isMapExpanded}
        onMobilePanelChange={onMobilePanelChange}
        mobileFilterContent={mobileFilterContent}
        resetViewSignal={resetViewSignal}

        activeLayers={activeLayers}
        onToggleLayer={onToggleLayer}
        layerOpacity={1}
        onOpacityChange={() => {}}
        regionCentroids={regionCentroids}
      />
    </div>
  );
}
