"use client";

import { useState } from "react";
import { ChevronLeft, Layers3 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import type { LayerKey } from "./MapLegendPanel";
import type { BasemapKey } from "./MapCanvas";
import LayerItem from "./LayerItem";

type LayerEntry = {
  id: LayerKey;
  label: string;
};

type LayerGroup = {
  id: string;
  groupName: string;
  layers: LayerEntry[];
};
type DesktopTab = "basemap" | "overlay" | "analysis";

const BASEMAP_LABELS: Record<BasemapKey, string> = {
  imagery: "Satelit",
  dark: "Gelap",
  light: "Terang",
};

type Props = {
  activeLayers: Partial<Record<LayerKey, boolean>>;
  onToggleLayer: (key: LayerKey) => void;
  layerOpacity?: Record<LayerKey, number>;
  onOpacityChange?: (key: LayerKey, opacity: number) => void;
  onGroupOrderChange?: (groupId: string, newOrder: LayerKey[]) => void;
  basemap?: BasemapKey;
  onBasemapChange?: (key: BasemapKey) => void;
  hazard?: string;
  compact?: boolean;
};

const THEMATIC_KEYS: LayerKey[] = ["hazard", "loss", "aal"];

const INITIAL_GROUPS: LayerGroup[] = [
  {
    id: "overlay",
    groupName: "Overlay",
    layers: [
      { id: "regions", label: "Batas Administrasi" },
      { id: "production", label: "Produksi Sawah" },
    ],
  },
  {
    id: "analysis",
    groupName: "Analisis",
    layers: [
      { id: "hazard", label: "Indeks Bahaya" },
      { id: "loss", label: "Kerugian (Loss)" },
      { id: "aal", label: "Risiko Tahunan (AAL)" },
    ],
  },
];

export default function MapLayerControlPanel({
  activeLayers,
  onToggleLayer,
  layerOpacity = {} as Record<LayerKey, number>,
  onOpacityChange = () => {},
  onGroupOrderChange,
  basemap = "imagery",
  onBasemapChange,
  hazard,
  compact = false,
}: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const [groups, setGroups] = useState<LayerGroup[]>(INITIAL_GROUPS);
  const [activeDesktopTab, setActiveDesktopTab] = useState<DesktopTab>(
    activeLayers.hazard || activeLayers.loss || activeLayers.aal
      ? "analysis"
      : activeLayers.regions || activeLayers.production
        ? "overlay"
        : "basemap"
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const handleToggle = (key: LayerKey) => {
    if (key === "hazard" && hazard === "multi") return;

    const isThematic = THEMATIC_KEYS.includes(key);

    if (!isThematic) {
      onToggleLayer(key);
      return;
    }

    if (activeLayers[key]) {
      onToggleLayer(key);
      return;
    }

    THEMATIC_KEYS.forEach((k) => {
      if (k !== key && activeLayers[k]) onToggleLayer(k);
    });
    onToggleLayer(key);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setGroups((prev) =>
      prev.map((group) => {
        const ids = group.layers.map((l) => l.id);
        if (!ids.includes(active.id as LayerKey)) return group;

        const oldIdx = ids.indexOf(active.id as LayerKey);
        const newIdx = ids.indexOf(over.id as LayerKey);
        if (oldIdx === -1 || newIdx === -1) return group;

        const reordered = arrayMove(group.layers, oldIdx, newIdx);
        onGroupOrderChange?.(
          group.id,
          reordered.map((l) => l.id)
        );
        return { ...group, layers: reordered };
      })
    );
  };

  const activeOverlayCount = groups
    .find((group) => group.id === "overlay")
    ?.layers.filter((layer) => activeLayers[layer.id]).length ?? 0;

  const activeAnalysisCount = groups
    .find((group) => group.id === "analysis")
    ?.layers.filter((layer) => activeLayers[layer.id]).length ?? 0;
  const activeGroup =
    activeDesktopTab === "overlay"
      ? groups.find((group) => group.id === "overlay") ?? null
      : activeDesktopTab === "analysis"
        ? groups.find((group) => group.id === "analysis") ?? null
        : null;

  if (!isOpen) {
    return (
      <div className="absolute left-4 top-4 z-[1060]">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white/95 shadow-md backdrop-blur hover:bg-white"
          aria-label="Buka pengaturan layer"
        >
          <Layers3 className="h-5 w-5 text-[var(--color-primary)]" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        compact
          ? "flex w-full flex-col overflow-visible rounded-none border-0 bg-transparent shadow-none"
          : "absolute left-4 top-4 z-[1060] flex w-72 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white/95 shadow-md backdrop-blur"
      }
      style={
        compact ? undefined : { maxHeight: "max(10rem, calc(100svh - 440px))" }
      }
    >
      {!compact ? (
        <div className="flex-shrink-0 px-3 pt-3">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex gap-2">
              <div className="rounded-lg bg-[var(--color-primary-soft)] p-1.5">
                <Layers3 className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-gray-800">
                  Pengaturan Layer
                </h3>
                <p className="text-[11px] text-gray-500">Tampilkan &amp; atur layer</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50"
              aria-label="Tutup pengaturan layer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <div className={`flex-shrink-0 ${compact ? "px-0 pb-2" : "px-3 pb-3"}`}>
        {compact ? (
          <>
            <p className="sr-only mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
              Basemap
            </p>
            <div className="flex gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              {(["imagery", "dark", "light"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onBasemapChange?.(key)}
                  className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                    basemap === key
                      ? "bg-white text-[var(--color-primary)] shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {BASEMAP_LABELS[key]}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-1">
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setActiveDesktopTab("basemap")}
                className={`rounded-md px-2 py-2 text-[11px] font-medium transition ${
                  activeDesktopTab === "basemap"
                    ? "bg-white text-[var(--color-primary)] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Basemap
              </button>
              <button
                type="button"
                onClick={() => setActiveDesktopTab("overlay")}
                className={`rounded-md px-2 py-2 text-[11px] font-medium transition ${
                  activeDesktopTab === "overlay"
                    ? "bg-white text-[var(--color-primary)] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Overlay
                <span className="ml-1 text-[10px] text-gray-400">
                  {activeOverlayCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDesktopTab("analysis")}
                className={`rounded-md px-2 py-2 text-[11px] font-medium transition ${
                  activeDesktopTab === "analysis"
                    ? "bg-white text-[var(--color-primary)] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Analisis
                <span className="ml-1 text-[10px] text-gray-400">
                  {activeAnalysisCount}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`${compact ? "overflow-visible px-0" : "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3"}`}>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {!compact ? (
              activeDesktopTab === "basemap" ? (
                <div>
                  <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Basemap
                  </div>
                  <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
                    {(["imagery", "dark", "light"] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onBasemapChange?.(key)}
                        className={`flex-1 rounded-md py-2 text-[11px] font-medium transition-colors ${
                          basemap === key
                            ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)] shadow-sm"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        {BASEMAP_LABELS[key]}
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeGroup ? (
                <div>
                  <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    {activeGroup.groupName}
                  </div>
                  <p className="mb-2 px-1 text-[11px] text-gray-500">
                    {activeDesktopTab === "overlay"
                      ? `${activeOverlayCount} layer aktif`
                      : `${activeAnalysisCount} layer aktif`}
                  </p>
                  <SortableContext
                    items={activeGroup.layers.map((l) => l.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-0.5">
                      {activeGroup.layers.map((layer) => {
                        const isHazardDisabled =
                          layer.id === "hazard" && hazard === "multi";
                        return (
                          <LayerItem
                            key={layer.id}
                            id={layer.id}
                            label={layer.label}
                            visible={!!activeLayers[layer.id]}
                            opacity={layerOpacity[layer.id] ?? 0.7}
                            onToggle={() => handleToggle(layer.id)}
                            onOpacityChange={(op) =>
                              onOpacityChange(layer.id, op)
                            }
                            disabled={isHazardDisabled}
                            disabledReason={
                              isHazardDisabled
                                ? "Indeks Bahaya tidak tersedia untuk Multi-hazard karena dihitung dari kombinasi kekeringan dan banjir."
                                : undefined
                            }
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </div>
              ) : null
            ) : (
              groups.map((group, idx) => (
                <div key={group.id} className={idx > 0 ? "mt-3" : ""}>
                  <>
                    <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {group.groupName}
                    </div>

                    <SortableContext
                      items={group.layers.map((l) => l.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-0.5">
                        {group.layers.map((layer) => {
                          const isHazardDisabled =
                            layer.id === "hazard" && hazard === "multi";
                          return (
                            <LayerItem
                              key={layer.id}
                              id={layer.id}
                              label={layer.label}
                              visible={!!activeLayers[layer.id]}
                              opacity={layerOpacity[layer.id] ?? 0.7}
                              onToggle={() => handleToggle(layer.id)}
                              onOpacityChange={(op) =>
                                onOpacityChange(layer.id, op)
                              }
                              disabled={isHazardDisabled}
                              disabledReason={
                                isHazardDisabled
                                  ? "Indeks Bahaya tidak tersedia untuk Multi-hazard karena dihitung dari kombinasi kekeringan dan banjir."
                                  : undefined
                              }
                            />
                          );
                        })}
                      </div>
                    </SortableContext>
                  </>
                </div>
              ))
            )}
          </DndContext>
        </div>
      </div>

      {!compact ? (
        <p className="flex-shrink-0 px-4 pb-2.5 pt-1.5 text-[10px] text-gray-400">
          Seret layer untuk mengubah urutan
        </p>
      ) : null}
    </div>
  );
}
