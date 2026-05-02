"use client";

import dynamic from "next/dynamic";
import { useMemo, useState, type ReactNode } from "react";
import DashboardMapOverlay from "@/components/dashboard/DashboardMapOverlay";
import type { MobilePanel } from "@/components/dashboard/DashboardMapOverlay";
import type { DataBounds, GeoJsonData } from "@/types/map";
import type { LayerKey } from "@/components/map/core/MapLegendPanel";

const MapViewClient = dynamic(() => import("./MapViewClient"), {
  ssr: false,
  loading: () => (
    <div className="map-shell relative h-full w-full overflow-hidden">
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-gray-100 via-gray-50 to-gray-100" />
    </div>
  ),
});

// =========================
// TYPES
// =========================
type Props = {
  scenario: string;
  hazard: string;
  climate: string;
  runId: number;
  selectedRegion: string;

  onRegionSelect?: (region: string) => void;
  onResetView?: () => void;
  onDownloadCsv?: () => void;
  onGenerateReport?: () => void;
  isMapTransitioning?: boolean;
  isMapExpanded?: boolean;
  onToggleMapExpanded?: () => void;
  onFocusFilters?: () => void;
  mobileFilterContent?: ReactNode;

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

export default function MapView({
  scenario,
  hazard,
  climate,
  runId,
  selectedRegion,
  layers,
  onRegionSelect,
  onResetView,
  onDownloadCsv,
  onGenerateReport,
  isMapTransitioning,
  isMapExpanded = false,
  onToggleMapExpanded,
  onFocusFilters,
  mobileFilterContent,
  resetViewSignal,
  activeLayers,
  onToggleLayer,
  regionCentroids,
}: Props) {
  const [mobileSheetTab, setMobileSheetTab] = useState<MobilePanel>(null);

  // =========================
  // SELECT ACTIVE DATA (for MapViewClient classification breaks)
  // =========================
  const data: GeoJsonData | null = useMemo(() => {
    if (activeLayers.loss && layers.loss) return layers.loss;
    if (activeLayers.aal && layers.aal) return layers.aal;
    if (activeLayers.hazard && layers.hazard) return layers.hazard;
    if (activeLayers.production && layers.production) return layers.production;
    return layers.regions ?? null;
  }, [
    layers.loss, layers.aal, layers.hazard, layers.production, layers.regions,
    activeLayers.loss, activeLayers.aal, activeLayers.hazard, activeLayers.production,
  ]);

  // =========================
  // NORMALIZE REGION
  // =========================
  const normalizedSelectedRegion = useMemo(
    () => selectedRegion?.toLowerCase().trim() ?? "",
    [selectedRegion]
  );

  // =========================
  // SELECTED FEATURE — merged from ALL layers
  // Ensures the overlay card always has complete data regardless of which
  // layer is currently active on the map.
  // =========================
  const selectedFeature = useMemo(() => {
    if (!normalizedSelectedRegion) return null;

    const findProps = (layerData: GeoJsonData | null) =>
      layerData?.features?.find(
        (f) => f?.properties?.kab_kota?.toLowerCase().trim() === normalizedSelectedRegion
      )?.properties ?? null;

    const lossProps    = findProps(layers.loss);
    const aalProps     = findProps(layers.aal);
    const hazardProps  = findProps(layers.hazard);
    const prodProps    = findProps(layers.production);

    // Need at least one source to confirm the region exists
    const primary = lossProps ?? aalProps ?? hazardProps ?? prodProps;
    if (!primary) return null;

    return {
      properties: {
        kab_kota:   primary.kab_kota,
        prov:       primary.prov,
        loss:       lossProps?.loss             ?? null,
        aal:        aalProps?.aal               ?? null,
        mean_value: hazardProps?.mean_value     ?? null,
        total_prod: prodProps?.total_prod       ?? null,
      },
    };
  }, [layers.loss, layers.aal, layers.hazard, layers.production, normalizedSelectedRegion]);

  // =========================
  // TOTAL LOSS & AAL
  // =========================
  const totalLoss = useMemo(() => {
    if (!layers?.loss?.features?.length) return 0;
    return layers.loss.features.reduce(
      (sum, f) => sum + Number(f?.properties?.loss ?? 0), 0
    );
  }, [layers.loss]);

  const totalAal = useMemo(() => {
    if (!layers?.aal?.features?.length) return 0;
    return layers.aal.features.reduce(
      (sum, f) => sum + Number(f?.properties?.aal ?? 0), 0
    );
  }, [layers.aal]);

  // =========================
  // REGION SHARE — always computed from respective layer totals
  // =========================
  const selectedRegionShare = useMemo(() => {
    if (!normalizedSelectedRegion || !totalLoss) return null;
    const lossFeature = layers.loss?.features?.find(
      (f) => f?.properties?.kab_kota?.toLowerCase().trim() === normalizedSelectedRegion
    );
    const loss = lossFeature?.properties?.loss;
    if (loss == null || loss === 0) return null;
    return (Number(loss) / totalLoss) * 100;
  }, [layers.loss, normalizedSelectedRegion, totalLoss]);

  const selectedRegionAalShare = useMemo(() => {
    if (!normalizedSelectedRegion || !totalAal) return null;
    const aalFeature = layers.aal?.features?.find(
      (f) => f?.properties?.kab_kota?.toLowerCase().trim() === normalizedSelectedRegion
    );
    const aal = aalFeature?.properties?.aal;
    if (aal == null || aal === 0) return null;
    return (Number(aal) / totalAal) * 100;
  }, [layers.aal, normalizedSelectedRegion, totalAal]);

  // =========================
  // DATA BOUNDS — auto-fit map to the extent of regions that have data
  // =========================
  const dataBounds = useMemo((): DataBounds | null => {
    if (activeLayers.loss)   return layers.loss?.data_bounds   ?? null;
    if (activeLayers.aal)    return layers.aal?.data_bounds    ?? null;
    if (activeLayers.hazard) return layers.hazard?.data_bounds ?? null;
    return null;
  }, [
    activeLayers.loss, activeLayers.aal, activeLayers.hazard,
    layers.loss, layers.aal, layers.hazard,
  ]);

  // =========================
  // TOP 5 (from loss layer)
  // =========================
  const isTopRegion = useMemo(() => {
    if (!normalizedSelectedRegion || !layers?.loss?.features?.length) return false;

    const topFive = [...layers.loss.features]
      .sort((a, b) => Number(b?.properties?.loss ?? 0) - Number(a?.properties?.loss ?? 0))
      .slice(0, 5)
      .map((item) => item?.properties?.kab_kota?.toLowerCase().trim());

    return topFive.includes(normalizedSelectedRegion);
  }, [layers.loss, normalizedSelectedRegion]);

  // =========================
  // RENDER
  // =========================
  return (
    <div className="map-shell relative h-full w-full overflow-hidden">
      {/* MAP */}
      <MapViewClient
        scenario={scenario}
        hazard={hazard}
        climate={climate}
        runId={runId}
        selectedRegion={selectedRegion}
        onRegionSelect={onRegionSelect}
        onResetView={onResetView}
        onFocusFilters={onFocusFilters}
        isMapExpanded={isMapExpanded}
        onMobilePanelChange={setMobileSheetTab}
        mobileFilterContent={mobileFilterContent}

        data={data}
        layers={layers}
        dataBounds={dataBounds}

        resetViewSignal={resetViewSignal}
        activeLayers={activeLayers}
        onToggleLayer={onToggleLayer}
        regionCentroids={regionCentroids}
      />

      {/* OVERLAY */}
      <DashboardMapOverlay
        selectedFeature={selectedFeature}
        hasActiveRegion={!!selectedRegion}
        selectedRegionShare={selectedRegionShare ?? undefined}
        selectedRegionAalShare={selectedRegionAalShare ?? undefined}
        isTopRegion={isTopRegion}
        activeLayers={activeLayers}
        onResetView={onResetView}
        onClearRegion={onRegionSelect ? () => onRegionSelect("") : undefined}
        onDownloadCsv={onDownloadCsv}
        onGenerateReport={onGenerateReport}
        isMapExpanded={isMapExpanded}
        onToggleMapExpanded={onToggleMapExpanded}
        isMapTransitioning={isMapTransitioning}
        mobilePanel={mobileSheetTab}
      />
    </div>
  );
}
