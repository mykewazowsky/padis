"use client";

import { ChevronDown, ChevronUp, Palette } from "lucide-react";

type LegendItem = {
  color: string;
  label: string;
};

export type LayerKey =
  | "regions"
  | "production"
  | "loss"
  | "aal"
  | "hazard";

type Props = {
  title: string;
  subtitle?: string;
  items: LegendItem[];
  collapsed: boolean;
  onToggle: () => void;
  /** When true, shows a Top-5 amber indicator matching the map highlight. */
  showTop5Indicator?: boolean;
  /** When true, shows a gray "Tidak ada data" entry at the bottom. */
  showNoDataIndicator?: boolean;
  inline?: boolean;
};

export default function MapLegendPanel({
  title,
  subtitle = "Distribusi kelas data",
  items,
  collapsed,
  onToggle,
  showTop5Indicator = false,
  showNoDataIndicator = false,
  inline = false,
}: Props) {
  return (
    <div
      className={
        inline
          ? "w-full rounded-xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface)] p-3 shadow-sm"
          : "absolute bottom-4 right-4 z-[1060] w-64 rounded-xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface)] p-3 shadow-md backdrop-blur"
      }
    >
      {/* HEADER */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="rounded-lg border border-[var(--dashboard-border-soft)] bg-[var(--dashboard-active-surface)] p-1.5">
            <Palette className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          </div>

          <div>
            <h3 className="text-xs font-semibold text-[var(--dashboard-text)]">
              {title}
            </h3>
            <p className="text-[10px] text-[var(--dashboard-text-muted)]">
              {subtitle}
            </p>
          </div>
        </div>

        {/* TOGGLE */}
        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1 text-[var(--dashboard-text-muted)] transition hover:bg-[var(--dashboard-control-hover)] hover:text-[var(--dashboard-text)]"
          aria-label={collapsed ? "Buka legenda" : "Tutup legenda"}
        >
          {collapsed ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronUp className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* CONTENT */}
      {!collapsed && (
        <>
          <div className="mt-3 space-y-1.5">
            {items.map((item, index) => (
              <div
                key={`${item.label}-${index}`}
                className="flex items-center gap-2"
              >
                <div
                  className="h-3 w-3 flex-shrink-0 rounded-sm border border-[var(--dashboard-border-solid)]"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] text-[var(--dashboard-text)]">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {(showNoDataIndicator || showTop5Indicator) && (
            <div className="mt-2.5 space-y-1.5 border-t border-[var(--dashboard-border-soft)] pt-2.5">
              {showNoDataIndicator && (
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 flex-shrink-0 rounded-sm border border-[var(--dashboard-border-solid)] bg-[#d1d5db] dark:bg-[#4b5563]" />
                  <span className="text-[11px] italic text-[var(--dashboard-text-muted)]">
                    Tidak ada data
                  </span>
                </div>
              )}
              {showTop5Indicator && (
                <div className="flex items-center gap-2">
                  {/* Amber border swatch matches the map highlight for top-5 regions */}
                  <div className="h-3 w-3 flex-shrink-0 rounded-sm border-2 border-amber-400 bg-[var(--dashboard-surface-solid)]" />
                  <span className="text-[11px] text-[var(--dashboard-text)]">
                    Top 5 wilayah terdampak
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
