"use client";

import { Download, FileText, LocateFixed, X } from "lucide-react";
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

type Props = {
  selectedFeature: SelectedFeature;
  hasActiveRegion?: boolean;
  selectedRegionShare?: number;
  selectedRegionAalShare?: number;
  isTopRegion?: boolean;
  activeLayers: Record<LayerKey, boolean>;
  onResetView?: () => void;
  /** Deselects the region without resetting map position. */
  onClearRegion?: () => void;
  onDownloadCsv?: () => void;
  onGenerateReport?: () => void;
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

export default function DashboardMapOverlay({
  selectedFeature,
  hasActiveRegion = false,
  selectedRegionShare,
  selectedRegionAalShare,
  isTopRegion = false,
  activeLayers,
  onResetView,
  onClearRegion,
  onDownloadCsv,
  onGenerateReport,
}: Props) {
  const props = selectedFeature?.properties;

  return (
    <>
      {/* ── Top-right action buttons ─────────────────────────────────────── */}
      <div className="pointer-events-none absolute right-4 top-4 z-[500] flex flex-col gap-2">
        <div className="pointer-events-auto flex flex-col gap-2">
          <button
            type="button"
            onClick={onResetView}
            className={
              hasActiveRegion
                ? "btn-primary text-xs font-medium shadow-sm"
                : "btn-outline text-xs font-medium shadow-sm backdrop-blur"
            }
          >
            <LocateFixed className="h-4 w-4" />
            <span className="hidden sm:inline">{hasActiveRegion ? "Reset View" : "Fit to Data"}</span>
          </button>

          <button
            type="button"
            onClick={onDownloadCsv}
            className="btn-outline text-xs font-medium shadow-sm backdrop-blur"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Unduh CSV</span>
          </button>

          <button
            type="button"
            onClick={onGenerateReport}
            className="btn-primary text-xs font-medium shadow-sm"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Generate Report</span>
          </button>
        </div>
      </div>

      {/* ── Selected region card ─────────────────────────────────────────── */}
      {selectedFeature && props ? (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 z-[500] sm:right-auto sm:w-80">
          <div className="pointer-events-auto card card-accent-primary bg-white/95 p-4 backdrop-blur">

            {/* Header */}
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
                    <span className="badge badge-secondary">Top 5</span>
                  )}
                  <span className="badge badge-primary">Aktif</span>
                  {onClearRegion && (
                    <button
                      type="button"
                      onClick={onClearRegion}
                      className="ml-1 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                      aria-label="Hapus pilihan wilayah"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Data rows */}
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
                      {formatPercent(selectedRegionShare)} dari total loss
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
                    Skala 0 – 1 (lebih tinggi = lebih berbahaya)
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
