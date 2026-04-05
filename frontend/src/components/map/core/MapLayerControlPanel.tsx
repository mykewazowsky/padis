"use client";

import { useState } from "react";
import { ChevronLeft, Layers3 } from "lucide-react";
import type { LayerKey } from "./MapLegendPanel";

type Props = {
  activeLayers: Partial<Record<LayerKey, boolean>>;
  onToggleLayer: (key: LayerKey) => void;
};

const LAYER_OPTIONS: Array<{ key: LayerKey; label: string }> = [
  { key: "geojson", label: "Peta Kerugian" },
  { key: "batas_adm", label: "Batas Administrasi" },
  { key: "sawah", label: "LULC Sawah" },
];

export default function MapLayerControlPanel({
  activeLayers,
  onToggleLayer,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);

  // MODE: CLOSED (hanya icon)
  if (!isOpen) {
    return (
      <div className="absolute left-4 top-4 z-[1060]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white/95 shadow-md backdrop-blur transition hover:bg-white"
          aria-label="Buka pengaturan layer"
          title="Buka pengaturan layer"
        >
          <Layers3 className="h-5 w-5 text-[var(--color-primary)]" />
        </button>
      </div>
    );
  }

  // MODE: OPEN (panel lengkap)
  return (
    <div className="absolute left-4 top-4 z-[1060] w-64 rounded-xl border border-gray-200 bg-white/95 p-3 shadow-md backdrop-blur">
      <div className="mb-3 flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5">
          <div className="rounded-lg bg-[var(--color-primary-soft)] p-1.5">
            <Layers3 className="h-4 w-4 text-[var(--color-primary)]" />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-800">
              Pengaturan Layer
            </h3>
            <p className="text-[11px] text-gray-500">
              Tampilkan layer
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-50 hover:text-gray-700"
          aria-label="Tutup pengaturan layer"
          title="Tutup pengaturan layer"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-2.5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
          Layer
        </div>

        <div className="space-y-2">
          {LAYER_OPTIONS.map((layer) => (
            <label
              key={layer.key}
              className="flex cursor-pointer items-center justify-between gap-3"
            >
              <span className="text-[12px] text-gray-700">
                {layer.label}
              </span>
              <input
                type="checkbox"
                checked={Boolean(activeLayers[layer.key])}
                onChange={() => onToggleLayer(layer.key)}
                className="h-4 w-4 accent-[var(--color-primary)]"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}