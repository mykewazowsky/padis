"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { BarChart3, MapPinned, Target } from "lucide-react";
import { fetchJson } from "../../lib/fetcher";
import DashboardLoadingBlock from "../dashboard/DashboardLoadingBlock";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";
import { useChartTheme } from "./chartTheme";
import { useLanguage } from "@/contexts/LanguageContext";

type Props = {
  scenario: string;
  hazard: string;
  climate: string;
  runId?: number;
  selectedRegion?: string;
  onRegionSelect?: (region: string) => void;
  /** Pre-fetched loss data from the page-level fetchAllLayers call — avoids a duplicate request. */
  preloadedLossItems?: DistItem[];
  /** True while the page-level layer fetch is in-flight — used as loading state when preloaded loss data is active. */
  loadingLayer?: boolean;
};

type TopRegionItem = {
  name: string;
  value: number;
};

type TopMetric = "loss" | "aal";

export type DistItem = {
  kab_kota: string;
  prov: string;
  value: number | null;
};

type HistogramBucket = {
  label: string;       // full range string — for tooltip
  shortLabel: string;  // lower-bound only  — for XAxis tick
  count: number;
  lo: number;
  hi: number;
  isPeak: boolean;
  relCount: number;    // count / peakCount, 0–1 for opacity gradient
};

type HistogramStats = {
  mean: number;
  median: number;
  min: number;
  max: number;
};

type DistMetric = "loss" | "aal" | "hazard";

type TooltipPayloadItem = {
  color?: string;
  name?: string;
  value?: unknown;
  payload?: {
    name?: string;
  };
};

type HistogramTooltipPayloadItem = {
  payload?: HistogramBucket;
};

type TFunction = (key: string) => string;

type MetricConfig = {
  title: string;
  subtitle: string;
  endpoint: DistMetric;
  valueKey: string;
  filterZero: boolean;
  useLogScale: boolean;
  formatStat: (v: number) => string;
  formatRange: (lo: number, hi: number) => string;
  formatTick: (lo: number) => string;
  insightTitle: string;
  insightBody: string;
  emptyMsg: string;
  loadingTitle: string;
  loadingDesc: string;
};

function formatCompact(value: number) {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatRupiah(value: number) {
  return `Rp ${Number(value || 0).toLocaleString("id-ID")}`;
}

function safeNumber(value: unknown) {
  return typeof value === "number" ? value : Number(value) || 0;
}

function formatScenarioLabel(scenario: string) {
  return scenario.replace(/^rp/i, "RP ");
}

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded bg-[var(--dashboard-surface-muted)] px-1.5 py-px text-[10px] font-semibold tracking-wide text-[var(--dashboard-text-muted)]">
      {children}
    </span>
  );
}

function shortenRegionName(name: string) {
  if (!name) return "-";
  const cleaned = name
    .replace(/^kabupaten\s+/i, "Kab. ")
    .replace(/^kota\s+/i, "Kota ")
    .trim();
  return cleaned.length > 18 ? `${cleaned.slice(0, 18)}…` : cleaned;
}

function formatIdNum(v: number, decimals = 2) {
  return v.toLocaleString("id-ID", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function getMetricConfig(metric: DistMetric, hazard: string, t: TFunction): MetricConfig {
  if (metric === "loss") {
    return {
      title: t("charts.distributionLossTitle"),
      subtitle: t("charts.lossDistSubtitle"),
      endpoint: "loss",
      valueKey: "loss",
      filterZero: true,
      useLogScale: true,
      formatStat: (v) => `Rp ${formatCompact(v)}`,
      formatRange: (lo, hi) => `Rp ${formatCompact(lo)} – Rp ${formatCompact(hi)}`,
      formatTick: (lo) => formatCompact(lo),
      insightTitle: t("charts.insightLoss"),
      insightBody: t("charts.lossInsightBody"),
      emptyMsg: t("charts.lossEmptyMsg"),
      loadingTitle: t("charts.lossLoadingTitle"),
      loadingDesc: t("charts.lossLoadingDesc"),
    };
  }

  if (metric === "aal") {
    return {
      title: t("charts.distributionAalTitle"),
      subtitle: t("charts.aalDistSubtitle"),
      endpoint: "aal",
      valueKey: "aal",
      filterZero: true,
      useLogScale: true,
      formatStat: (v) => `Rp ${formatCompact(v)}${t("charts.perYear")}`,
      formatRange: (lo, hi) =>
        `Rp ${formatCompact(lo)} – Rp ${formatCompact(hi)}${t("charts.perYear")}`,
      formatTick: (lo) => formatCompact(lo),
      insightTitle: t("charts.insightAal"),
      insightBody: t("charts.aalInsightBody"),
      emptyMsg: t("charts.aalEmptyMsg"),
      loadingTitle: t("charts.aalLoadingTitle"),
      loadingDesc: t("charts.aalLoadingDesc"),
    };
  }

  // hazard / indeks
  const hazardLabel =
    hazard === "flood"
      ? t("charts.flood")
      : hazard === "drought"
        ? t("charts.drought")
        : t("charts.multi");
  const isFlood = hazard === "flood";
  const unit = isFlood ? " m" : "";
  const fmtVal = (v: number) => `${formatIdNum(v)}${unit}`;
  const fmtTick = isFlood
    ? (lo: number) => `${formatIdNum(lo, 1)} m`
    : (lo: number) => formatIdNum(lo, 2);

  return {
    title: `${t("charts.hazardDistTitlePrefix")} ${t("charts.hazardIndex")} ${hazardLabel}`,
    subtitle: t("charts.hazardDistSubtitle"),
    endpoint: "hazard",
    valueKey: "mean_value",
    filterZero: false,
    useLogScale: false,
    formatStat: fmtVal,
    formatRange: (lo, hi) =>
      `${formatIdNum(lo, 2)} – ${formatIdNum(hi, 2)}${unit}`,
    formatTick: fmtTick,
    insightTitle: `${t("charts.hazardInsightTitlePrefix")} ${hazardLabel.toLowerCase()}`,
    insightBody: t("charts.hazardInsightBody"),
    emptyMsg: t("charts.hazardEmptyMsg"),
    loadingTitle: `${t("charts.hazardLoadingTitlePrefix")} ${hazardLabel.toLowerCase()}...`,
    loadingDesc: t("charts.hazardLoadingDesc"),
  };
}

function buildDistributionUrl({
  metric,
  hazard,
  scenario,
  climate,
  runId,
}: {
  metric: DistMetric;
  hazard: string;
  scenario: string;
  climate: string;
  runId: number;
}) {
  const params = new URLSearchParams({ hazard, run_id: String(runId) });

  if (metric === "loss") {
    // loss: ?hazard=&scenario=<rp>&climate=<climate>&run_id=
    params.set("scenario", scenario);
    params.set("climate", climate);
  } else if (metric === "aal") {
    // aal: ?hazard=&climate=<climate>&run_id= (no scenario/rp needed)
    params.set("climate", climate);
  } else {
    // hazard: ?hazard=&scenario=<climate_value>&rp=<rp>&run_id=
    // NOTE: backend uses "scenario" for the climate field and "rp" for return period
    params.set("scenario", climate);
    params.set("rp", scenario);
  }

  return `/api/layers/values/${metric}?${params.toString()}`;
}

function CustomTooltip({
  active,
  payload,
  label,
  labelPrefix,
  formatValue = (v: number) => formatRupiah(v),
}: {
  active?: boolean;
  payload?: readonly TooltipPayloadItem[];
  label?: string;
  labelPrefix: string;
  formatValue?: (v: number) => string;
}) {
  if (!active || !payload || !payload.length) return null;
  const fullName = (payload[0]?.payload?.name as string | undefined) ?? label;
  return (
    <div className="rounded-lg border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-3.5 py-3 shadow-[var(--chart-tooltip-shadow)]">
      <p className="text-xs font-semibold tracking-wide text-[var(--chart-tooltip-muted)]">
        {labelPrefix}: {fullName}
      </p>
      <div className="mt-2 space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[var(--chart-tooltip-muted)]">
              {entry.name}:{" "}
              <span className="font-semibold text-[var(--chart-tooltip-text)]">
                {formatValue(safeNumber(entry.value))}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HistogramTooltip({
  active,
  payload,
  formatRange,
  regionCountLabel,
}: {
  active?: boolean;
  payload?: readonly HistogramTooltipPayloadItem[];
  formatRange: (lo: number, hi: number) => string;
  regionCountLabel: string;
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload as HistogramBucket | undefined;
  if (!bucket) return null;
  return (
    <div className="rounded-lg border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-3.5 py-3 shadow-[var(--chart-tooltip-shadow)]">
      <p className="text-xs font-semibold tracking-wide text-[var(--chart-tooltip-muted)]">
        {formatRange(bucket.lo, bucket.hi)}
      </p>
      <p className="mt-1.5 text-sm font-bold text-[var(--chart-tooltip-text)]">
        {bucket.count} {regionCountLabel}
      </p>
    </div>
  );
}

function adaptiveBucketCount(n: number): number {
  if (n <= 6)  return 3;
  if (n <= 15) return 5;
  if (n <= 40) return 7;
  return 10;
}

const CHART_CARD_CLASS =
  "rounded-lg border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] p-4 md:p-5";
const METRIC_RAIL_CLASS =
  "flex flex-wrap items-baseline gap-x-5 gap-y-2 border-y border-[var(--dashboard-border-soft)] py-2.5";
const METRIC_CELL_CLASS =
  "flex min-w-0 items-baseline gap-2";
const INSIGHT_ROW_CLASS =
  "border-l border-[var(--dashboard-border-solid)] py-1 pl-3";
const CHART_CANVAS_CLASS =
  "h-80 w-full rounded-md bg-[var(--dashboard-surface)] p-1";
const ERROR_CANVAS_CLASS =
  "flex h-full w-full items-center justify-center rounded-lg border border-[var(--dashboard-status-danger-border)] bg-[var(--dashboard-status-danger-bg)] px-4 text-center text-sm text-[var(--dashboard-status-danger-text)]";
const PRIMARY_ICON_CLASS =
  "text-[var(--color-primary)]";
const WARNING_ICON_CLASS =
  "text-[var(--color-secondary-dark)]";

export default function AdvancedCharts({
  scenario,
  hazard,
  climate,
  runId,
  selectedRegion,
  onRegionSelect,
  preloadedLossItems,
  loadingLayer,
}: Props) {
  const { t } = useLanguage();
  const [topRegions, setTopRegions] = useState<TopRegionItem[]>([]);
  const [distData, setDistData] = useState<DistItem[]>([]);
  const [distMetric, setDistMetric] = useState<DistMetric>("loss");
  const [topMetric, setTopMetric] = useState<TopMetric>("loss");

  const [loadingTopRegions, setLoadingTopRegions] = useState(false);
  const [loadingDist, setLoadingDist] = useState(false);

  const [errorTopRegions, setErrorTopRegions] = useState<string | null>(null);
  const [errorDist, setErrorDist] = useState<string | null>(null);

  const chartTheme = useChartTheme();

  function getHazardLabel(h: string) {
    if (h === "flood") return t("charts.flood");
    if (h === "drought") return t("charts.drought");
    return t("charts.multi");
  }

  function getClimateLabel(c: string) {
    return c === "climate" ? t("charts.projection") : t("charts.baseline");
  }

  function getTopMetricLabel(m: TopMetric) {
    return m === "loss" ? t("charts.directLoss") : "AAL";
  }

  function getMetricLabel(m: DistMetric) {
    if (m === "loss") return t("charts.directLoss");
    if (m === "aal") return "AAL";
    return t("charts.hazardIndex");
  }

  const STAT_ITEMS: { key: keyof HistogramStats; label: string }[] = [
    { key: "mean",   label: t("charts.mean") },
    { key: "median", label: t("charts.median") },
    { key: "min",    label: t("charts.minimum") },
    { key: "max",    label: t("charts.maximum") },
  ];

  const activeDistMetric =
    distMetric === "hazard" && hazard === "multi" ? "loss" : distMetric;

  const metricConfig = useMemo(
    () => getMetricConfig(activeDistMetric, hazard, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDistMetric, hazard, t]
  );

  useEffect(() => {
    let ignore = false;

    async function loadTopRegions() {
      setLoadingTopRegions(true);
      setErrorTopRegions(null);

      try {
        if (topMetric === "loss") {
          const data = await fetchJson<{ name: string; loss: number }[]>(
            `/api/top-regions?hazard=${hazard}&scenario=${scenario}&climate=${climate}${runId != null ? `&run_id=${runId}` : ""}`
          );
          if (!ignore) setTopRegions(data.map((d) => ({ name: d.name, value: d.loss })));
        } else {
          // AAL: fetch all regions, sort descending, take top 10
          if (runId == null) {
            if (!ignore) setTopRegions([]);
            return;
          }
          const res = await fetchJson<{ data: { kab_kota: string; aal: number; has_data: boolean }[] }>(
            `/api/layers/values/aal?hazard=${hazard}&climate=${climate}&run_id=${runId}`
          );
          const sorted = (res.data ?? [])
            .filter((d) => d.has_data && d.aal > 0)
            .sort((a, b) => b.aal - a.aal)
            .slice(0, 10)
            .map((d) => ({ name: d.kab_kota, value: d.aal }));
          if (!ignore) setTopRegions(sorted);
        }
      } catch (err) {
        console.error("Top regions fetch error:", err);
        if (!ignore) {
          setErrorTopRegions(t("charts.errTopRegions"));
          setTopRegions([]);
        }
      } finally {
        if (!ignore) setLoadingTopRegions(false);
      }
    }

    void loadTopRegions();

    return () => {
      ignore = true;
    };
  }, [hazard, scenario, climate, runId, topMetric]);

  useEffect(() => {
    if (runId === undefined) return;

    // Fast path: re-use the loss data already fetched by the page-level fetchAllLayers.
    // This avoids firing a duplicate request for the default (loss) metric.
    if (metricConfig.endpoint === "loss" && preloadedLossItems !== undefined) {
      setDistData(preloadedLossItems);
      setLoadingDist(false);
      setErrorDist(null);
      return;
    }

    let ignore = false;
    const activeRunId = runId;

    async function loadDistribution() {
      setLoadingDist(true);
      setErrorDist(null);

      try {
        const res = await fetchJson<{ data: Record<string, unknown>[] }>(
          buildDistributionUrl({
            metric: metricConfig.endpoint,
            hazard,
            scenario,
            climate,
            runId: activeRunId,
          })
        );
        const raw = res.data ?? [];
        const isHazardMetric = metricConfig.endpoint === "hazard";
        const normalized: DistItem[] = raw.map((d) => {
          // For hazard endpoint, exclude regions with no real data.
          // Backend uses COALESCE(mean_value, 0), so has_data=false means the
          // 0 is a placeholder, not a real measurement.
          if (isHazardMetric && d.has_data === false) {
            return { kab_kota: String(d.kab_kota ?? ""), prov: String(d.prov ?? ""), value: null };
          }
          return {
            kab_kota: String(d.kab_kota ?? ""),
            prov: String(d.prov ?? ""),
            value:
              d[metricConfig.valueKey] != null
                ? Number(d[metricConfig.valueKey])
                : null,
          };
        });
        if (!ignore) setDistData(normalized);
      } catch (err) {
        console.error("Distribution fetch error:", err);
        if (!ignore) {
          setErrorDist(t("charts.errDistribution"));
          setDistData([]);
        }
      } finally {
        if (!ignore) setLoadingDist(false);
      }
    }

    void loadDistribution();

    return () => {
      ignore = true;
    };
  }, [hazard, scenario, climate, runId, activeDistMetric, metricConfig.endpoint, metricConfig.valueKey, preloadedLossItems]);

  const chartTopRegions = useMemo(() => {
    return topRegions.map((item, index) => {
      const isSelected =
        !!selectedRegion &&
        item.name.toLowerCase().trim() === selectedRegion.toLowerCase().trim();
      return {
        ...item,
        shortName: shortenRegionName(item.name),
        rank: index + 1,
        fill: isSelected
          ? chartTheme.selectedFill
          : index < 3
            ? "var(--color-primary)"
            : "#93c5fd",
      };
    });
  }, [topRegions, selectedRegion, chartTheme.selectedFill]);

  const topRegionSummary = useMemo(() => {
    if (!topRegions.length) return { name: "-", value: 0 };
    return { name: topRegions[0].name, value: topRegions[0].value };
  }, [topRegions]);

  const histogramData = useMemo((): {
    buckets: HistogramBucket[];
    stats: HistogramStats | null;
    meanLabel: string | null;
    medianLabel: string | null;
    validCount: number;
    bucketCount: number;
    usedLogScale: boolean;
  } => {
    const { filterZero, formatRange, formatTick, useLogScale } = metricConfig;
    const values = distData
      .map((d) => d.value)
      .filter(
        (v): v is number =>
          v !== null && Number.isFinite(v) && (filterZero ? v > 0 : true)
      );

    const validCount = values.length;
    const empty = { buckets: [], stats: null, meanLabel: null, medianLabel: null, validCount: 0, bucketCount: 0, usedLogScale: false };
    if (!validCount) return empty;

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const mid = Math.floor(n / 2);
    const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    const range = max - min;
    const k = adaptiveBucketCount(n);

    const makeLabel = (lo: number, hi: number) => formatRange(lo, hi);
    const makeShortLabel = (lo: number) => formatTick(lo);

    if (range === 0) {
      const label = makeLabel(min, max);
      const shortLabel = makeShortLabel(min);
      return {
        buckets: [{ label, shortLabel, count: n, lo: min, hi: max, isPeak: true, relCount: 1 }],
        stats: { mean, median, min, max },
        meanLabel: shortLabel,
        medianLabel: shortLabel,
        validCount,
        bucketCount: 1,
        usedLogScale: false,
      };
    }

    // Log-scale bucketing for monetary metrics (loss/AAL) — prevents all data
    // clustering in bucket 1 when distribution is heavily right-skewed.
    const applyLog = useLogScale && min > 0;
    type RawBucket = { label: string; shortLabel: string; count: number; lo: number; hi: number };

    let rawBuckets: RawBucket[];
    if (applyLog) {
      const logMin = Math.log10(min);
      const logMax = Math.log10(max);
      const step = (logMax - logMin) / k;
      rawBuckets = Array.from({ length: k }, (_, i) => {
        const logLo = logMin + i * step;
        const logHi = i === k - 1 ? logMax : logLo + step;
        const lo = Math.pow(10, logLo);
        const hi = Math.pow(10, logHi);
        const count = values.filter((v) =>
          i === k - 1 ? v >= lo && v <= hi : v >= lo && v < hi
        ).length;
        return { label: makeLabel(lo, hi), shortLabel: makeShortLabel(lo), count, lo, hi };
      });
    } else {
      const step = range / k;
      rawBuckets = Array.from({ length: k }, (_, i) => {
        const lo = min + i * step;
        const hi = i === k - 1 ? max : lo + step;
        const count = values.filter((v) =>
          i === k - 1 ? v >= lo && v <= hi : v >= lo && v < hi
        ).length;
        return { label: makeLabel(lo, hi), shortLabel: makeShortLabel(lo), count, lo, hi };
      });
    }

    const peakCount = Math.max(...rawBuckets.map((b) => b.count));
    const buckets: HistogramBucket[] = rawBuckets.map((b) => ({
      ...b,
      isPeak: b.count === peakCount,
      relCount: peakCount > 0 ? b.count / peakCount : 0,
    }));

    const findShortLabel = (val: number) =>
      buckets.find((b, i) =>
        i === buckets.length - 1 ? val >= b.lo && val <= b.hi : val >= b.lo && val < b.hi
      )?.shortLabel ?? null;

    return {
      buckets,
      stats: { mean, median, min, max },
      meanLabel: findShortLabel(mean),
      medianLabel: findShortLabel(median),
      validCount,
      bucketCount: k,
      usedLogScale: applyLog,
    };
  }, [distData, metricConfig]);

  // When preloaded loss data is active, delegate loading state to the page-level flag
  // so the distribution chart shows loading while fetchAllLayers is in-flight.
  const effectiveLoadingDist =
    metricConfig.endpoint === "loss" && preloadedLossItems !== undefined
      ? (loadingLayer ?? false)
      : loadingDist;

  const hasTopRegionData = useMemo(
    () => topRegions.some((item) => safeNumber(item.value) > 0),
    [topRegions]
  );

  const hasDistData = useMemo(
    () => histogramData.buckets.some((b) => b.count > 0),
    [histogramData]
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* ── Left: Top 10 Kabupaten/Kota ─────────────────────────────────── */}
      <div className={CHART_CARD_CLASS}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={PRIMARY_ICON_CLASS}>
                  <MapPinned className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <h4 className="text-base font-bold tracking-tight text-heading">
                  {t("charts.top10Title")}
                </h4>
              </div>
              <p className="mt-1.5 text-sm text-muted">
                {t("charts.rankingBy")} {topMetric === "aal" ? "AAL" : t("charts.directLoss").toLowerCase()}.
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <FilterChip>{getHazardLabel(hazard)}</FilterChip>
                <FilterChip>{getClimateLabel(climate)}</FilterChip>
                {topMetric === "loss" && (
                  <FilterChip>{formatScenarioLabel(scenario)}</FilterChip>
                )}
              </div>
            </div>

            {/* Segmented metric control — Loss | AAL */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface)] p-0.5">
              {(["loss", "aal"] as TopMetric[]).map((m) => {
                const isActive = topMetric === m;
                return (
                  <button
                    key={m}
                    onClick={() => setTopMetric(m)}
                    className={[
                      "rounded px-2.5 py-[4px] text-[11px] font-semibold uppercase tracking-wide transition-all",
                      isActive
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : "cursor-pointer text-[var(--dashboard-text-soft)] hover:bg-[var(--dashboard-control-bg)] hover:text-[var(--dashboard-text)]",
                    ].join(" ")}
                  >
                    {getTopMetricLabel(m)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={METRIC_RAIL_CLASS}>
            <div className={METRIC_CELL_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {t("charts.topRegionLabel")}
              </p>
              <p className="text-sm font-semibold text-heading">
                {loadingTopRegions ? t("charts.loading") : topRegionSummary.name}
              </p>
            </div>
            <div className={METRIC_CELL_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                {topMetric === "aal" ? t("charts.topAal") : t("charts.topLoss")}
              </p>
              <p className="text-sm font-semibold text-heading">
                {loadingTopRegions
                  ? t("charts.loading")
                  : `${formatRupiah(topRegionSummary.value)}${topMetric === "aal" ? t("charts.perYear") : ""}`}
              </p>
            </div>
          </div>

          <div className={INSIGHT_ROW_CLASS}>
            {loadingTopRegions ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-36 rounded bg-[var(--color-border)]" />
                <div className="h-4 w-48 rounded bg-[var(--color-border)]" />
              </div>
            ) : errorTopRegions ? (
              <p className="text-sm text-[var(--dashboard-status-danger-text)]">{errorTopRegions}</p>
            ) : !hasTopRegionData ? (
              <p className="text-sm text-muted">
                {t("charts.noTopRegions")}
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 text-[var(--color-primary)]">
                  <Target className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-heading">
                    {t("charts.focusMapTitle")}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {t("charts.focusMapDesc")}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={CHART_CANVAS_CLASS}>
            {loadingTopRegions ? (
              <DashboardLoadingBlock
                heightClass="h-full"
                title={t("charts.loadingTopRegions")}
                description={t("charts.loadingTopRegionsDesc")}
              />
            ) : errorTopRegions ? (
              <div className={ERROR_CANVAS_CLASS}>
                {errorTopRegions}
              </div>
            ) : !hasTopRegionData ? (
              <DashboardEmptyState
                message={t("charts.noTopRegionsFilter")}
                actionHint={t("charts.filterHint")}
                compact
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartTopRegions}
                  layout="vertical"
                  margin={{ top: 5, right: 12, left: 4, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={chartTheme.grid}
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatCompact(safeNumber(value))}
                    tick={{ fill: chartTheme.axis, fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={118}
                    tickMargin={4}
                    tick={{ fill: chartTheme.axis, fontSize: 11 }}
                  />
                  <Tooltip
                    content={
                      <CustomTooltip
                        labelPrefix={t("charts.regionLabel")}
                        formatValue={(v) =>
                          topMetric === "aal"
                            ? `${formatRupiah(v)}/th`
                            : formatRupiah(v)
                        }
                      />
                    }
                  />
                  <Bar
                    dataKey="value"
                    radius={[0, 10, 10, 0]}
                    name={getTopMetricLabel(topMetric)}
                    onClick={(data: unknown) => {
                      const regionName =
                        typeof data === "object" &&
                        data !== null &&
                        "name" in data &&
                        typeof data.name === "string"
                          ? data.name
                          : "";
                      if (regionName) onRegionSelect?.(regionName);
                    }}
                    cursor="pointer"
                  >
                    {chartTopRegions.map((entry) => (
                      <Cell key={`${entry.name}-${entry.rank}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="flex flex-wrap gap-4 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: "var(--color-primary)" }}
              />
              {t("charts.top3Regions")}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: "#93c5fd" }}
              />
              {t("charts.otherRegions")}
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: chartTheme.selectedFill }}
              />
              {t("charts.selectedRegionLegend")}
            </div>
          </div>
        </div>
      </div>

      {/* ── Right: Distribusi (switchable metric) ───────────────────────── */}
      <div className={CHART_CARD_CLASS}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={WARNING_ICON_CLASS}>
                  <BarChart3 className="h-4 w-4 text-[var(--color-secondary-dark)]" />
                </div>
                <h4 className="text-base font-bold tracking-tight text-heading">
                  {metricConfig.title}
                </h4>
              </div>
              <p className="mt-1.5 text-sm text-muted">
                {metricConfig.subtitle}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <FilterChip>{getHazardLabel(hazard)}</FilterChip>
                <FilterChip>{getClimateLabel(climate)}</FilterChip>
                {activeDistMetric !== "aal" && (
                  <FilterChip>{formatScenarioLabel(scenario)}</FilterChip>
                )}
              </div>
            </div>

            {/* Segmented metric control */}
            <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface)] p-0.5">
              {(["loss", "aal", "hazard"] as DistMetric[]).map((m) => {
                const isDisabled = m === "hazard" && hazard === "multi";
                const isActive = activeDistMetric === m;
                return (
                  <button
                    key={m}
                    disabled={isDisabled}
                    onClick={() => setDistMetric(m)}
                    title={
                      isDisabled
                        ? t("charts.hazardIndexDisabledHint")
                        : getMetricLabel(m)
                    }
                    className={[
                      "rounded px-2.5 py-[4px] text-[11px] font-semibold uppercase tracking-wide transition-all",
                      isActive
                        ? "bg-[var(--color-primary)] text-white shadow-sm"
                        : isDisabled
                          ? "cursor-not-allowed text-[var(--dashboard-text-muted)] opacity-30"
                          : "cursor-pointer text-[var(--dashboard-text-soft)] hover:bg-[var(--dashboard-control-bg)] hover:text-[var(--dashboard-text)]",
                    ].join(" ")}
                  >
                    {getMetricLabel(m)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats: mean · median · min · max — 4-column grid */}
          <div className="grid grid-cols-4 gap-x-3 gap-y-1 border-y border-[var(--dashboard-border-soft)] py-2.5">
            {STAT_ITEMS.map(({ key, label }) => (
              <div key={key} className="min-w-0">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">
                  {label}
                </p>
                <p className="mt-0.5 truncate text-[13px] font-bold text-heading">
                  {effectiveLoadingDist ? (
                    <span className="animate-pulse text-muted">—</span>
                  ) : histogramData.stats != null ? (
                    metricConfig.formatStat(histogramData.stats[key])
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            ))}
          </div>

          <div className={INSIGHT_ROW_CLASS}>
            {effectiveLoadingDist ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-32 rounded bg-[var(--color-border)]" />
                <div className="h-4 w-44 rounded bg-[var(--color-border)]" />
              </div>
            ) : errorDist ? (
              <p className="text-sm text-[var(--dashboard-status-danger-text)]">{errorDist}</p>
            ) : !hasDistData ? (
              <p className="text-sm text-muted">
                {t("charts.noDistData")}
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 text-[var(--color-primary)]">
                  <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-heading">
                    {metricConfig.insightTitle}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {metricConfig.insightBody}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full">
            {effectiveLoadingDist ? (
              <div className="h-80 w-full rounded-md bg-[var(--dashboard-surface)] p-1">
                <DashboardLoadingBlock
                  heightClass="h-full"
                  title={metricConfig.loadingTitle}
                  description={metricConfig.loadingDesc}
                />
              </div>
            ) : errorDist ? (
              <div className="h-80 w-full rounded-md bg-[var(--dashboard-surface)] p-1">
                <div className={ERROR_CANVAS_CLASS}>{errorDist}</div>
              </div>
            ) : !hasDistData ? (
              <div className="h-80 w-full rounded-md bg-[var(--dashboard-surface)] p-1">
                <DashboardEmptyState
                  message={metricConfig.emptyMsg}
                  actionHint={t("charts.filterHint")}
                  compact
                />
              </div>
            ) : (
              <>
                <div className="h-80 w-full rounded-md bg-[var(--dashboard-surface)] p-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={histogramData.buckets}
                      margin={{ top: 22, right: 8, left: 0, bottom: 48 }}
                      barCategoryGap="10%"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartTheme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="shortLabel"
                        tick={{ fill: chartTheme.axis, fontSize: 10 }}
                        tickLine={false}
                        angle={-30}
                        textAnchor="end"
                        interval={0}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: chartTheme.axis, fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={28}
                      />
                      <Tooltip
                        content={(props) => (
                          <HistogramTooltip
                            {...props}
                            formatRange={metricConfig.formatRange}
                            regionCountLabel={t("charts.regionCountSuffix")}
                          />
                        )}
                      />
                      {histogramData.meanLabel && (
                        <ReferenceLine
                          x={histogramData.meanLabel}
                          stroke="#f97316"
                          strokeDasharray="4 3"
                          strokeWidth={1.5}
                          label={{ value: "μ", position: "top", fill: "#f97316", fontSize: 11 }}
                        />
                      )}
                      {histogramData.medianLabel &&
                        histogramData.medianLabel !== histogramData.meanLabel && (
                          <ReferenceLine
                            x={histogramData.medianLabel}
                            stroke="#8b5cf6"
                            strokeDasharray="4 3"
                            strokeWidth={1.5}
                            label={{ value: "med", position: "top", fill: "#8b5cf6", fontSize: 11 }}
                          />
                        )}
                      <Bar
                        dataKey="count"
                        radius={[4, 4, 0, 0]}
                        name={t("charts.regionCount")}
                      >
                        {histogramData.buckets.map((bucket, i) => (
                          <Cell
                            key={i}
                            fill="var(--color-primary)"
                            fillOpacity={0.18 + 0.82 * bucket.relCount}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Legend + metadata */}
                <div className="mt-2 flex flex-wrap items-center justify-between gap-y-1.5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--color-primary)]" />
                      {t("charts.highestFrequency")}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--color-primary)] opacity-25" />
                      {t("charts.lowFrequency")}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-[2px] w-5 border-t-2 border-dashed border-orange-400" />
                      {t("charts.meanLegend")}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block h-[2px] w-5 border-t-2 border-dashed border-violet-500" />
                      {t("charts.median")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted">
                    <span className="rounded bg-[var(--dashboard-surface-muted)] px-1.5 py-0.5 font-semibold uppercase tracking-wide">
                      {histogramData.usedLogScale ? t("charts.logScale") : t("charts.linearScale")}
                    </span>
                    <span>{histogramData.validCount} {t("charts.regionCountSuffix")} · {histogramData.bucketCount} interval</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
