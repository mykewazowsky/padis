"use client";

import { Download, FileText, LocateFixed } from "lucide-react";

type SelectedFeature = {
  properties: {
    kab_kota: string;
    prov: string;
    loss: number | null;
    aal_nonclimate?: number | null;
    aal_climate?: number | null;
  };
} | null;

type Props = {
  selectedFeature: SelectedFeature;
  hasActiveRegion?: boolean;
  selectedRegionShare?: number;
  isTopRegion?: boolean;
  onResetView?: () => void;
  onDownloadCsv?: () => void;
  onGenerateReport?: () => void;
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

function formatPercent(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(1)}%`;
}

export default function DashboardMapOverlay({
  selectedFeature,
  hasActiveRegion = false,
  selectedRegionShare,
  isTopRegion = false,
  onResetView,
  onDownloadCsv,
  onGenerateReport,
}: Props) {
  return (
    <>
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
            {hasActiveRegion ? "Reset View" : "Fit to Data"}
          </button>

          <button
            type="button"
            onClick={onDownloadCsv}
            className="btn-outline text-xs font-medium shadow-sm backdrop-blur"
          >
            <Download className="h-4 w-4" />
            Unduh CSV
          </button>

          <button
            type="button"
            onClick={onGenerateReport}
            className="btn-primary text-xs font-medium shadow-sm"
          >
            <FileText className="h-4 w-4" />
            Generate Report
          </button>
        </div>
      </div>

      {selectedFeature ? (
        <div className="pointer-events-none absolute bottom-4 left-4 z-[500] w-80">
          <div className="pointer-events-auto card card-accent-primary bg-white/95 p-4 backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="section-eyebrow text-[10px]">Selected Region</p>
                <h3 className="mt-1 text-sm font-bold text-heading">
                  {selectedFeature.properties.kab_kota || "-"}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {selectedFeature.properties.prov || "-"}
                </p>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span className="badge badge-primary">Aktif</span>
                {isTopRegion ? (
                  <span className="badge badge-secondary">Top 5</span>
                ) : null}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="surface-soft px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Loss
                </p>
                <p className="mt-1 text-sm font-bold text-heading break-words">
                  {formatCurrency(selectedFeature.properties.loss)}
                </p>
                {selectedRegionShare != null ? (
                  <p className="mt-1 text-[11px] text-muted">
                    Kontribusi: {formatPercent(selectedRegionShare)} dari total loss
                  </p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div className="surface-soft px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    AAL Non-Climate
                  </p>
                  <p className="mt-1 text-xs font-semibold text-heading break-words">
                    {formatCurrency(selectedFeature.properties.aal_nonclimate)}
                  </p>
                </div>

                <div className="surface-soft px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                    AAL Climate
                  </p>
                  <p className="mt-1 text-xs font-semibold text-heading break-words">
                    {formatCurrency(selectedFeature.properties.aal_climate)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}