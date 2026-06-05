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
import { useLanguage } from "@/contexts/LanguageContext";

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

// Label keys resolved via t() inside the component
const BASEMAP_LABEL_KEYS: Record<BasemapKey, string> = {
  imagery: "map.basemapSatellite",
  dark: "map.basemapDark",
  light: "map.basemapLight",
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

// Labels resolved via t() inside the component — keys match id.json
const LAYER_LABEL_KEYS: Record<string, string> = {
  regions:    "map.regionBoundary",
  production: "map.totalRiceProduction",
  hazard:     "map.hazardIndex",
  loss:       "map.directLoss",
  aal:        "map.aal",
};

const GROUP_LABEL_KEYS: Record<string, string> = {
  overlay:  "map.overlay",
  analysis: "map.analysis",
};

const INITIAL_GROUPS: LayerGroup[] = [
  {
    id: "overlay",
    groupName: "Overlay",
    layers: [
      { id: "regions",    label: "Batas Administrasi" },
      { id: "production", label: "Total Produksi Sawah" },
    ],
  },
  {
    id: "analysis",
    groupName: "Analisis",
    layers: [
      { id: "hazard", label: "Indeks Bahaya" },
      { id: "loss",   label: "Kerugian Langsung" },
      { id: "aal",    label: "Average Annual Loss (AAL)" },
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
  const { t } = useLanguage();
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
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-control-bg)] shadow-md backdrop-blur hover:bg-[var(--dashboard-control-hover)]"
          aria-label={t("map.openPanel")}
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
          : "absolute left-4 top-4 z-[1060] flex w-72 flex-col overflow-hidden rounded-xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface)] shadow-md backdrop-blur"
      }
      style={
        compact ? undefined : { maxHeight: "max(10rem, calc(100svh - 440px))" }
      }
    >
      {!compact ? (
        <div className="flex-shrink-0 px-3 pt-3">
          <div className="mb-3 flex items-start justify-between">
            <div className="flex gap-2">
              <div className="rounded-lg border border-[var(--dashboard-border-soft)] bg-[var(--dashboard-active-surface)] p-1.5">
                <Layers3 className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[var(--dashboard-text)]">
                  {t("map.layerSettings")}
                </h3>
                <p className="text-[11px] text-[var(--dashboard-text-muted)]">{t("map.layerSettingsDesc")}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--dashboard-border-solid)] text-[var(--dashboard-text-muted)] hover:bg-[var(--dashboard-control-hover)]"
              aria-label={t("map.closePanel")}
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
              {t("map.basemap")}
            </p>
            <div className="flex gap-1 rounded-lg border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-muted)] p-1">
              {(["imagery", "dark", "light"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => onBasemapChange?.(key)}
                  className={`flex-1 rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                    basemap === key
                      ? "bg-[var(--dashboard-surface-solid)] text-[var(--color-primary)] shadow-sm"
                      : "text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]"
                  }`}
                >
                  {t(BASEMAP_LABEL_KEYS[key])}
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-muted)] p-1">
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setActiveDesktopTab("basemap")}
                className={`rounded-md px-2 py-2 text-[11px] font-medium transition ${
                  activeDesktopTab === "basemap"
                    ? "bg-[var(--dashboard-surface-solid)] text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]"
                }`}
              >
                {t("map.basemap")}
              </button>
              <button
                type="button"
                onClick={() => setActiveDesktopTab("overlay")}
                className={`rounded-md px-2 py-2 text-[11px] font-medium transition ${
                  activeDesktopTab === "overlay"
                    ? "bg-[var(--dashboard-surface-solid)] text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]"
                }`}
              >
                {t("map.overlay")}
                <span className="ml-1 text-[10px] text-[var(--dashboard-text-soft)]">
                  {activeOverlayCount}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveDesktopTab("analysis")}
                className={`rounded-md px-2 py-2 text-[11px] font-medium transition ${
                  activeDesktopTab === "analysis"
                    ? "bg-[var(--dashboard-surface-solid)] text-[var(--color-primary)] shadow-sm"
                    : "text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]"
                }`}
              >
                {t("map.analysis")}
                <span className="ml-1 text-[10px] text-[var(--dashboard-text-soft)]">
                  {activeAnalysisCount}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`${compact ? "overflow-visible px-0" : "min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-3"}`}>
        <div className="rounded-lg border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-muted)] p-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            {!compact ? (
              activeDesktopTab === "basemap" ? (
                <div>
                  <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dashboard-text-soft)]">
                    {t("map.basemap")}
                  </div>
                  <div className="flex gap-1 rounded-lg border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] p-1">
                    {(["imagery", "dark", "light"] as const).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => onBasemapChange?.(key)}
                        className={`flex-1 rounded-md py-2 text-[11px] font-medium transition-colors ${
                          basemap === key
                            ? "bg-[var(--dashboard-active-surface)] text-[var(--color-primary)] shadow-sm"
                            : "text-[var(--dashboard-text-muted)] hover:text-[var(--dashboard-text)]"
                        }`}
                      >
                        {t(BASEMAP_LABEL_KEYS[key])}
                      </button>
                    ))}
                  </div>
                </div>
              ) : activeGroup ? (
                <div>
                  <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dashboard-text-soft)]">
                    {t(GROUP_LABEL_KEYS[activeGroup.id] ?? activeGroup.groupName)}
                  </div>
                  <p className="mb-2 px-1 text-[11px] text-[var(--dashboard-text-muted)]">
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
                            label={t(LAYER_LABEL_KEYS[layer.id] ?? layer.id)}
                            visible={!!activeLayers[layer.id]}
                            opacity={layerOpacity[layer.id] ?? 0.7}
                            onToggle={() => handleToggle(layer.id)}
                            onOpacityChange={(op) =>
                              onOpacityChange(layer.id, op)
                            }
                            disabled={isHazardDisabled}
                            disabledReason={
                              isHazardDisabled
                                ? t("map.hazardDisabled")
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
                    <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--dashboard-text-soft)]">
                      {t(GROUP_LABEL_KEYS[group.id] ?? group.groupName)}
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
                              label={t(LAYER_LABEL_KEYS[layer.id] ?? layer.id)}
                              visible={!!activeLayers[layer.id]}
                              opacity={layerOpacity[layer.id] ?? 0.7}
                              onToggle={() => handleToggle(layer.id)}
                              onOpacityChange={(op) =>
                                onOpacityChange(layer.id, op)
                              }
                              disabled={isHazardDisabled}
                              disabledReason={
                                isHazardDisabled
                                  ? t("map.hazardDisabled")
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
        <p className="flex-shrink-0 px-4 pb-2.5 pt-1.5 text-[10px] text-[var(--dashboard-text-soft)]">
          Seret layer untuk mengubah urutan
        </p>
      ) : null}
    </div>
  );
}
