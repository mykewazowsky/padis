"use client";

import { useMemo, useRef } from "react";
import type { Layer, Map as LeafletMap } from "leaflet";
import MapCanvas from "@/components/map/core/MapCanvas";
import type { GeoJsonData } from "@/types/map";
import type { LayerKey } from "@/components/map/core/MapLegendPanel";

type Props = {
  scenario: string;
  hazard: string;
  climate: string;
  selectedRegion: string;
  onRegionSelect?: (region: string) => void;
  data: GeoJsonData | null;
  resetViewSignal?: number;
  activeLayers: Record<LayerKey, boolean>;
  onToggleLayer: (key: LayerKey) => void;
};

function formatCompactRupiah(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "Rp 0";

  const abs = Math.abs(value);

  if (abs >= 1_000_000_000_000) {
    return `Rp ${(value / 1_000_000_000_000).toFixed(1).replace(".0", "")} T`;
  }

  if (abs >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1).replace(".0", "")} M`;
  }

  if (abs >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1).replace(".0", "")} jt`;
  }

  if (abs >= 1_000) {
    return `Rp ${(value / 1_000).toFixed(1).replace(".0", "")} rb`;
  }

  return `Rp ${value}`;
}

function getHazardPalette(hazard: string) {
  if (hazard === "flood") {
    return ["#eff6ff", "#bfdbfe", "#60a5fa", "#2563eb", "#1d4ed8"];
  }

  if (hazard === "drought") {
    return ["#fff7ed", "#fed7aa", "#fb923c", "#ea580c", "#c2410c"];
  }

  return ["#f5f3ff", "#d8b4fe", "#a78bfa", "#7c3aed", "#5b21b6"];
}

function getStyleConfig(hazard: string) {
  if (hazard === "flood") {
    return {
      border: "#cbd5e1",
      hoverBorder: "#2563eb",
      topBorder: "#1d4ed8",
      baseOpacity: 0.8,
      hoverOpacity: 0.95,
    };
  }

  if (hazard === "drought") {
    return {
      border: "#d6d3d1",
      hoverBorder: "#c2410c",
      topBorder: "#b45309",
      baseOpacity: 0.82,
      hoverOpacity: 0.96,
    };
  }

  return {
    border: "#d8d4fe",
    hoverBorder: "#7c3aed",
    topBorder: "#5b21b6",
    baseOpacity: 0.82,
    hoverOpacity: 0.96,
  };
}

function createJenksLikeBreaks(values: number[], classCount = 5) {
  if (!values.length) return [];

  const sorted = [...values]
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);

  if (sorted.length === 1) return [sorted[0]];

  const breaks: number[] = [];

  for (let i = 1; i < classCount; i += 1) {
    const index = Math.min(
      sorted.length - 1,
      Math.floor((i / classCount) * sorted.length)
    );
    breaks.push(sorted[index]);
  }

  breaks.push(sorted[sorted.length - 1]);

  return Array.from(new Set(breaks));
}

function getColorFromBreaks(
  value: number | null | undefined,
  breaks: number[],
  hazard: string
) {
  if (value == null || Number.isNaN(value)) {
    return "#f3f4f6";
  }

  const palette = getHazardPalette(hazard);

  if (!breaks.length) {
    return palette[0];
  }

  for (let i = 0; i < breaks.length; i += 1) {
    if (value <= breaks[i]) {
      return palette[Math.min(i, palette.length - 1)];
    }
  }

  return palette[palette.length - 1];
}

export default function MapViewClient({
  scenario,
  hazard,
  climate,
  selectedRegion,
  onRegionSelect,
  data,
  resetViewSignal = 0,
  activeLayers,
  onToggleLayer,
}: Props) {
  const mapRef = useRef<LeafletMap | null>(null);
  const featureLayersRef = useRef<Record<string, Layer>>({});

  const losses = useMemo(() => {
    if (!data?.features?.length) return [];

    return data.features
      .map((feature) => feature.properties?.loss ?? 0)
      .filter((value) => Number.isFinite(value));
  }, [data]);

  const jenksBreaks = useMemo(() => {
    return createJenksLikeBreaks(losses, 5);
  }, [losses]);

  const topRegionKeys = useMemo(() => {
    if (!data?.features?.length) return new Set<string>();

    const topFive = [...data.features]
      .sort((a, b) => (b.properties?.loss ?? 0) - (a.properties?.loss ?? 0))
      .slice(0, 5)
      .map((item) => item.properties?.kab_kota?.toLowerCase().trim())
      .filter(Boolean) as string[];

    return new Set(topFive);
  }, [data]);

  const styleConfig = useMemo(() => getStyleConfig(hazard), [hazard]);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <MapCanvas
        data={data}
        hazard={hazard}
        scenario={scenario}
        climate={climate}
        selectedRegion={selectedRegion}
        mapRef={mapRef}
        featureLayersRef={featureLayersRef}
        jenksBreaks={jenksBreaks}
        topRegionKeys={topRegionKeys}
        styleConfig={styleConfig}
        getColorFromBreaks={getColorFromBreaks}
        formatCompactRupiah={formatCompactRupiah}
        onRegionSelect={onRegionSelect}
        resetViewSignal={resetViewSignal}
        activeLayers={activeLayers}
        onToggleLayer={onToggleLayer}
      />
    </div>
  );
}