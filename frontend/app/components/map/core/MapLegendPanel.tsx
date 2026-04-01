"use client";

import { ChevronDown, ChevronUp, Palette } from "lucide-react";

type LegendItem = {
  color: string;
  label: string;
};

export type LayerKey = "geojson" | "batas_adm" | "sawah";

type Props = {
  title: string;
  items: LegendItem[];
  collapsed: boolean;
  onToggle: () => void;
};

export default function MapLegendPanel({
  title,
  items,
  collapsed,
  onToggle,
}: Props) {
  return (
    <div className="absolute bottom-4 right-4 z-[1060] w-56 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-md backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <div className="rounded-lg bg-[var(--color-primary-soft)] p-1.5">
            <Palette className="h-3.5 w-3.5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h3 className="text-xs font-semibold text-gray-800">{title}</h3>
            <p className="text-[10px] text-gray-500">Distribusi (quantile)</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          className="rounded-md p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
          aria-label={collapsed ? "Buka legenda" : "Tutup legenda"}
        >
          {collapsed ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {!collapsed ? (
        <>
          <div className="mt-3 space-y-1.5">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-2">
                <div
                  className="h-3 w-3 rounded-sm border border-gray-300"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-[11px] text-gray-700">{item.label}</span>
              </div>
            ))}
          </div>

          <div className="mt-2.5 border-t border-gray-200 pt-2.5">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm border border-gray-500 bg-white" />
              <span className="text-[11px] text-gray-700">Top 5 highlight</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}