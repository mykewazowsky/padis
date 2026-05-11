"use client";

import { useState } from "react";
import { Download, FileText, Lock, Loader2, LocateFixed, Maximize2, Minimize2, X } from "lucide-react";
import { getToken } from "@/lib/auth";
import type { LayerKey } from "@/components/map/core/MapLegendPanel";

type SelectedFeature = {
  properties: {
    kab_kota?: string;
    prov?: string;
    loss?: number | null;
    aal?: number | null;
    mean_value?: number | null;
    total_prod?: number | null;
  };
} | null;

export type MobilePanel = "filter" | "layer" | "legend" | null;

type Props = {
  selectedFeature: SelectedFeature;
  hasActiveRegion?: boolean;
  selectedRegionShare?: number;
  selectedRegionAalShare?: number;
  isTopRegion?: boolean;
  activeLayers: Record<LayerKey, boolean>;
  hazard?: string;
  onResetView?: () => void;
  /** Deselects the region without resetting map position. */
  onClearRegion?: () => void;
  onDownloadCsv?: () => void;
  onGenerateReport?: () => void;
  isMapExpanded?: boolean;
  onToggleMapExpanded?: () => void;
  isMapTransitioning?: boolean;
  mobilePanel?: MobilePanel;
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "Rp 0";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return null;
  return `${value.toFixed(1)}%`;
}

function formatProduksi(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "0 ton";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} jt ton`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)} rb ton`;
  return `${Math.round(value).toLocaleString("id-ID")} ton`;
}

function getPrimaryMetric(
  activeLayers: Record<LayerKey, boolean>,
  props: NonNullable<SelectedFeature>["properties"]
) {
  if (activeLayers.loss) {
    return { label: "Loss", value: formatCurrency(props.loss) };
  }

  if (activeLayers.aal) {
    return { label: "AAL", value: formatCurrency(props.aal) };
  }

  if (activeLayers.hazard) {
    return {
      label: "Indeks",
      value: props.mean_value != null ? Number(props.mean_value).toFixed(4) : "-",
    };
  }

  if (activeLayers.production) {
    return { label: "Produksi", value: formatProduksi(props.total_prod) };
  }

  return null;
}

export default function DashboardMapOverlay({
  selectedFeature,
  hasActiveRegion = false,
  selectedRegionShare,
  selectedRegionAalShare,
  isTopRegion = false,
  activeLayers,
  hazard,
  onResetView,
  onClearRegion,
  onDownloadCsv,
  onGenerateReport,
  isMapExpanded = false,
  onToggleMapExpanded,
  isMapTransitioning = false,
  mobilePanel = null,
}: Props) {
  const isAuthenticated = !!getToken();
  const [exportingCsv, setExportingCsv] = useState(false);

  function handleCsv() {
    if (!onDownloadCsv || exportingCsv) return;
    setExportingCsv(true);
    onDownloadCsv();
    setTimeout(() => setExportingCsv(false), 4000);
  }

  function handleReport() {
    onGenerateReport?.();
  }

  const props = selectedFeature?.properties;
  const primaryMetric = props ? getPrimaryMetric(activeLayers, props) : null;
  const shouldShowMobileSummary =
    !!selectedFeature &&
    !!props &&
    !mobilePanel &&
    !isMapTransitioning;

  return (
    <>
      {/* ── Map transition overlay ────────────────────────────────────────── */}
      <div
        className={`absolute inset-0 z-[460] flex flex-col items-center justify-center gap-3 backdrop-blur-md transition-opacity duration-300 ${
          isMapTransitioning ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        style={{ backgroundColor: "rgba(13, 33, 55, 0.52)" }}
      >
        <Loader2 className="h-9 w-9 animate-spin text-white drop-shadow-lg" />
        <p className="text-sm font-semibold tracking-wide text-white drop-shadow-lg">
          Memuat Data Spasial...
        </p>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 z-[1070] hidden flex-col gap-2 md:flex">
        <div className="pointer-events-auto flex flex-col gap-2">
          {onToggleMapExpanded ? (
            <button
              type="button"
              onClick={onToggleMapExpanded}
              className="btn-outline text-xs font-medium shadow-sm backdrop-blur transition-opacity"
              aria-label={isMapExpanded ? "Keluar mode layar penuh" : "Perbesar peta"}
              title={isMapExpanded ? "Keluar mode layar penuh" : "Perbesar peta"}
            >
              {isMapExpanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">
                {isMapExpanded ? "Keluar Fullscreen" : "Perbesar Peta"}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={onResetView}
            className={
              hasActiveRegion
                ? "btn-primary text-xs font-medium shadow-sm transition-opacity"
                : "btn-outline text-xs font-medium shadow-sm backdrop-blur transition-opacity"
            }
          >
            <LocateFixed className="h-4 w-4" />
            <span className="hidden sm:inline">{hasActiveRegion ? "Reset Tampilan" : "Sesuaikan Peta"}</span>
          </button>

          <button
            type="button"
            onClick={handleCsv}
            disabled={exportingCsv}
            title={isAuthenticated ? undefined : "Login diperlukan untuk mengunduh CSV."}
            className="btn-outline text-xs font-medium shadow-sm backdrop-blur transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
          >
            {exportingCsv
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : isAuthenticated
                ? <Download className="h-4 w-4" />
                : <Lock className="h-4 w-4 opacity-70" />
            }
            <span className="hidden sm:inline">{exportingCsv ? "Memuat..." : "Unduh CSV"}</span>
          </button>

          <button
            type="button"
            onClick={handleReport}
            className="btn-primary text-xs font-medium shadow-sm transition-opacity"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Buat Laporan</span>
          </button>
        </div>
      </div>

      {shouldShowMobileSummary ? (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[500] md:hidden">
          <div className="pointer-events-auto rounded-2xl border border-[var(--dashboard-border)] bg-[var(--dashboard-surface)] px-3 py-2 shadow-lg backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--dashboard-text)]">
                  {props.kab_kota || "-"}
                </p>
                {primaryMetric ? (
                  <p className="mt-0.5 text-xs text-[var(--dashboard-text-muted)]">
                    <span className="font-medium text-[var(--dashboard-text)]">{primaryMetric.label}</span>{" "}
                    {primaryMetric.value}
                  </p>
                ) : null}
              </div>

              {onClearRegion && (
                <button
                  type="button"
                  onClick={onClearRegion}
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] text-[var(--dashboard-text-muted)] shadow-sm"
                  aria-label="Hapus pilihan wilayah"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {selectedFeature && props ? (
        <div className="pointer-events-none absolute bottom-20 left-4 right-4 z-[500] hidden sm:bottom-4 sm:right-auto sm:w-80 md:block">
          <div className="pointer-events-auto card card-accent-primary bg-[var(--dashboard-surface)] p-4 backdrop-blur">

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="section-eyebrow text-[10px]">Wilayah Terpilih</p>
                <h3 className="mt-0.5 truncate text-sm font-bold text-heading">
                  {props.kab_kota || "-"}
                </h3>
                <p className="mt-0.5 text-xs text-muted">
                  {props.prov || "-"}
                </p>
              </div>

              <div className="flex flex-shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-1">
                  {isTopRegion && (
                    <span className="inline-flex rounded-full border border-[var(--dashboard-status-warning-border)] bg-[var(--dashboard-status-warning-bg)] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--dashboard-status-warning-text)]">Top 5</span>
                  )}
                  <span className="inline-flex rounded-full border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-active-surface)] px-2.5 py-1 text-[11px] font-semibold leading-none text-[var(--color-primary)]">Aktif</span>
                  {onClearRegion && (
                    <button
                      type="button"
                      onClick={onClearRegion}
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-[var(--dashboard-text-soft)] transition hover:bg-[var(--dashboard-control-hover)] hover:text-[var(--dashboard-text)]"
                      aria-label="Hapus pilihan wilayah"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {activeLayers.loss && (
                <div className="surface-soft rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Kerugian (Loss)
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-heading break-words">
                    {formatCurrency(props.loss)}
                  </p>
                  {formatPercent(selectedRegionShare) && (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatPercent(selectedRegionShare)} dari total kerugian
                    </p>
                  )}
                </div>
              )}

              {activeLayers.aal && (
                <div className="surface-soft rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Risiko Tahunan (AAL)
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-heading break-words">
                    {formatCurrency(props.aal)}
                  </p>
                  {formatPercent(selectedRegionAalShare) && (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {formatPercent(selectedRegionAalShare)} dari total AAL
                    </p>
                  )}
                </div>
              )}

              {activeLayers.hazard && (
                <div className="surface-soft rounded-lg px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    Indeks Bahaya
                  </p>
                  <p className="mt-0.5 text-sm font-bold text-heading">
                    {props.mean_value != null
                      ? Number(props.mean_value).toFixed(4)
                      : "-"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    {hazard === "flood"
                      ? "Kedalaman genangan (m)"
                      : "Skala 0 – 1 (lebih tinggi = lebih berbahaya)"}
                  </p>
                </div>
              )}

              {!activeLayers.loss &&
               !activeLayers.aal &&
               !activeLayers.hazard && (
                <div className="surface-soft rounded-lg px-3 py-2">
                  <p className="text-[11px] text-muted">
                    Aktifkan layer untuk melihat data wilayah ini.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
