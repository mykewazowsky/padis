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

type Props = {
  scenario: string;
  hazard: string;
  climate: string;
  runId?: number;
  selectedRegion?: string;
  onRegionSelect?: (region: string) => void;
};

type TopRegionItem = {
  name: string;
  loss: number;
};

type DistItem = {
  kab_kota: string;
  prov: string;
  value: number | null;
};

type HistogramBucket = {
  label: string;
  count: number;
  lo: number;
  hi: number;
  isPeak: boolean;
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

const METRIC_LABELS: Record<DistMetric, string> = {
  loss:   "Loss",
  aal:    "AAL",
  hazard: "Indeks",
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

function getHazardLabel(hazard: string) {
  if (hazard === "flood") return "Banjir";
  if (hazard === "drought") return "Kekeringan";
  return "Multi-hazard";
}

function getClimateLabel(climate: string) {
  return climate === "climate" ? "Iklim" : "Non-Iklim";
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

type MetricConfig = {
  title: string;
  subtitle: string;
  endpoint: DistMetric;
  valueKey: string;
  filterZero: boolean;
  formatStat: (v: number) => string;
  formatRange: (lo: number, hi: number) => string;
  insightTitle: string;
  insightBody: string;
  emptyMsg: string;
  loadingTitle: string;
  loadingDesc: string;
};

function getMetricConfig(metric: DistMetric, hazard: string): MetricConfig {
  if (metric === "loss") {
    return {
      title: "Distribusi Loss",
      subtitle: "Sebaran wilayah berdasarkan nilai kerugian.",
      endpoint: "loss",
      valueKey: "loss",
      filterZero: true,
      formatStat: (v) => `Rp ${formatCompact(v)}`,
      formatRange: (lo, hi) => `Rp ${formatCompact(lo)} – Rp ${formatCompact(hi)}`,
      insightTitle: "Pola distribusi kerugian",
      insightBody:
        "Setiap batang menunjukkan jumlah kabupaten/kota dalam rentang kerugian tertentu. Distribusi condong ke kanan mengindikasikan konsentrasi risiko di sedikit wilayah.",
      emptyMsg: "Belum ada data distribusi untuk kombinasi filter ini.",
      loadingTitle: "Memuat distribusi kerugian...",
      loadingDesc: "Data kerugian per kabupaten sedang diproses.",
    };
  }

  if (metric === "aal") {
    return {
      title: "Distribusi AAL",
      subtitle: "Sebaran wilayah berdasarkan kerugian tahunan rata-rata.",
      endpoint: "aal",
      valueKey: "aal",
      filterZero: true,
      formatStat: (v) => `Rp ${formatCompact(v)}/th`,
      formatRange: (lo, hi) =>
        `Rp ${formatCompact(lo)} – Rp ${formatCompact(hi)}/th`,
      insightTitle: "Pola distribusi AAL",
      insightBody:
        "Setiap batang menunjukkan jumlah kabupaten/kota dalam rentang kerugian tahunan rata-rata (AAL) tertentu.",
      emptyMsg: "Belum ada data distribusi AAL untuk kombinasi filter ini.",
      loadingTitle: "Memuat distribusi AAL...",
      loadingDesc: "Data AAL per kabupaten sedang diproses.",
    };
  }

  // hazard / indeks
  const hazardLabel = getHazardLabel(hazard);
  const isFlood = hazard === "flood";
  const unit = isFlood ? " m" : "";
  const fmtVal = (v: number) => `${formatIdNum(v)}${unit}`;

  return {
    title: `Distribusi Indeks ${hazardLabel}`,
    subtitle: "Sebaran wilayah berdasarkan nilai indeks bahaya.",
    endpoint: "hazard",
    valueKey: "mean_value",
    filterZero: false,
    formatStat: fmtVal,
    formatRange: (lo, hi) =>
      `${formatIdNum(lo, 2)} – ${formatIdNum(hi, 2)}${unit}`,
    insightTitle: `Pola distribusi indeks ${hazardLabel.toLowerCase()}`,
    insightBody:
      "Setiap batang menunjukkan jumlah kabupaten/kota dalam rentang nilai indeks bahaya tertentu.",
    emptyMsg: "Belum ada data distribusi indeks untuk kombinasi filter ini.",
    loadingTitle: `Memuat distribusi indeks ${hazardLabel.toLowerCase()}...`,
    loadingDesc: "Data indeks bahaya per kabupaten sedang diproses.",
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
  const params = new URLSearchParams({ hazard });

  if (metric === "loss") {
    params.set("scenario", scenario);
    params.set("climate", climate);
  }

  if (metric === "aal") {
    params.set("climate", climate);
  }

  if (metric === "hazard") {
    params.set("scenario", climate);
    params.set("rp", scenario);
  }

  params.set("run_id", String(runId));
  return `/api/layers/values/${metric}?${params.toString()}`;
}

function CustomTooltip({
  active,
  payload,
  label,
  labelPrefix,
}: {
  active?: boolean;
  payload?: readonly TooltipPayloadItem[];
  label?: string;
  labelPrefix: string;
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
                {formatRupiah(safeNumber(entry.value))}
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
}: {
  active?: boolean;
  payload?: readonly HistogramTooltipPayloadItem[];
  formatRange: (lo: number, hi: number) => string;
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
        {bucket.count} wilayah
      </p>
    </div>
  );
}

const STAT_ITEMS: { key: keyof HistogramStats; label: string }[] = [
  { key: "mean",   label: "Rata-rata" },
  { key: "median", label: "Median"    },
  { key: "min",    label: "Minimum"   },
  { key: "max",    label: "Maksimum"  },
];

const BUCKET_COUNT = 10;

const CHART_CARD_CLASS =
  "rounded-lg border border-[var(--dashboard-border-solid)] bg-[var(--dashboard-surface-solid)] p-4 md:p-5";
const METRIC_RAIL_CLASS =
  "flex flex-wrap items-baseline gap-x-5 gap-y-2 border-y border-[var(--dashboard-border-soft)] py-2.5";
const METRIC_CELL_CLASS =
  "flex min-w-0 items-baseline gap-2";
const STAT_RAIL_CLASS =
  "flex flex-wrap items-baseline gap-x-4 gap-y-2 border-y border-[var(--dashboard-border-soft)] py-2.5";
const STAT_CELL_CLASS =
  "flex min-w-0 items-baseline gap-2";
const INSIGHT_ROW_CLASS =
  "border-l border-[var(--dashboard-border-solid)] py-1 pl-3";
const CHART_CANVAS_CLASS =
  "h-80 w-full rounded-md bg-[var(--dashboard-surface)] p-1";
const HISTOGRAM_CANVAS_CLASS =
  "h-72 w-full rounded-md bg-[var(--dashboard-surface)] p-1";
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
}: Props) {
  const [topRegions, setTopRegions] = useState<TopRegionItem[]>([]);
  const [distData, setDistData] = useState<DistItem[]>([]);
  const [distMetric, setDistMetric] = useState<DistMetric>("loss");

  const [loadingTopRegions, setLoadingTopRegions] = useState(false);
  const [loadingDist, setLoadingDist] = useState(false);

  const [errorTopRegions, setErrorTopRegions] = useState<string | null>(null);
  const [errorDist, setErrorDist] = useState<string | null>(null);

  const chartTheme = useChartTheme();
  const activeDistMetric =
    distMetric === "hazard" && hazard === "multi" ? "loss" : distMetric;

  const metricConfig = useMemo(
    () => getMetricConfig(activeDistMetric, hazard),
    [activeDistMetric, hazard]
  );

  useEffect(() => {
    let ignore = false;

    async function loadTopRegions() {
      setLoadingTopRegions(true);
      setErrorTopRegions(null);

      try {
        const data = await fetchJson<TopRegionItem[]>(
          `/api/top-regions?hazard=${hazard}&scenario=${scenario}&climate=${climate}${runId != null ? `&run_id=${runId}` : ""}`
        );
        if (!ignore) setTopRegions(data);
      } catch (err) {
        console.error("Top regions fetch error:", err);
        if (!ignore) {
          setErrorTopRegions("Gagal memuat chart top wilayah.");
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
  }, [hazard, scenario, climate, runId]);

  useEffect(() => {
    if (runId === undefined) return;

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
        const normalized: DistItem[] = raw.map((d) => ({
          kab_kota: String(d.kab_kota ?? ""),
          prov: String(d.prov ?? ""),
          value:
            d[metricConfig.valueKey] != null
              ? Number(d[metricConfig.valueKey])
              : null,
        }));
        if (!ignore) setDistData(normalized);
      } catch (err) {
        console.error("Distribution fetch error:", err);
        if (!ignore) {
          setErrorDist("Gagal memuat data distribusi.");
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
  }, [hazard, scenario, climate, runId, activeDistMetric, metricConfig.endpoint, metricConfig.valueKey]);

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
    return { name: topRegions[0].name, value: topRegions[0].loss };
  }, [topRegions]);

  const histogramData = useMemo((): {
    buckets: HistogramBucket[];
    stats: HistogramStats | null;
    meanLabel: string | null;
    medianLabel: string | null;
  } => {
    const { filterZero, formatRange } = metricConfig;
    const values = distData
      .map((d) => d.value)
      .filter(
        (v): v is number =>
          v !== null && Number.isFinite(v) && (filterZero ? v > 0 : true)
      );

    if (!values.length) return { buckets: [], stats: null, meanLabel: null, medianLabel: null };

    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const min = sorted[0];
    const max = sorted[n - 1];
    const sum = values.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const mid = Math.floor(n / 2);
    const median =
      n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

    const range = max - min;
    const makeLabel = (lo: number, hi: number) => formatRange(lo, hi);

    if (range === 0) {
      const label = makeLabel(min, max);
      return {
        buckets: [{ label, count: n, lo: min, hi: max, isPeak: true }],
        stats: { mean, median, min, max },
        meanLabel: label,
        medianLabel: label,
      };
    }

    const bucketSize = range / BUCKET_COUNT;
    const rawBuckets = Array.from({ length: BUCKET_COUNT }, (_, i) => {
      const lo = min + i * bucketSize;
      const hi = i === BUCKET_COUNT - 1 ? max : lo + bucketSize;
      const count = values.filter((v) =>
        i === BUCKET_COUNT - 1 ? v >= lo && v <= hi : v >= lo && v < hi
      ).length;
      return { label: makeLabel(lo, hi), count, lo, hi, isPeak: false };
    });

    const peakCount = Math.max(...rawBuckets.map((b) => b.count));
    const buckets: HistogramBucket[] = rawBuckets.map((b) => ({
      ...b,
      isPeak: b.count === peakCount,
    }));

    const findLabel = (val: number) =>
      buckets.find((b, i) =>
        i === buckets.length - 1 ? val >= b.lo && val <= b.hi : val >= b.lo && val < b.hi
      )?.label ?? null;

    return {
      buckets,
      stats: { mean, median, min, max },
      meanLabel: findLabel(mean),
      medianLabel: findLabel(median),
    };
  }, [distData, metricConfig]);

  const hasTopRegionData = useMemo(
    () => topRegions.some((item) => safeNumber(item.loss) > 0),
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
                  Top 10 Kabupaten/Kota
                </h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                Ranking wilayah dengan kerugian tertinggi untuk {getHazardLabel(hazard)} ·{" "}
                {scenario.toUpperCase()} · {getClimateLabel(climate)}
              </p>
            </div>
            <div className="shrink-0 border-l border-[var(--dashboard-border-solid)] pl-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--dashboard-text-soft)]">
              Klik untuk fokus ke peta
            </div>
          </div>

          <div className={METRIC_RAIL_CLASS}>
            <div className={METRIC_CELL_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Wilayah Tertinggi
              </p>
              <p className="text-sm font-semibold text-heading">
                {loadingTopRegions ? "Loading..." : topRegionSummary.name}
              </p>
            </div>
            <div className={METRIC_CELL_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Loss Tertinggi
              </p>
              <p className="text-sm font-semibold text-heading">
                {loadingTopRegions
                  ? "Loading..."
                  : formatRupiah(topRegionSummary.value)}
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
                Belum ada wilayah dengan kerugian yang cukup untuk ditampilkan.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 text-[var(--color-primary)]">
                  <Target className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-heading">
                    Fokus cepat ke peta
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Klik batang chart untuk memilih wilayah dan memfokuskan map
                    ke kabupaten/kota terkait.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={CHART_CANVAS_CLASS}>
            {loadingTopRegions ? (
              <DashboardLoadingBlock
                heightClass="h-full"
                title="Memuat ranking wilayah..."
                description="Sistem sedang menyusun wilayah dengan kerugian tertinggi."
              />
            ) : errorTopRegions ? (
              <div className={ERROR_CANVAS_CLASS}>
                {errorTopRegions}
              </div>
            ) : !hasTopRegionData ? (
              <DashboardEmptyState
                message="Belum ada data top wilayah untuk kombinasi filter ini."
                actionHint="Coba ubah hazard, scenario, atau kondisi iklim."
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
                  <Tooltip content={<CustomTooltip labelPrefix="Wilayah" />} />
                  <Bar
                    dataKey="loss"
                    radius={[0, 10, 10, 0]}
                    name="Loss"
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
              Top 3 wilayah
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: "#93c5fd" }}
              />
              Wilayah lainnya
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: chartTheme.selectedFill }}
              />
              Wilayah terpilih
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
              <p className="mt-2 text-sm text-muted">
                {metricConfig.subtitle}
              </p>
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
                        ? "Indeks tidak tersedia untuk Multi-hazard"
                        : METRIC_LABELS[m]
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
                    {METRIC_LABELS[m]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats: mean · median · min · max */}
          <div className={STAT_RAIL_CLASS}>
            {STAT_ITEMS.map(({ key, label }) => (
              <div key={key} className={STAT_CELL_CLASS}>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {label}
                </p>
                <p className="truncate text-sm font-semibold text-heading">
                  {loadingDist ? (
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
            {loadingDist ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-32 rounded bg-[var(--color-border)]" />
                <div className="h-4 w-44 rounded bg-[var(--color-border)]" />
              </div>
            ) : errorDist ? (
              <p className="text-sm text-[var(--dashboard-status-danger-text)]">{errorDist}</p>
            ) : !hasDistData ? (
              <p className="text-sm text-muted">
                Belum ada data distribusi yang dapat divisualisasikan.
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
            {loadingDist ? (
              <div className={HISTOGRAM_CANVAS_CLASS}>
                <DashboardLoadingBlock
                  heightClass="h-full"
                  title={metricConfig.loadingTitle}
                  description={metricConfig.loadingDesc}
                />
              </div>
            ) : errorDist ? (
              <div className={HISTOGRAM_CANVAS_CLASS}>
                <div className={ERROR_CANVAS_CLASS}>{errorDist}</div>
              </div>
            ) : !hasDistData ? (
              <div className={HISTOGRAM_CANVAS_CLASS}>
                <DashboardEmptyState
                  message={metricConfig.emptyMsg}
                  actionHint="Coba ubah hazard, scenario, atau kondisi iklim."
                  compact
                />
              </div>
            ) : (
              <>
                <div className={HISTOGRAM_CANVAS_CLASS}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={histogramData.buckets}
                      margin={{ top: 20, right: 8, left: 0, bottom: 52 }}
                      barCategoryGap="8%"
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={chartTheme.grid}
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: chartTheme.axis, fontSize: 10 }}
                        tickLine={false}
                        angle={-40}
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
                        name="Jumlah Wilayah"
                      >
                        {histogramData.buckets.map((bucket) => (
                          <Cell
                            key={bucket.label}
                            fill="var(--color-primary)"
                            fillOpacity={bucket.isPeak ? 1 : 0.45}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--color-primary)]" />
                    Frekuensi tertinggi
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[var(--color-primary)] opacity-45" />
                    Bucket lainnya
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[2px] w-5 border-t-2 border-dashed border-orange-400" />
                    Rata-rata (μ)
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-block h-[2px] w-5 border-t-2 border-dashed border-violet-500" />
                    Median
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
