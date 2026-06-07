"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounce } from "../../../lib/useDebounce";
import { useLanguage } from "@/contexts/LanguageContext";
import dynamic from "next/dynamic";
import type { StylesConfig } from "react-select";
import { HelpCircle, Loader2, ShieldAlert, X } from "lucide-react";

import { fetchJson } from "../../../lib/fetcher";
import { fetchAllLayers, fetchLatestRunId, type LayerItem } from "../../../services/fetchLayers";
import { buildApiUrl } from "../../../lib/api";
import { getToken, clearToken } from "../../../lib/auth";
import { getErrorMessage } from "../../../lib/error";
import DashboardLoadingBlock from "../../../components/dashboard/DashboardLoadingBlock";
import DashboardTour from "../../../components/dashboard/DashboardTour";
import DashboardEmptyState from "../../../components/dashboard/DashboardEmptyState";
import DashboardMapFilters from "../../../components/dashboard/DashboardMapFilters";
import type { AalSummary, GeoFeature, GeoJsonData } from "../../../types/map";
import type { DistItem } from "../../../components/charts/AdvancedCharts";
import type { LayerKey } from "../../../components/map/core/MapLegendPanel";

const MapView = dynamic(() => import("../../../components/map/MapView"), {
  ssr: false,
});

const ComparisonCharts = dynamic(
  () => import("../../../components/charts/ComparisonCharts"),
  {
    ssr: false,
  }
);

const AdvancedCharts = dynamic(
  () => import("../../../components/charts/AdvancedCharts"),
  {
    ssr: false,
  }
);

const ReportPreviewModal = dynamic(
  () => import("../../../components/report/ReportPreviewModal"),
  { ssr: false }
);

type RegionItem = {
  kab_kota: string;
  prov: string;
};

type OptionType = {
  value: string;
  label: string;
};

type PresetItem = {
  id: string;
  label: string;
  hazard: string;
  climate: string;
  scenario: string;
};

type LayerFeature = GeoFeature;

type DashboardLayers = {
  regions: GeoJsonData | null;
  production: GeoJsonData | null;
  loss: GeoJsonData | null;
  aal: GeoJsonData | null;
  hazard: GeoJsonData | null;
};

const climateOptions: OptionType[] = [
  { value: "nonclimate", label: "Baseline" },
  { value: "climate", label: "Projection" },
];

const quickPresets: PresetItem[] = [
  {
    id: "multi-baseline-rp25",
    label: "Multi Baseline RP25",
    hazard: "multi",
    climate: "nonclimate",
    scenario: "rp25",
  },
  {
    id: "flood-baseline-rp25",
    label: "Banjir Baseline RP25",
    hazard: "flood",
    climate: "nonclimate",
    scenario: "rp25",
  },
  {
    id: "flood-climate-rp100",
    label: "Banjir Projection RP100",
    hazard: "flood",
    climate: "climate",
    scenario: "rp100",
  },
  {
    id: "drought-climate-rp250",
    label: "Kekeringan Projection RP250",
    hazard: "drought",
    climate: "climate",
    scenario: "rp250",
  },
];

function getHazardLabel(hazard: string) {
  if (hazard === "flood") return "Banjir";
  if (hazard === "drought") return "Kekeringan";
  return "Multi-hazard";
}

function getClimateLabel(climate: string) {
  return climate === "climate" ? "Projection" : "Baseline";
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatPercentChange(climateValue: number, nonclimateValue: number) {
  if (!nonclimateValue || nonclimateValue === 0) {
    return {
      label: "N/A",
      isUp: false,
      colorClass: "text-[var(--dashboard-text-muted)]",
      description: "Perubahan AAL belum dapat dihitung.",
      deltaValue: 0,
    };
  }

  const change = ((climateValue - nonclimateValue) / nonclimateValue) * 100;
  const deltaValue = climateValue - nonclimateValue;
  const isUp = change >= 0;

  return {
    label: `${isUp ? "+" : "-"}${Math.abs(change).toFixed(1)}%`,
    isUp,
    colorClass: isUp ? "text-red-600" : "text-green-600",
    description: isUp
      ? "Risiko tahunan rata-rata meningkat pada kondisi iklim."
      : "Risiko tahunan rata-rata menurun dibanding baseline.",
    deltaValue,
  };
}

const selectStyles: StylesConfig<OptionType, false> = {
  control: (base, state) => ({
    ...base,
    minHeight: 38,
    borderRadius: 8,
    borderColor: state.isFocused ? "var(--color-primary)" : "transparent",
    backgroundColor: state.isFocused
      ? "var(--dashboard-input-bg)"
      : "transparent",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(30,99,181,0.10)" : "none",
    paddingLeft: 0,
    paddingRight: 0,
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-primary)" : "var(--dashboard-border-solid)",
      backgroundColor: "var(--dashboard-control-bg)",
    },
  }),
  valueContainer: (base) => ({
    ...base,
    paddingTop: 2,
    paddingBottom: 2,
    paddingLeft: 2,
    paddingRight: 6,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--color-primary)"
      : state.isFocused
        ? "var(--dashboard-select-option-hover)"
        : "var(--dashboard-input-bg)",
    color: state.isSelected ? "#ffffff" : "var(--dashboard-input-text)",
    cursor: "pointer",
    paddingTop: 9,
    paddingBottom: 9,
    fontSize: 13,
  }),
  singleValue: (base) => ({
    ...base,
    color: "var(--dashboard-text-strong)",
    fontWeight: 700,
    fontSize: 13,
    letterSpacing: "0.01em",
  }),
  placeholder: (base) => ({
    ...base,
    color: "var(--dashboard-text-soft)",
    fontSize: 13,
  }),
  input: (base) => ({
    ...base,
    color: "var(--dashboard-input-text)",
    fontSize: 13,
  }),
  menu: (base) => ({
    ...base,
    zIndex: 50,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "var(--dashboard-input-bg)",
    border: "1px solid var(--dashboard-border-solid)",
    boxShadow: "0 16px 34px rgba(15,23,42,0.12)",
  }),
  indicatorSeparator: () => ({
    display: "none",
  }),
};

function DashboardSectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-[var(--dashboard-text)]">
        {title}
      </h2>
      {desc ? <p className="mt-1 text-sm text-[var(--dashboard-text-muted)]">{desc}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const { t } = useLanguage();
  const tourStartRef = useRef<(() => void) | null>(null);

  const hazardOptions = useMemo<OptionType[]>(() => [
    { value: "multi", label: t("charts.multi") },
    { value: "flood", label: t("charts.flood") },
    { value: "drought", label: t("charts.drought") },
  ], [t]);

  const scenarioOptions = useMemo<OptionType[]>(() => [
    { value: "rp25", label: t("dashboard.scenario25Year") },
    { value: "rp50", label: t("dashboard.scenario50Year") },
    { value: "rp100", label: t("dashboard.scenario100Year") },
    { value: "rp250", label: t("dashboard.scenario250Year") },
  ], [t]);

  const filterPanelRef = useRef<HTMLDivElement | null>(null);
  const chartsRef = useRef<HTMLDivElement | null>(null);
  const downloadingRef = useRef(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [runId, setRunId] = useState<number | null>(null);
  const [dataYear, setDataYear] = useState<number | null>(null);
  const [scenario, setScenario] = useState("rp25");
  const [hazard, setHazard] = useState("multi");
  const [climate, setClimate] = useState("nonclimate");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const _selectedRegionRef = useRef("");
  _selectedRegionRef.current = selectedRegion;
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [aalSummary, setAalSummary] = useState<AalSummary | null>(null);
  const [regionAalSummary, setRegionAalSummary] = useState<AalSummary | null>(null);
  const [layers, setLayers] = useState<DashboardLayers>({
    regions: null,
    production: null,
    loss: null,
    aal: null,
    hazard: null,
  });

  const [loadingRegions, setLoadingRegions] = useState(false);
  const [loadingAAL, setLoadingAAL] = useState(false);
  const [loadingRegionAAL, setLoadingRegionAAL] = useState(false);
  const [loadingLayer, setLoadingLayer] = useState(false);

  const [errorRegions, setErrorRegions] = useState<string | null>(null);
  const [errorAAL, setErrorAAL] = useState<string | null>(null);
  const [errorRegionAAL, setErrorRegionAAL] = useState<string | null>(null);
  const [errorLayer, setErrorLayer] = useState<string | null>(null);

  const [resetSignal, setResetSignal] = useState(0);
  const [regionCentroids, setRegionCentroids] = useState<Record<string, [number, number]>>({});

  const [showReportPreview, setShowReportPreview] = useState(false);
  const [isMapTransitioning, setIsMapTransitioning] = useState(false);
  const [isProvinceSwitching, setIsProvinceSwitching] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const prevLoadingRegionAAL = useRef(false);
  const regionsInitialized = useRef(false);
  const [showLoginNotice, setShowLoginNotice] = useState(false);
  const [loginNoticeMessage, setLoginNoticeMessage] = useState(
    "Silakan login terlebih dahulu."
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const lastDownloadRef = useRef<{ path: string; filename: string } | null>(null);

  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    regions: false,
    production: false,
    loss: true,
    aal: false,
    hazard: false,
  });

  // Debounce filter values so rapid sequential changes don't each trigger a full
  // fetchAllLayers (4 parallel requests). UI state updates immediately; fetches wait.
  const dHazard   = useDebounce(hazard,   200);
  const dScenario = useDebounce(scenario, 200);
  const dClimate  = useDebounce(climate,  200);

  // Mount chart section lazily — defer ComparisonCharts + AdvancedCharts fetches
  // until the user scrolls near the section (saves ~4 requests on initial page load).
  useEffect(() => {
    const el = chartsRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setChartsReady(true); obs.disconnect(); } },
      { rootMargin: "600px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!isMapExpanded) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMapExpanded]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const query = window.matchMedia("(max-width: 767px)");
    const closeOnMobile = () => {
      if (query.matches) setIsMapExpanded(false);
    };

    closeOnMobile();
    query.addEventListener("change", closeOnMobile);

    return () => {
      query.removeEventListener("change", closeOnMobile);
    };
  }, []);

  useEffect(() => {
    setRunId(null);
    setErrorLayer(null);
    fetchLatestRunId(hazard)
      .then(({ runId, dataYear }) => {
        setRunId(runId);
        setDataYear(dataYear);
      })
      .catch(() => {
        setErrorLayer(t("dashboard.errServerAnalysis"));
      });
  }, [hazard]);

  // Derive regions/centroids dari production data yang sudah di-fetch oleh fetchAllLayers.
  // Menghilangkan duplikasi request ke /api/layers/values/production.
  useEffect(() => {
    if (regionsInitialized.current || !layers.production?.features?.length) return;
    regionsInitialized.current = true;
    const items = (layers.production.features as { properties: LayerItem }[]).map((f) => f.properties);
    setRegions(items.map((item) => ({
      kab_kota: item.kab_kota || "",
      prov: item.prov || "",
    })));
    const centroids: Record<string, [number, number]> = {};
    for (const item of items) {
      if (item.kab_kota && item.centroid_lat != null && item.centroid_lng != null) {
        centroids[item.kab_kota.toLowerCase().trim()] = [item.centroid_lat, item.centroid_lng];
      }
    }
    setRegionCentroids(centroids);
    setLoadingRegions(false);
    setErrorRegions(null);
  }, [layers.production]);

  // Validasi: jika filter berubah dan selectedRegion tidak ada di data baru, reset
  useEffect(() => {
    if (!selectedRegion || !regions.length) return;
    const stillExists = regions.some(
      (r) => r.kab_kota.toLowerCase().trim() === selectedRegion.toLowerCase().trim()
    );
    if (!stillExists) setSelectedRegion("");
  }, [regions, selectedRegion]);

  useEffect(() => {
    if (runId === null) return;
    let aborted = false;
    setLoadingAAL(true);
    setErrorAAL(null);

    fetchJson<AalSummary>(`/api/aal-summary?hazard=${hazard}&run_id=${runId}`)
      .then((json) => { if (!aborted) setAalSummary(json); })
      .catch((err) => {
        if (aborted) return;
        console.error("AAL summary fetch error:", err);
        setErrorAAL(t("dashboard.errAalSummary"));
        setAalSummary(null);
      })
      .finally(() => { if (!aborted) setLoadingAAL(false); });
    return () => { aborted = true; };
  }, [hazard, runId]);

  useEffect(() => {
    if (!selectedRegion.trim() || runId === null) {
      setRegionAalSummary(null);
      setErrorRegionAAL(null);
      setLoadingRegionAAL(false);
      return;
    }

    let aborted = false;
    setLoadingRegionAAL(true);
    setErrorRegionAAL(null);

    const params = new URLSearchParams({ hazard, region: selectedRegion.trim(), run_id: String(runId) });

    fetchJson<AalSummary>(`/api/aal-summary?${params.toString()}`)
      .then((json) => { if (!aborted) setRegionAalSummary(json); })
      .catch((err) => {
        if (aborted) return;
        console.error("Region AAL summary fetch error:", err);
        setErrorRegionAAL(t("dashboard.errRegionAal"));
        setRegionAalSummary(null);
      })
      .finally(() => { if (!aborted) setLoadingRegionAAL(false); });
    return () => { aborted = true; };
  }, [hazard, selectedRegion, runId]);

  // Clear transition overlay when region is deselected via any path (reset, clear button, etc.)
  useEffect(() => {
    if (!selectedRegion) setIsMapTransitioning(false);
  }, [selectedRegion]);

  // Clear transition overlay when region data fetch completes (loadingRegionAAL: true → false)
  useEffect(() => {
    if (prevLoadingRegionAAL.current && !loadingRegionAAL) {
      setIsMapTransitioning(false);
    }
    prevLoadingRegionAAL.current = loadingRegionAAL;
  }, [loadingRegionAAL]);

  // Endpoint ringan (~30 KB); rendering peta via MVT tiles dari Leaflet.
  // Uses debounced filter values to avoid cascading requests on rapid changes.
  // Only fetches aal/hazard layer data when those layers are actually active.
  const { aal: aalLayerActive, hazard: hazardLayerActive } = activeLayers;
  useEffect(() => {
    if (runId === null) return;
    let aborted = false;
    async function fetchLayerData() {
      try {
        setLoadingLayer(true);
        setErrorLayer(null);
        if (!regionsInitialized.current) setLoadingRegions(true);
        const data = await fetchAllLayers({
          hazard: dHazard,
          scenario: dScenario,
          climate: dClimate,
          runId: runId!,
          activeAal: aalLayerActive,
          activeHazard: hazardLayerActive,
        });
        if (aborted) return;
        setLayers(data);
      } catch (err) {
        if (aborted) return;
        console.error("Fetch layers error:", err);
        setErrorLayer(t("dashboard.errLayerData"));
        if (!regionsInitialized.current) {
          setLoadingRegions(false);
          setErrorRegions(t("dashboard.errRegionList"));
        }
      } finally {
        if (!aborted) setLoadingLayer(false);
      }
    }
    fetchLayerData();
    return () => { aborted = true; };
  }, [dHazard, dScenario, dClimate, runId, aalLayerActive, hazardLayerActive]);

  const groupedRegionOptions = useMemo(() => {
    const byProv = new Map<string, string[]>();
    for (const r of regions) {
      if (!byProv.has(r.prov)) byProv.set(r.prov, []);
      byProv.get(r.prov)!.push(r.kab_kota);
    }
    return Array.from(byProv.entries())
      .sort(([a], [b]) => a.localeCompare(b, "id"))
      .map(([prov, kabs]) => ({
        label: prov,
        options: [...kabs].sort((a, b) => a.localeCompare(b, "id"))
          .map((k) => ({ value: k, label: k, prov })),
      }));
  }, [regions]);

  const provinceRegionKeys = useMemo(() => {
    if (!selectedProvince) return new Set<string>();
    return new Set(
      regions
        .filter((r) => r.prov === selectedProvince)
        .map((r) => r.kab_kota.toLowerCase().trim())
    );
  }, [selectedProvince, regions]);

  const selectedHazardOption =
    hazardOptions.find((opt) => opt.value === hazard) ?? null;

  const selectedClimateOption =
    climateOptions.find((opt) => opt.value === climate) ?? null;

  const selectedScenarioOption =
    scenarioOptions.find((opt) => opt.value === scenario) ?? null;

  const selectedRegionOption = useMemo<OptionType | null>(() => {
    if (selectedProvince) return { value: selectedProvince, label: selectedProvince };
    if (!selectedRegion) return null;
    for (const group of groupedRegionOptions) {
      const found = group.options.find((o) => o.value === selectedRegion);
      if (found) return found;
    }
    return null;
  }, [selectedProvince, selectedRegion, groupedRegionOptions]);


  const activePresetId = useMemo(() => {
    const match = quickPresets.find(
      (preset) =>
        preset.hazard === hazard &&
        preset.climate === climate &&
        preset.scenario === scenario &&
        !selectedRegion &&
        !selectedProvince
    );
    return match?.id ?? null;
  }, [hazard, climate, scenario, selectedRegion, selectedProvince]);

  const isDefaultFilter =
    hazard === "multi" &&
    climate === "nonclimate" &&
    scenario === "rp25" &&
    !selectedRegion &&
    !selectedProvince;

  function handleToggleLayer(key: LayerKey) {
    setActiveLayers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  const handleRegionChange = useCallback((region: string | null) => {
    const nextRegion = region?.trim() ?? "";
    // Skip only if setting the same non-empty kab/kota (avoid unnecessary re-renders).
    // Never skip when clearing (nextRegion = "") — province selection also needs to be reset.
    if (nextRegion && nextRegion.toLowerCase() === _selectedRegionRef.current.toLowerCase().trim()) return;
    setSelectedProvince("");
    setSelectedRegion(nextRegion);
    if (nextRegion) setIsMapTransitioning(true);
  }, []); // stable — reads selectedRegion via ref

  const handleProvinceChange = useCallback((prov: string) => {
    setSelectedRegion("");
    setIsMapTransitioning(false);
    setSelectedProvince(prov);
    if (prov) {
      setIsProvinceSwitching(true);
      setTimeout(() => setIsProvinceSwitching(false), 500);
    }
  }, []);

  function handleResetView() {
    setSelectedRegion("");
    setSelectedProvince("");
    setResetSignal((prev) => prev + 1);
  }

  function handleResetFilters() {
    setHazard("multi");
    setClimate("nonclimate");
    setScenario("rp25");
    setSelectedRegion("");
    setSelectedProvince("");

    setActiveLayers({
      regions: false,
      production: false,
      loss: true,
      aal: false,
      hazard: false,
    });
  }

  function handleApplyPreset(preset: PresetItem) {
    setHazard(preset.hazard);
    setClimate(preset.climate);
    setScenario(preset.scenario);
    setSelectedRegion("");
    setSelectedProvince("");
    setActiveLayers((prev) => ({
      ...prev,
      loss: true,
    }));
  }

  function redirectToLogin() {
    const redirect = window.location.pathname + window.location.search;
    window.location.href = `/login?redirect=${encodeURIComponent(redirect)}`;
  }

  async function openProtectedDownload(path: string, fallbackFilename: string) {
    if (downloadingRef.current) return;
    downloadingRef.current = true;

    lastDownloadRef.current = { path, filename: fallbackFilename };
    const token = getToken();
    setDownloadError(null);

    if (!token) {
      downloadingRef.current = false;
      setLoginNoticeMessage(t("dashboard.loginRequiredMsg"));
      setShowLoginNotice(true);
      return;
    }

    try {
      const url = buildApiUrl(path);

      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.status === 401) {
        clearToken();
        setLoginNoticeMessage(t("dashboard.sessionExpired"));
        setShowLoginNotice(true);
        return;
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Error ${res.status}: ${errorText}`);
      }

      const contentType = res.headers.get("Content-Type");

      if (contentType && contentType.includes("application/json")) {
        const json = await res.json();
        throw new Error(
          json.error || json.message || "Server tidak mengirim file."
        );
      }

      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const disposition = res.headers.get("Content-Disposition");
      let filename = fallbackFilename;

      if (disposition) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      window.URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      setDownloadError(getErrorMessage(err, t("dashboard.errDownload")));
    } finally {
      downloadingRef.current = false;
    }
  }

  function toSlug(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  }

  function handleDownloadCsv() {
    const params = new URLSearchParams({ hazard, scenario, climate });
    if (selectedRegion.trim()) params.set("region", selectedRegion.trim());
    else if (selectedProvince.trim()) params.set("province", selectedProvince.trim());
    if (runId != null) params.set("run_id", String(runId));

    const regionSlug = selectedRegion.trim()
      ? toSlug(selectedRegion)
      : selectedProvince.trim()
        ? toSlug(selectedProvince)
        : "indonesia";

    openProtectedDownload(
      `/api/download-csv?${params.toString()}`,
      `padis_${hazard}_${climate}_${scenario}_${regionSlug}.csv`
    );
  }

  function handleGenerateReport() {
    const params = new URLSearchParams({ hazard, scenario, climate });
    if (selectedRegion.trim()) params.set("region", selectedRegion.trim());
    else if (selectedProvince.trim()) params.set("province", selectedProvince.trim());
    if (runId != null) params.set("run_id", String(runId));

    const regionSlug = selectedRegion.trim()
      ? toSlug(selectedRegion)
      : selectedProvince.trim()
        ? toSlug(selectedProvince)
        : "indonesia";

    openProtectedDownload(
      `/api/generate-report-v2?${params.toString()}`,
      `padis_data_${hazard}_${climate}_${scenario}_${regionSlug}.xlsx`
    );
  }

  function handlePreviewReport() {
    if (!runId) return;
    setShowReportPreview(true);
  }

  function handleFocusFilters() {
    filterPanelRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

  const layerSummary = useMemo(() => {
    if (!layers?.loss?.features) {
      return {
        totalLoss: 0,
        topRegion: "-",
        topLoss: 0,
        dataCount: 0,
      };
    }

    const validFeatures = layers.loss.features.filter(
      (f: LayerFeature) =>
        f.properties?.loss !== null &&
        f.properties?.loss !== undefined &&
        !Number.isNaN(Number(f.properties.loss)) &&
        Number(f.properties.loss) > 0
    );

    const totalLoss = validFeatures.reduce(
      (sum: number, f: LayerFeature) => sum + Number(f.properties.loss ?? 0),
      0
    );

    const topFeature = validFeatures.reduce(
      (max: LayerFeature | null, f: LayerFeature) => {
        if (!max) return f;

        return Number(f.properties.loss ?? 0) >
          Number(max.properties.loss ?? 0)
          ? f
          : max;
      },
      null as LayerFeature | null
    );

    return {
      totalLoss,
      topRegion: topFeature
        ? `${topFeature.properties.kab_kota}, ${topFeature.properties.prov}`
        : "-",
      topLoss: topFeature
        ? Number(topFeature.properties.loss ?? 0)
        : 0,
      dataCount: validFeatures.length,
    };
  }, [layers?.loss]);

  // Normalize loss layer features into DistItem[] for AdvancedCharts — avoids a
  // duplicate /api/layers/values/loss request (already fetched in fetchAllLayers).
  const preloadedLossItems = useMemo(() => {
    if (!layers.loss?.features?.length) return undefined;
    return (layers.loss.features as { properties: { kab_kota?: string; prov?: string; loss?: number | null } }[])
      .map((f) => ({
        kab_kota: f.properties.kab_kota ?? "",
        prov:     f.properties.prov ?? "",
        value:    f.properties.loss != null ? Number(f.properties.loss) : null,
      }));
  }, [layers.loss]);

  const climateChangeInfo = useMemo(() => {
    return formatPercentChange(
      aalSummary?.total_aal_climate ?? 0,
      aalSummary?.total_aal_nonclimate ?? 0
    );
  }, [aalSummary]);

  const selectedRegionClimateChangeInfo = useMemo(() => {
    if (!selectedRegion || !regionAalSummary) {
      return null;
    }

    return formatPercentChange(
      regionAalSummary.total_aal_climate ?? 0,
      regionAalSummary.total_aal_nonclimate ?? 0
    );
  }, [selectedRegion, regionAalSummary]);

  const isLayerEmpty =
    !loadingLayer && !errorLayer && layerSummary.dataCount === 0;

  const insightBadge = useMemo(() => {
    if (loadingLayer || loadingAAL) {
      return {
        label: t("dashboard.loading"),
        className: "bg-[var(--dashboard-status-muted-bg)] text-[var(--dashboard-status-muted-text)] border border-[var(--dashboard-status-muted-border)]",
      };
    }

    if (errorLayer || errorAAL) {
      return {
        label: t("dashboard.checkData"),
        className: "bg-[var(--dashboard-status-danger-bg)] text-[var(--dashboard-status-danger-text)] border border-[var(--dashboard-status-danger-border)]",
      };
    }

    if (isLayerEmpty) {
      return {
        label: t("dashboard.noDataDefault"),
        className: "bg-[var(--dashboard-status-muted-bg)] text-[var(--dashboard-status-muted-text)] border border-[var(--dashboard-status-muted-border)]",
      };
    }

    if (climateChangeInfo.label === "N/A") {
      return {
        label: t("dashboard.aalUnavailable"),
        className: "bg-[var(--dashboard-status-muted-bg)] text-[var(--dashboard-status-muted-text)] border border-[var(--dashboard-status-muted-border)]",
      };
    }

    if (climateChangeInfo.isUp) {
      return {
        label: t("dashboard.riskIncreasing"),
        className: "bg-[var(--dashboard-status-danger-bg)] text-[var(--dashboard-status-danger-text)] border border-[var(--dashboard-status-danger-border)]",
      };
    }

    return {
      label: t("dashboard.riskDecreasing"),
      className: "bg-[var(--dashboard-status-success-bg)] text-[var(--dashboard-status-success-text)] border border-[var(--dashboard-status-success-border)]",
    };
  }, [
    t,
    loadingLayer,
    loadingAAL,
    errorLayer,
    errorAAL,
    isLayerEmpty,
    climateChangeInfo,
  ]);

  const selectPortalStyles: StylesConfig<OptionType, false> = {
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  return (
    <div className="dashboard-theme">
      <section className="relative w-full overflow-hidden pt-10 pb-14">
        <div className="pointer-events-none absolute inset-0">
          {/* Base gradient */}
          <div className="absolute inset-0 bg-[linear-gradient(150deg,var(--dashboard-page-bg-top)_0%,var(--dashboard-page-bg-mid)_52%,var(--dashboard-page-bg-bottom)_100%)]" />
          {/* Focal glow — anchored behind the map card */}
          <div className="absolute left-1/2 top-[3rem] h-[48rem] w-[72%] max-w-[1000px] -translate-x-1/2 rounded-full bg-[var(--dashboard-bg-glow-main)] blur-[100px]" />
          {/* Flood / water accent — upper left */}
          <div className="absolute -left-[6%] -top-[2rem] h-[38rem] w-[44rem] rounded-full bg-[var(--dashboard-bg-glow-flood)] blur-3xl" />
          {/* Drought / risk accent — upper right */}
          <div className="absolute -right-[4%] top-[4rem] h-[30rem] w-[36rem] rounded-full bg-[var(--dashboard-bg-glow-drought)] blur-3xl" />
          {/* Lower secondary glow */}
          <div className="absolute bottom-[-5rem] right-[12%] h-[26rem] w-[34rem] rounded-full bg-[var(--dashboard-bg-glow-main)] blur-3xl opacity-50" />
          {/* Dot grid texture */}
          <div className="absolute inset-0 [background-image:radial-gradient(circle,var(--dashboard-bg-dot)_1px,transparent_1px)] [background-size:22px_22px]" />
          {/* Top vignette — smooth navbar transition */}
          <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[var(--dashboard-page-bg-top)] to-transparent" />
        </div>

        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-6 xl:px-8">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
                  {t("dashboard.spatialAnalysis")}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[var(--dashboard-text-strong)] xl:text-3xl">
                  {t("dashboard.riskMap")}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[var(--dashboard-text-muted)]">
                  {t("dashboard.riskMapDesc")}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {runId !== null && (
                    <>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dashboard-text-soft)] shadow-sm">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        Run #{runId}
                      </span>
                      {dataYear !== null && (
                        <span className="inline-flex items-center rounded-full border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dashboard-text-soft)] shadow-sm">
                          {t("dashboard.modelDataLabel")} {dataYear}
                        </span>
                      )}
                    </>
                  )}
                  {/* Tour trigger — desktop only, hidden on mobile */}
                  <button
                    type="button"
                    onClick={() => tourStartRef.current?.()}
                    aria-label={t("tour.startTour")}
                    className="hidden md:inline-flex items-center gap-1 rounded-full border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] px-2.5 py-1 text-[11px] font-semibold text-[var(--dashboard-text-soft)] shadow-sm transition hover:border-[var(--color-primary)]/40 hover:text-[var(--color-primary)]"
                  >
                    <HelpCircle className="h-3 w-3" />
                    {t("tour.startTour")}
                  </button>
                </div>
              </div>

              <div className="xl:shrink-0 xl:max-w-[42%] xl:pt-1" data-tour="quick-summary">
                {/* Label + status badge */}
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                    {t("dashboard.quickSummaryLabel")}
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${insightBadge.className}`}
                  >
                    {insightBadge.label}
                  </span>
                </div>

                {/* Row 1 — primary metrics with micro-labels */}
                <div className="flex items-start divide-x divide-[var(--dashboard-border-solid)]">
                  <div className="flex-[1.3] pr-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dashboard-text-soft)]">
                      {t("dashboard.totalDirectLossLabel")}
                    </p>
                    <p className="mt-1 whitespace-nowrap text-sm font-semibold text-[var(--dashboard-text)] md:text-base">
                      {loadingLayer ? (
                        <span className="animate-pulse text-[var(--dashboard-text-soft)]">—</span>
                      ) : (
                        `Rp ${formatCompact(layerSummary.totalLoss)}`
                      )}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1 px-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dashboard-text-soft)]">
                      {t("dashboard.aalChangeLabel")}
                    </p>
                    <p
                      className={`mt-1 truncate text-sm font-bold ${
                        loadingAAL ? "text-[var(--dashboard-text-soft)]" : climateChangeInfo.colorClass
                      }`}
                    >
                      {loadingAAL ? (
                        <span className="animate-pulse">—</span>
                      ) : climateChangeInfo.label === "N/A" ? (
                        "N/A"
                      ) : (
                        `${climateChangeInfo.label} ${climateChangeInfo.isUp ? "↑" : "↓"}`
                      )}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1 pl-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--dashboard-text-soft)]">
                      {t("dashboard.priorityLabel")}
                    </p>
                    <p
                      className="mt-1 truncate text-sm font-bold text-[var(--dashboard-text)]"
                      title={layerSummary.topRegion !== "-" ? layerSummary.topRegion : undefined}
                    >
                      {loadingLayer ? (
                        <span className="animate-pulse text-[var(--dashboard-text-soft)]">—</span>
                      ) : layerSummary.topRegion !== "-" ? (
                        layerSummary.topRegion.split(",")[0].trim()
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                </div>

                {/* Row 2 — secondary metrics */}
                <div className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-[var(--dashboard-text-muted)]">
                  <span
                    title="Jumlah kabupaten/kota yang memiliki kerugian > 0 pada filter aktif"
                    className="cursor-default"
                  >
                    <span className="font-semibold text-[var(--dashboard-text)]">
                      {loadingLayer ? "—" : layerSummary.dataCount}
                    </span>{" "}
                    {t("dashboard.affectedRegions")}
                  </span>
                  <span className="select-none text-[var(--dashboard-text-soft)]" aria-hidden="true">·</span>
                  <span
                    className={
                      !selectedRegion
                        ? "text-[var(--dashboard-text-soft)]"
                        : loadingRegionAAL
                          ? "text-[var(--dashboard-text-soft)]"
                          : errorRegionAAL
                            ? "text-red-500"
                            : (selectedRegionClimateChangeInfo?.colorClass ?? "text-[var(--dashboard-text-muted)]")
                    }
                  >
                    {!selectedRegion ? (
                      t("dashboard.selectRegion")
                    ) : loadingRegionAAL ? (
                      <span className="animate-pulse">—</span>
                    ) : errorRegionAAL ? (
                      "Error"
                    ) : selectedRegionClimateChangeInfo ? (
                      `${selectedRegionClimateChangeInfo.label} ${selectedRegionClimateChangeInfo.isUp ? "↑" : "↓"} · ${selectedRegion}`
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div
              className={`relative overflow-hidden bg-[var(--dashboard-surface)] ${
                isMapExpanded
                  ? "md:fixed md:inset-0 md:z-[1300] md:flex md:flex-col md:rounded-none md:border-0 md:shadow-none"
                  : "rounded-[28px] border border-[var(--dashboard-border)] shadow-[var(--dashboard-shadow-lg)]"
              }`}
            >
              <div className="relative z-10 border-b border-[var(--dashboard-border-soft)] bg-[var(--dashboard-surface-solid)] md:flex-shrink-0">
                <div className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--dashboard-text)]">
                      {t("dashboard.mapVisualizationTitle")}
                    </p>
                    <p className="text-xs text-[var(--dashboard-text-muted)]">
                      {t("dashboard.mapVisualizationDesc")}
                    </p>
                  </div>
                </div>

                <div
                  ref={filterPanelRef}
                  data-tour="filter-panel"
                  className="hidden border-t border-[var(--dashboard-border-soft)] px-5 py-2.5 md:block"
                >
                  <DashboardMapFilters
                    hazardOptions={hazardOptions}
                    climateOptions={climateOptions}
                    scenarioOptions={scenarioOptions}
                    regionOptions={groupedRegionOptions}
                    selectedHazardOption={selectedHazardOption}
                    selectedClimateOption={selectedClimateOption}
                    selectedScenarioOption={selectedScenarioOption}
                    selectedRegionOption={selectedRegionOption}
                    loadingLayer={loadingLayer}
                    loadingRegions={loadingRegions}
                    errorRegions={errorRegions}
                    onHazardChange={(value) => setHazard(value)}
                    onClimateChange={(value) => setClimate(value)}
                    onScenarioChange={(value) => setScenario(value)}
                    onRegionChange={(value) => handleRegionChange(value)}
                    onProvinceChange={handleProvinceChange}
                    selectStyles={selectStyles}
                    selectPortalStyles={selectPortalStyles}
                  />
                </div>
              </div>

              <div
                data-tour="map"
                className={`relative w-full ${
                  isMapExpanded
                    ? "h-[50vh] sm:h-[65vh] md:min-h-0 md:flex-1 md:h-auto"
                    : "h-[50vh] sm:h-[65vh] md:h-[70vh] xl:h-[75vh]"
                }`}
              >
                {runId !== null && (
                  <MapView
                    scenario={scenario}
                    hazard={hazard}
                    climate={climate}
                    runId={runId}
                    selectedRegion={selectedRegion}
                    onRegionSelect={handleRegionChange}
                    onResetView={handleResetView}
                    onDownloadCsv={handleDownloadCsv}
                    onGenerateReport={handlePreviewReport}
                    isMapTransitioning={isMapTransitioning || isProvinceSwitching}
                    isMapExpanded={isMapExpanded}
                    onToggleMapExpanded={() => setIsMapExpanded((prev) => !prev)}
                    onFocusFilters={handleFocusFilters}
                    mobileFilterContent={
                      <DashboardMapFilters
                        hazardOptions={hazardOptions}
                        climateOptions={climateOptions}
                        scenarioOptions={scenarioOptions}
                        regionOptions={groupedRegionOptions}
                        selectedHazardOption={selectedHazardOption}
                        selectedClimateOption={selectedClimateOption}
                        selectedScenarioOption={selectedScenarioOption}
                        selectedRegionOption={selectedRegionOption}
                        loadingLayer={loadingLayer}
                        loadingRegions={loadingRegions}
                        errorRegions={errorRegions}
                        onHazardChange={(value) => setHazard(value)}
                        onClimateChange={(value) => setClimate(value)}
                        onScenarioChange={(value) => setScenario(value)}
                        onRegionChange={(value) => handleRegionChange(value)}
                        onProvinceChange={handleProvinceChange}
                        selectStyles={selectStyles}
                        selectPortalStyles={selectPortalStyles}
                        variant="inline"
                      />
                    }

                    layers={layers}

                    resetViewSignal={resetSignal}
                    activeLayers={activeLayers}
                    onToggleLayer={handleToggleLayer}
                    regionCentroids={regionCentroids}
                    selectedProvince={selectedProvince}
                    provinceRegionKeys={provinceRegionKeys}
                  />
                )}

                {loadingLayer && (
                  <div
                    className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 backdrop-blur-md"
                    style={{ backgroundColor: "rgba(13, 33, 55, 0.52)" }}
                  >
                    <Loader2 className="h-9 w-9 animate-spin text-white drop-shadow-lg" />
                    <p className="text-sm font-semibold tracking-wide text-white drop-shadow-lg">
                      {t("dashboard.loadingMap")}
                    </p>
                  </div>
                )}

                {errorLayer && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[var(--dashboard-map-overlay)] backdrop-blur-sm">
                    <div className="rounded-xl border border-[var(--dashboard-status-danger-border)] bg-[var(--dashboard-status-danger-bg)] px-4 py-3 text-sm text-[var(--dashboard-status-danger-text)] shadow">
                      {errorLayer}
                    </div>
                  </div>
                )}

                {!loadingLayer && layers?.loss && layers.loss.features?.length === 0 && !selectedRegion && (
                  <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
                    <div className="rounded-xl bg-[var(--dashboard-map-empty-bg)] px-4 py-2 text-sm text-[var(--dashboard-text-muted)] shadow backdrop-blur">
                      {t("dashboard.noDataFilter")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        ref={chartsRef}
        data-tour="charts"
        className="relative w-full border-t border-[var(--dashboard-border-solid)] bg-[linear-gradient(180deg,var(--dashboard-surface-solid)_0%,var(--dashboard-surface-muted)_100%)] pt-10 pb-14"
      >
        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-6 xl:px-8">
          <div className="space-y-5">
            <DashboardSectionHeader
              eyebrow={t("dashboard.advancedAnalysis")}
              title={t("dashboard.statisticsTitle")}
              desc={t("dashboard.statisticsDesc")}
            />

            {chartsReady && (
              <>
                <ComparisonCharts hazard={hazard} runId={runId ?? undefined} />

                <AdvancedCharts
                  hazard={hazard}
                  scenario={scenario}
                  climate={climate}
                  runId={runId ?? undefined}
                  selectedRegion={selectedRegion}
                  onRegionSelect={handleRegionChange}
                  preloadedLossItems={preloadedLossItems}
                  loadingLayer={loadingLayer}
                />
              </>
            )}
          </div>
        </div>
      </section>

      {showReportPreview && runId !== null && (
        <ReportPreviewModal
          hazard={hazard}
          climate={climate}
          scenario={scenario}
          runId={runId}
          selectedRegion={selectedRegion}
          selectedProvince={selectedProvince}
          onClose={() => setShowReportPreview(false)}
          onDownloadExcel={handleGenerateReport}
          onRequireLogin={() => {
            setLoginNoticeMessage(t("dashboard.loginForReport"));
            setShowLoginNotice(true);
          }}
        />
      )}

      {showLoginNotice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-[var(--dashboard-status-warning-border)] bg-[var(--dashboard-status-warning-bg)] p-2">
                <ShieldAlert className="h-5 w-5 text-[var(--dashboard-status-warning-text)]" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-[var(--dashboard-text)]">
                  {t("dashboard.loginRequired")}
                </h3>
                <p className="mt-2 text-sm leading-6 text-[var(--dashboard-text-muted)]">
                  {loginNoticeMessage}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLoginNotice(false)}
                className="rounded-xl border border-[var(--dashboard-border-solid)] px-4 py-2 text-sm font-medium text-[var(--dashboard-text)] hover:bg-[var(--dashboard-control-hover)]"
              >
                {t("common.close")}
              </button>

              <button
                type="button"
                onClick={redirectToLogin}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                {t("dashboard.loginNow")}
              </button>
            </div>
          </div>
        </div>
      )}

      <DashboardTour onReady={(fn) => { tourStartRef.current = fn; }} />

      {downloadError && (
        <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-[var(--dashboard-toast-danger-border)] bg-[var(--dashboard-toast-danger-bg)] px-4 py-3 shadow-lg backdrop-blur">
          <p className="text-sm text-[var(--dashboard-toast-danger-text)]">{downloadError}</p>
          <div className="flex shrink-0 items-center gap-1">
            {lastDownloadRef.current && (
              <button
                type="button"
                onClick={() => {
                  const last = lastDownloadRef.current;
                  if (!last) return;
                  setDownloadError(null);
                  openProtectedDownload(last.path, last.filename);
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-semibold text-[var(--dashboard-toast-danger-text)] ring-1 ring-[var(--dashboard-toast-danger-border)] hover:bg-[var(--dashboard-status-danger-bg)]"
              >
                {t("common.tryAgain")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDownloadError(null)}
              className="text-[var(--dashboard-status-danger-text)]/75 hover:text-[var(--dashboard-status-danger-text)]"
              aria-label={t("common.close")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
