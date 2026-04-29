"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Select from "react-select";
import { Filter, ShieldAlert, X } from "lucide-react";

import { fetchJson } from "../../../lib/fetcher";
import { fetchAllLayers, fetchLatestRunId } from "../../../services/fetchLayers";
import { buildApiUrl } from "../../../lib/api";
import { getToken, clearToken } from "../../../lib/auth";
import DashboardLoadingBlock from "../../../components/dashboard/DashboardLoadingBlock";
import DashboardEmptyState from "../../../components/dashboard/DashboardEmptyState";
import type { AalSummary } from "../../../types/map";
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

const hazardOptions: OptionType[] = [
  { value: "multi", label: "Multi-hazard" },
  { value: "flood", label: "Flood" },
  { value: "drought", label: "Drought" },
];

const climateOptions: OptionType[] = [
  { value: "nonclimate", label: "Non-Climate" },
  { value: "climate", label: "Climate" },
];

const scenarioOptions: OptionType[] = [
  { value: "rp25", label: "25 Tahun (RP25)" },
  { value: "rp50", label: "50 Tahun (RP50)" },
  { value: "rp100", label: "100 Tahun (RP100)" },
  { value: "rp250", label: "250 Tahun (RP250)" },
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
    label: "Flood Baseline RP25",
    hazard: "flood",
    climate: "nonclimate",
    scenario: "rp25",
  },
  {
    id: "flood-climate-rp100",
    label: "Flood Climate RP100",
    hazard: "flood",
    climate: "climate",
    scenario: "rp100",
  },
  {
    id: "drought-climate-rp250",
    label: "Drought Climate RP250",
    hazard: "drought",
    climate: "climate",
    scenario: "rp250",
  },
];

function getHazardLabel(hazard: string) {
  if (hazard === "flood") return "Flood";
  if (hazard === "drought") return "Drought";
  return "Multi-hazard";
}

function getClimateLabel(climate: string) {
  return climate === "climate" ? "Climate" : "Non-Climate";
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
      colorClass: "text-gray-500",
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
      ? "Risiko tahunan rata-rata meningkat pada kondisi climate."
      : "Risiko tahunan rata-rata menurun dibanding baseline.",
    deltaValue,
  };
}

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    minHeight: 48,
    borderRadius: 16,
    borderColor: state.isFocused ? "var(--color-primary)" : "#d1d5db",
    backgroundColor: "#ffffff",
    boxShadow: state.isFocused ? "0 0 0 3px rgba(30,99,181,0.10)" : "none",
    paddingLeft: 2,
    paddingRight: 2,
    "&:hover": {
      borderColor: state.isFocused ? "var(--color-primary)" : "#9ca3af",
    },
  }),
  valueContainer: (base: any) => ({
    ...base,
    paddingTop: 4,
    paddingBottom: 4,
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected
      ? "var(--color-primary)"
      : state.isFocused
        ? "var(--color-primary-soft)"
        : "#ffffff",
    color: state.isSelected ? "#ffffff" : "#111827",
    cursor: "pointer",
    paddingTop: 10,
    paddingBottom: 10,
  }),
  singleValue: (base: any) => ({
    ...base,
    color: "#111827",
  }),
  placeholder: (base: any) => ({
    ...base,
    color: "#6b7280",
  }),
  menu: (base: any) => ({
    ...base,
    zIndex: 50,
    borderRadius: 16,
    overflow: "hidden",
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
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
        {title}
      </h2>
      {desc ? <p className="mt-1 text-sm text-gray-500">{desc}</p> : null}
    </div>
  );
}

export default function DashboardPage() {
  const [runId, setRunId] = useState<number | null>(null);
  const [scenario, setScenario] = useState("rp25");
  const [hazard, setHazard] = useState("multi");
  const [climate, setClimate] = useState("nonclimate");
  const [selectedRegion, setSelectedRegion] = useState("");
  const [regions, setRegions] = useState<RegionItem[]>([]);
  const [aalSummary, setAalSummary] = useState<AalSummary | null>(null);
  const [regionAalSummary, setRegionAalSummary] = useState<AalSummary | null>(null);
  const [layers, setLayers] = useState<any>({
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
  const prevLoadingRegionAAL = useRef(false);
  const [showLoginNotice, setShowLoginNotice] = useState(false);
  const [loginNoticeMessage, setLoginNoticeMessage] = useState(
    "Silakan login terlebih dahulu."
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const [activeLayers, setActiveLayers] = useState<Record<LayerKey, boolean>>({
    regions: false,
    production: false,
    loss: true,
    aal: false,
    hazard: false,
  });

  useEffect(() => {
    setRunId(null);
    fetchLatestRunId(hazard)
      .then(setRunId)
      .catch((err) => {
        console.error("Failed to fetch latest run_id:", err);
      });
  }, [hazard]);

  useEffect(() => {
    setLoadingRegions(true);
    setErrorRegions(null);

    // Endpoint ini mencakup semua kabupaten terlepas dari filter hazard/skenario.
    fetchJson(`/api/layers/values/production`)
      .then((json: any) => {
        const items = (json.data || []) as {
          kab_kota: string;
          prov: string;
          centroid_lng?: number | null;
          centroid_lat?: number | null;
        }[];
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
      })
      .catch((err) => {
        console.error("Regions fetch error:", err);
        setErrorRegions("Gagal memuat daftar wilayah.");
        setRegions([]);
        setSelectedRegion("");
      })
      .finally(() => setLoadingRegions(false));
  }, []);

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
    setLoadingAAL(true);
    setErrorAAL(null);

    fetchJson<AalSummary>(`/api/aal-summary?hazard=${hazard}&run_id=${runId}`)
      .then((json) => setAalSummary(json))
      .catch((err) => {
        console.error("AAL summary fetch error:", err);
        setErrorAAL("Gagal memuat ringkasan AAL.");
        setAalSummary(null);
      })
      .finally(() => setLoadingAAL(false));
  }, [hazard, runId]);

  useEffect(() => {
    if (!selectedRegion.trim() || runId === null) {
      setRegionAalSummary(null);
      setErrorRegionAAL(null);
      setLoadingRegionAAL(false);
      return;
    }

    setLoadingRegionAAL(true);
    setErrorRegionAAL(null);

    const params = new URLSearchParams({ hazard, region: selectedRegion.trim(), run_id: String(runId) });

    fetchJson<AalSummary>(`/api/aal-summary?${params.toString()}`)
      .then((json) => setRegionAalSummary(json))
      .catch((err) => {
        console.error("Region AAL summary fetch error:", err);
        setErrorRegionAAL("Gagal memuat AAL wilayah terpilih.");
        setRegionAalSummary(null);
      })
      .finally(() => setLoadingRegionAAL(false));
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
  useEffect(() => {
    if (runId === null) return;
    async function fetchLayerData() {
      try {
        setLoadingLayer(true);
        setErrorLayer(null);
        const data = await fetchAllLayers({ hazard, scenario, climate, runId: runId! });
        setLayers(data);
      } catch (err) {
        console.error("Fetch layers error:", err);
        setErrorLayer("Gagal memuat layer peta.");
      } finally {
        setLoadingLayer(false);
      }
    }
    fetchLayerData();
  }, [hazard, scenario, climate, runId]);

  const regionOptions = useMemo<OptionType[]>(() => {
    return regions.map((region) => ({
      value: region.kab_kota,
      label: `${region.kab_kota} - ${region.prov}`,
    }));
  }, [regions]);

  const selectedHazardOption =
    hazardOptions.find((opt) => opt.value === hazard) ?? null;

  const selectedClimateOption =
    climateOptions.find((opt) => opt.value === climate) ?? null;

  const selectedScenarioOption =
    scenarioOptions.find((opt) => opt.value === scenario) ?? null;

  const selectedRegionOption =
    regionOptions.find((opt) => opt.value === selectedRegion) ?? null;


  const activePresetId = useMemo(() => {
    const match = quickPresets.find(
      (preset) =>
        preset.hazard === hazard &&
        preset.climate === climate &&
        preset.scenario === scenario &&
        !selectedRegion
    );
    return match?.id ?? null;
  }, [hazard, climate, scenario, selectedRegion]);

  const isDefaultFilter =
    hazard === "multi" &&
    climate === "nonclimate" &&
    scenario === "rp25" &&
    !selectedRegion;

  function handleToggleLayer(key: LayerKey) {
    setActiveLayers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  }

  function handleRegionChange(region: string | null) {
    const nextRegion = region?.trim() ?? "";
    if (nextRegion.toLowerCase() === selectedRegion.toLowerCase().trim()) return;
    setSelectedRegion(nextRegion);
    if (nextRegion) setIsMapTransitioning(true);
  }

  function handleResetView() {
    setSelectedRegion("");
    setResetSignal((prev) => prev + 1);
  }

  function handleResetFilters() {
    setHazard("multi");
    setClimate("nonclimate");
    setScenario("rp25");
    setSelectedRegion("");

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
    const token = getToken();
    setDownloadError(null);

    if (!token) {
      setLoginNoticeMessage(
        "Silakan login dulu untuk mengunduh CSV atau generate report."
      );
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
        setLoginNoticeMessage(
          "Sesi login Anda sudah berakhir. Silakan login kembali."
        );
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
    } catch (err: any) {
      console.error(err);
      setDownloadError(err.message || "Gagal download file.");
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

    const regionSlug = selectedRegion.trim() ? toSlug(selectedRegion) : "indonesia";

    openProtectedDownload(
      `/api/download-csv?${params.toString()}`,
      `padis_${hazard}_${climate}_${scenario}_${regionSlug}.csv`
    );
  }

  function handleGenerateReport() {
    const params = new URLSearchParams({ hazard, scenario, climate });
    if (selectedRegion.trim()) params.set("region", selectedRegion.trim());

    const regionSlug = selectedRegion.trim() ? toSlug(selectedRegion) : "indonesia";

    openProtectedDownload(
      `/api/generate-report-v2?${params.toString()}`,
      `padis_data_${hazard}_${climate}_${scenario}_${regionSlug}.xlsx`
    );
  }

  function handlePreviewReport() {
    if (!runId) return;
    setShowReportPreview(true);
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
      (f: any) =>
        f.properties?.loss !== null &&
        f.properties?.loss !== undefined &&
        !Number.isNaN(Number(f.properties.loss))
    );

    const totalLoss = validFeatures.reduce(
      (sum: number, f: any) => sum + Number(f.properties.loss ?? 0),
      0
    );

    const topFeature = validFeatures.reduce(
      (max: any | null, f: any) => {
        if (!max) return f;

        return Number(f.properties.loss ?? 0) >
          Number(max.properties.loss ?? 0)
          ? f
          : max;
      },
      null as any
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
        label: "Memuat...",
        className: "bg-gray-100 text-gray-600 border border-gray-200",
      };
    }

    if (errorLayer || errorAAL) {
      return {
        label: "Periksa Data",
        className: "bg-red-50 text-red-700 border border-red-200",
      };
    }

    if (isLayerEmpty) {
      return {
        label: "Tidak Ada Data",
        className: "bg-gray-100 text-gray-600 border border-gray-200",
      };
    }

    if (climateChangeInfo.label === "N/A") {
      return {
        label: "AAL Tidak Tersedia",
        className: "bg-gray-100 text-gray-600 border border-gray-200",
      };
    }

    if (climateChangeInfo.isUp) {
      return {
        label: "Risiko Meningkat",
        className: "bg-red-50 text-red-700 border border-red-200",
      };
    }

    return {
      label: "Risiko Menurun",
      className: "bg-green-50 text-green-700 border border-green-200",
    };
  }, [
    loadingLayer,
    loadingAAL,
    errorLayer,
    errorAAL,
    isLayerEmpty,
    climateChangeInfo,
  ]);

  const selectPortalStyles = {
    menuPortal: (base: any) => ({
      ...base,
      zIndex: 9999,
    }),
    menu: (base: any) => ({
      ...base,
      zIndex: 9999,
    }),
  };

  return (
    <>
      <section className="relative w-full overflow-hidden pt-10 pb-14">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-white via-blue-50 to-blue-100" />
          <div className="absolute -top-24 -left-16 h-[28rem] w-[28rem] rounded-full bg-blue-300/30 blur-3xl" />
          <div className="absolute -top-20 right-[-4rem] h-[26rem] w-[26rem] rounded-full bg-emerald-300/25 blur-3xl" />
          <div className="absolute bottom-[-5rem] left-1/3 h-[22rem] w-[22rem] rounded-full bg-sky-300/20 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.6)_1px,transparent_1px)] [background-size:32px_32px]" />
        </div>

        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-6 xl:px-8">
          <div className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-2xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-primary)]">
                  Analisis Spasial
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-gray-950 xl:text-3xl">
                  Peta Risiko
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-500">
                  Eksplorasi distribusi kerugian dan AAL per wilayah berdasarkan
                  parameter analisis aktif.
                </p>
              </div>

              <div className="xl:shrink-0 xl:max-w-[42%] xl:pt-1">
                {/* Label + status badge */}
                <div className="mb-2.5 flex items-center gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                    Ringkasan Cepat
                  </span>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${insightBadge.className}`}
                  >
                    {insightBadge.label}
                  </span>
                </div>

                {/* Row 1 — primary metrics with micro-labels */}
                <div className="flex items-start divide-x divide-gray-200">
                  <div className="flex-[1.3] pr-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Total Loss
                    </p>
                    <p className="mt-1 whitespace-nowrap text-base font-semibold text-gray-900">
                      {loadingLayer ? (
                        <span className="animate-pulse text-gray-300">—</span>
                      ) : (
                        `Rp ${formatCompact(layerSummary.totalLoss)}`
                      )}
                    </p>
                  </div>

                  <div className="min-w-0 flex-1 px-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Perubahan AAL
                    </p>
                    <p
                      className={`mt-1 truncate text-sm font-bold ${
                        loadingAAL ? "text-gray-300" : climateChangeInfo.colorClass
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
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400">
                      Prioritas
                    </p>
                    <p
                      className="mt-1 truncate text-sm font-bold text-gray-900"
                      title={layerSummary.topRegion !== "-" ? layerSummary.topRegion : undefined}
                    >
                      {loadingLayer ? (
                        <span className="animate-pulse text-gray-300">—</span>
                      ) : layerSummary.topRegion !== "-" ? (
                        layerSummary.topRegion.split(",")[0].trim()
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                </div>

                {/* Row 2 — secondary metrics */}
                <div className="mt-2.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-gray-500">
                  <span>
                    <span className="font-semibold text-gray-700">
                      {loadingLayer ? "—" : layerSummary.dataCount}
                    </span>{" "}
                    wilayah
                  </span>
                  <span className="select-none text-gray-300" aria-hidden="true">·</span>
                  <span
                    className={
                      !selectedRegion
                        ? "text-gray-400"
                        : loadingRegionAAL
                          ? "text-gray-400"
                          : errorRegionAAL
                            ? "text-red-500"
                            : (selectedRegionClimateChangeInfo?.colorClass ?? "text-gray-500")
                    }
                  >
                    {!selectedRegion ? (
                      "Pilih wilayah di peta atau dropdown"
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

            <div className="relative z-30 rounded-2xl border border-white/70 bg-white/75 p-4 shadow-[0_14px_36px_rgba(37,99,235,0.08)] backdrop-blur">
              <div className="mb-3 flex items-center gap-2">
                <div className="rounded-xl bg-[var(--color-primary-soft)] p-2">
                  <Filter className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight text-gray-900">
                    Filter Analisis
                  </p>
                  <p className="text-xs text-gray-500">
                    Atur parameter untuk memperbarui distribusi risiko pada peta.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-800">
                    Jenis Bencana
                  </label>
                  <Select
                    instanceId="hazard-select"
                    options={hazardOptions}
                    value={selectedHazardOption}
                    onChange={(option) => setHazard(option?.value ?? "multi")}
                    isSearchable={false}
                    isDisabled={loadingLayer}
                    styles={{ ...selectStyles, ...selectPortalStyles }}
                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-800">
                    Skenario Analisis
                  </label>
                  <Select
                    instanceId="climate-select"
                    options={climateOptions}
                    value={selectedClimateOption}
                    onChange={(option) => setClimate(option?.value ?? "nonclimate")}
                    isSearchable={false}
                    isDisabled={loadingLayer}
                    styles={{ ...selectStyles, ...selectPortalStyles }}
                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-800">
                    Periode Ulang
                  </label>
                  <Select
                    instanceId="scenario-select"
                    options={scenarioOptions}
                    value={selectedScenarioOption}
                    onChange={(option) => setScenario(option?.value ?? "rp25")}
                    isSearchable={false}
                    isDisabled={loadingLayer}
                    styles={{ ...selectStyles, ...selectPortalStyles }}
                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-gray-800">
                    Kabupaten/Kota
                  </label>
                  <Select
                    instanceId="region-select"
                    options={regionOptions}
                    value={selectedRegionOption}
                    onChange={(option) => handleRegionChange(option?.value ?? "")}
                    isClearable
                    isLoading={loadingRegions}
                    placeholder={
                      loadingRegions
                        ? "Memuat wilayah..."
                        : "Pilih Kabupaten/Kota ..."
                    }
                    noOptionsMessage={() =>
                      errorRegions
                        ? errorRegions
                        : loadingRegions
                          ? "Memuat..."
                          : "Tidak ada data wilayah"
                    }
                    styles={{ ...selectStyles, ...selectPortalStyles }}
                    menuPortalTarget={typeof window !== "undefined" ? document.body : null}
                    menuPosition="fixed"
                  />
                </div>
              </div>
            </div>

            <div className="relative overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_20px_56px_rgba(37,99,235,0.10)]">
              <div className="relative z-10 flex flex-col gap-2 border-b border-gray-100 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Visualisasi Wilayah
                  </p>
                  <p className="text-xs text-gray-500">
                    Klik area peta untuk melihat detail dan indikator wilayah.
                  </p>
                </div>
              </div>

              <div className="relative h-[50vh] w-full sm:h-[65vh] md:h-[70vh] xl:h-[75vh]">
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
                    isMapTransitioning={isMapTransitioning}

                    layers={layers}

                    resetViewSignal={resetSignal}
                    activeLayers={activeLayers}
                    onToggleLayer={handleToggleLayer}
                    regionCentroids={regionCentroids}
                  />
                )}

                {loadingLayer && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/20 backdrop-blur-sm">
                    <div className="rounded-xl bg-white px-4 py-3 text-sm text-gray-600 shadow">
                      Memuat peta...
                    </div>
                  </div>
                )}

                {errorLayer && (
                  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-white/30 backdrop-blur-sm">
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow">
                      {errorLayer}
                    </div>
                  </div>
                )}

                {!loadingLayer && layers?.loss && layers.loss.features?.length === 0 && !selectedRegion && (
                  <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
                    <div className="rounded-xl bg-white/90 px-4 py-2 text-sm text-gray-600 shadow backdrop-blur">
                      Belum ada data untuk kombinasi filter ini — coba ubah jenis bencana atau periode ulang
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative w-full pt-8 pb-14">
        <div className="relative mx-auto w-full max-w-[1400px] px-5 sm:px-6 xl:px-8">
          <div className="rounded-[28px] border border-white/70 bg-white/80 p-5 shadow-[0_20px_56px_rgba(37,99,235,0.08)] backdrop-blur sm:p-6">
            <div className="space-y-4">
              <DashboardSectionHeader
                eyebrow="ANALISIS LANJUTAN"
                title="Ringkasan Statistik dan Grafik"
                desc="Perbandingan AAL antar jenis bencana, total kerugian skenario iklim vs non-iklim, wilayah terdampak utama, dan breakdown hazard."
              />

              <ComparisonCharts hazard={hazard} runId={runId ?? undefined} />

              <AdvancedCharts
                hazard={hazard}
                scenario={scenario}
                climate={climate}
                runId={runId ?? undefined}
                selectedRegion={selectedRegion}
                onRegionSelect={handleRegionChange}
              />
            </div>
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
          onClose={() => setShowReportPreview(false)}
          onDownloadExcel={handleGenerateReport}
          onRequireLogin={() => {
            setLoginNoticeMessage("Silakan login terlebih dahulu untuk mengunduh laporan PDF.");
            setShowLoginNotice(true);
          }}
        />
      )}

      {showLoginNotice && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-amber-100 p-2">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  Login diperlukan
                </h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                  {loginNoticeMessage}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLoginNotice(false)}
                className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Tutup
              </button>

              <button
                type="button"
                onClick={redirectToLogin}
                className="rounded-xl bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Login sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {downloadError && (
        <div className="fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 shadow-lg">
          <p className="text-sm text-red-700">{downloadError}</p>
          <button
            type="button"
            onClick={() => setDownloadError(null)}
            className="flex-shrink-0 text-red-400 hover:text-red-600"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  );
}