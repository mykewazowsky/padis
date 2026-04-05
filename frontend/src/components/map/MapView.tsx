"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import DashboardMapOverlay from "@/components/dashboard/DashboardMapOverlay";
import type { GeoJsonData } from "@/types/map";
import type { LayerKey } from "@/components/map/core/MapLegendPanel";

const MapViewClient = dynamic(() => import("./MapViewClient"), {
  ssr: false,
  loading: () => (
    <div className="map-shell relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />

      <div className="absolute left-4 top-4 rounded-xl bg-white/90 px-4 py-3 shadow-sm">
        <div className="h-3 w-24 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-100" />
      </div>

      <div className="absolute bottom-4 right-4 rounded-xl bg-white/90 px-4 py-3 shadow-sm">
        <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
        <div className="mt-2 h-3 w-28 animate-pulse rounded bg-gray-100" />
      </div>
    </div>
  ),
});

type Props = {
  scenario: string;
  hazard: string;
  climate: string;
  selectedRegion: string;
  onRegionSelect?: (region: string) => void;
  onResetView?: () => void;
  onDownloadCsv?: () => void;
  onGenerateReport?: () => void;
  data: GeoJsonData | null;
  resetViewSignal?: number;
  activeLayers: Record<LayerKey, boolean>;
  onToggleLayer: (key: LayerKey) => void;
};

export default function MapView({
  scenario,
  hazard,
  climate,
  selectedRegion,
  onRegionSelect,
  onResetView,
  onDownloadCsv,
  onGenerateReport,
  data,
  resetViewSignal,
  activeLayers,
  onToggleLayer,
}: Props) {
  const normalizedSelectedRegion = useMemo(
    () => selectedRegion.toLowerCase().trim(),
    [selectedRegion]
  );

  const selectedFeature = useMemo(() => {
    if (!data?.features?.length || !normalizedSelectedRegion) return null;

    return (
      data.features.find(
        (feature) =>
          feature.properties.kab_kota.toLowerCase().trim() ===
          normalizedSelectedRegion
      ) ?? null
    );
  }, [data, normalizedSelectedRegion]);

  const totalLoss = useMemo(() => {
    if (!data?.features?.length) return 0;

    return data.features.reduce(
      (sum, feature) => sum + (feature.properties.loss ?? 0),
      0
    );
  }, [data]);

  const selectedRegionShare = useMemo(() => {
    if (!selectedFeature?.properties.loss || !totalLoss) return null;
    return (selectedFeature.properties.loss / totalLoss) * 100;
  }, [selectedFeature, totalLoss]);

  const isTopRegion = useMemo(() => {
    if (!data?.features?.length || !selectedFeature) return false;

    const topFive = [...data.features]
      .sort((a, b) => (b.properties.loss ?? 0) - (a.properties.loss ?? 0))
      .slice(0, 5)
      .map((item) => item.properties.kab_kota.toLowerCase().trim());

    return topFive.includes(
      selectedFeature.properties.kab_kota.toLowerCase().trim()
    );
  }, [data, selectedFeature]);

  return (
    <div className="map-shell relative h-full w-full overflow-hidden">
      <MapViewClient
        scenario={scenario}
        hazard={hazard}
        climate={climate}
        selectedRegion={selectedRegion}
        onRegionSelect={onRegionSelect}
        data={data}
        resetViewSignal={resetViewSignal}
        activeLayers={activeLayers}
        onToggleLayer={onToggleLayer}
      />

      <DashboardMapOverlay
        selectedFeature={selectedFeature}
        hasActiveRegion={!!selectedRegion}
        selectedRegionShare={selectedRegionShare ?? undefined}
        isTopRegion={isTopRegion}
        onResetView={onResetView}
        onDownloadCsv={onDownloadCsv}
        onGenerateReport={onGenerateReport}
      />
    </div>
  );
}