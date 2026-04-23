"use client";

/**
 * VectorTileLayer — wraps Leaflet.VectorGrid.Protobuf for React-Leaflet v5.
 *
 * Renders server-side MVT tiles (from /api/tiles/<layer>/{z}/{x}/{y}).
 * Replaces the large GeoJSON download with on-demand, zoom-adaptive tiles.
 *
 * The component re-creates the VectorGrid layer only when `url` or
 * `styleFunction` changes (e.g. filter params or classification breaks change).
 * On pan/zoom Leaflet fetches only the newly visible tiles — served from the
 * server's in-memory cache or the browser's HTTP cache after the first view.
 */

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { PathOptions } from "leaflet";

// ─── Types ────────────────────────────────────────────────────────────────────

export type VGStyleFn = (
  properties: Record<string, unknown>,
  zoom: number
) => PathOptions;

/** Exposed via the `layerHandle` prop for imperative selection highlighting. */
export interface VectorTileLayerHandle {
  /** Override style for a single feature by its kab_kota string. */
  setFeatureStyle(id: string, style: PathOptions): void;
  /** Revert a feature to its default (styleFunction) style. */
  resetFeatureStyle(id: string): void;
}

interface Props {
  /** Full URL template, e.g. "http://…/api/tiles/loss/{z}/{x}/{y}?hazard=flood" */
  url: string;
  /** Must match the layer name passed to ST_AsMVT on the server. */
  layerName: string;
  /**
   * Style function or static PathOptions.
   * Changing this ref triggers full layer re-creation so breaks/selection
   * changes take effect. Tiles come from browser cache on re-creation.
   */
  styleFunction: VGStyleFn | PathOptions;
  interactive?: boolean;
  /** Ref filled with setFeatureStyle / resetFeatureStyle after mount. */
  layerHandle?: React.MutableRefObject<VectorTileLayerHandle | null>;
  /** Returns HTML for the sticky tooltip shown on mouseover. */
  createTooltipContent?: (props: Record<string, unknown>) => string;
  /** Returns HTML for the popup shown on click. */
  createPopupContent?: (props: Record<string, unknown>) => string;
  /** Called after user clicks a feature (use for region selection). */
  onFeatureClick?: (props: Record<string, unknown>, latlng: L.LatLng) => void;
  /** Called once after the vector tile layer is successfully added to the map.
   *  Use this to re-apply imperative styles (e.g. selection highlighting) after
   *  layer re-creation caused by filter or active-layer changes. */
  onLayerReady?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VectorTileLayer({
  url,
  layerName,
  styleFunction,
  interactive = true,
  layerHandle,
  createTooltipContent,
  createPopupContent,
  onFeatureClick,
  onLayerReady,
}: Props) {
  const map = useMap();

  // Internal ref to the live VectorGrid layer (typed as any — vectorGrid is dynamic)
  const vgLayerRef = useRef<any>(null);

  // Keep event callbacks in refs so they stay current without causing
  // layer re-creation when parent re-renders
  const tooltipFnRef = useRef(createTooltipContent);
  tooltipFnRef.current = createTooltipContent;
  const popupFnRef = useRef(createPopupContent);
  popupFnRef.current = createPopupContent;
  const clickFnRef = useRef(onFeatureClick);
  clickFnRef.current = onFeatureClick;
  const layerReadyRef = useRef(onLayerReady);
  layerReadyRef.current = onLayerReady;

  // Sync the imperative handle every render (cheap)
  useEffect(() => {
    if (!layerHandle) return;
    layerHandle.current = {
      setFeatureStyle: (id, style) =>
        // @types/leaflet.vectorgrid types id as number; actual impl accepts any
        (vgLayerRef.current as any)?.setFeatureStyle(id, style),
      resetFeatureStyle: (id) =>
        (vgLayerRef.current as any)?.resetFeatureStyle(id),
    };
    return () => {
      if (layerHandle) layerHandle.current = null;
    };
  });

  useEffect(() => {
    let cancelled = false;
    let activeTooltip: L.Tooltip | null = null;

    (async () => {
      if (cancelled) return;

      // leaflet.vectorgrid bundles its own deps but attaches to the global L.
      // Expose the webpack module's L as globalThis.L before importing so the
      // bundle finds it and attaches vectorGrid / canvas.tile to the same object.
      if (!(L as any).vectorGrid) {
        (globalThis as any).L = L;

        // leaflet.vectorgrid@1.3.0 calls L.DomEvent.fakeStop() which was removed
        // in Leaflet 1.8.0. Polyfill it before the plugin loads so event handlers
        // (click, mouseover) don't abort mid-execution with a TypeError.
        if (!(L.DomEvent as any).fakeStop) {
          (L.DomEvent as any).fakeStop = (e: Event) => {
            if (e) L.DomEvent.stopPropagation(e);
          };
        }

        await import("leaflet.vectorgrid");
      }

      if (cancelled) return;

      // Tear down previous layer
      if (vgLayerRef.current) {
        map.removeLayer(vgLayerRef.current);
        vgLayerRef.current = null;
      }

      const layer = (L as any).vectorGrid.protobuf(url, {
        vectorTileLayerStyles: {
          [layerName]: styleFunction as PathOptions,
        },
        interactive,
        // Use kab_kota name as feature ID so setFeatureStyle matches
        // the selectedRegion string stored in component state
        getFeatureId: (f: any) =>
          (f.properties?.kab_kota as string) ?? undefined,
        maxZoom: 18,
        fetchOptions: { cache: "default" } as RequestInit,
        rendererFactory: (L as any).canvas.tile,
      });

      if (interactive) {
        layer.on("mouseover", (e: any) => {
          const props = (e.layer?.properties ?? {}) as Record<string, unknown>;
          activeTooltip?.remove();
          if (tooltipFnRef.current) {
            activeTooltip = L.tooltip({ sticky: true, opacity: 0.95 })
              .setLatLng(e.latlng)
              .setContent(tooltipFnRef.current(props))
              .addTo(map);
          }
        });

        layer.on("mousemove", (e: any) => {
          activeTooltip?.setLatLng(e.latlng);
        });

        layer.on("mouseout", () => {
          activeTooltip?.remove();
          activeTooltip = null;
        });

        layer.on("click", (e: any) => {
          const props = (e.layer?.properties ?? {}) as Record<string, unknown>;
          activeTooltip?.remove();
          activeTooltip = null;

          if (popupFnRef.current) {
            L.popup({ maxWidth: 280, closeButton: true })
              .setLatLng(e.latlng)
              .setContent(popupFnRef.current(props))
              .openOn(map);
          }

          clickFnRef.current?.(props, e.latlng);
        });
      }

      if (!cancelled) {
        layer.addTo(map);
        vgLayerRef.current = layer;

        // Refresh imperative handle after layer creation
        if (layerHandle) {
          layerHandle.current = {
            setFeatureStyle: (id, style) =>
              (vgLayerRef.current as any)?.setFeatureStyle(id, style),
            resetFeatureStyle: (id) =>
              (vgLayerRef.current as any)?.resetFeatureStyle(id),
          };
        }

        // Notify parent that this layer is ready so selection styles can be re-applied
        layerReadyRef.current?.();
      }
    })();

    return () => {
      cancelled = true;
      activeTooltip?.remove();
      if (vgLayerRef.current) {
        map.removeLayer(vgLayerRef.current);
        vgLayerRef.current = null;
      }
      if (layerHandle) layerHandle.current = null;
    };
    // styleFunction in deps: breaks or selection changes → layer re-creates.
    // Tile cache (browser HTTP + server LRU) means re-creation is cheap.
  }, [url, layerName, styleFunction, interactive, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
