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

type LossDistItem = {
  kab_kota: string;
  prov: string;
  loss: number | null;
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
  if (hazard === "flood") return "Flood";
  if (hazard === "drought") return "Drought";
  return "Multi-hazard";
}

function getClimateLabel(climate: string) {
  return climate === "climate" ? "Climate" : "Non-Climate";
}

function shortenRegionName(name: string) {
  if (!name) return "-";
  const cleaned = name
    .replace(/^kabupaten\s+/i, "Kab. ")
    .replace(/^kota\s+/i, "Kota ")
    .trim();
  return cleaned.length > 18 ? `${cleaned.slice(0, 18)}…` : cleaned;
}

function CustomTooltip({
  active,
  payload,
  label,
  labelPrefix,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  labelPrefix: string;
}) {
  if (!active || !payload || !payload.length) return null;
  const fullName = (payload[0]?.payload?.name as string | undefined) ?? label;
  return (
    <div className="rounded-2xl border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-4 py-3 shadow-[var(--chart-tooltip-shadow)]">
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
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload?.length) return null;
  const bucket = payload[0]?.payload as HistogramBucket | undefined;
  if (!bucket) return null;
  return (
    <div className="rounded-2xl border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-4 py-3 shadow-[var(--chart-tooltip-shadow)]">
      <p className="text-xs font-semibold tracking-wide text-[var(--chart-tooltip-muted)]">
        Rp {formatCompact(bucket.lo)} – Rp {formatCompact(bucket.hi)}
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

export default function AdvancedCharts({
  scenario,
  hazard,
  climate,
  runId,
  selectedRegion,
  onRegionSelect,
}: Props) {
  const [topRegions, setTopRegions] = useState<TopRegionItem[]>([]);
  const [lossDistribution, setLossDistribution] = useState<LossDistItem[]>([]);

  const [loadingTopRegions, setLoadingTopRegions] = useState(false);
  const [loadingLossDist, setLoadingLossDist] = useState(false);

  const [errorTopRegions, setErrorTopRegions] = useState<string | null>(null);
  const [errorLossDist, setErrorLossDist] = useState<string | null>(null);
  const chartTheme = useChartTheme();

  useEffect(() => {
    setLoadingTopRegions(true);
    setErrorTopRegions(null);
    fetchJson<TopRegionItem[]>(
      `/api/top-regions?hazard=${hazard}&scenario=${scenario}&climate=${climate}${runId != null ? `&run_id=${runId}` : ""}`
    )
      .then(setTopRegions)
      .catch((err) => {
        console.error("Top regions fetch error:", err);
        setErrorTopRegions("Gagal memuat chart top wilayah.");
        setTopRegions([]);
      })
      .finally(() => setLoadingTopRegions(false));
  }, [hazard, scenario, climate, runId]);

  useEffect(() => {
    if (runId === undefined) return;
    setLoadingLossDist(true);
    setErrorLossDist(null);
    fetchJson<{ data: LossDistItem[] }>(
      `/api/layers/values/loss?hazard=${hazard}&scenario=${scenario}&climate=${climate}&run_id=${runId}`
    )
      .then((res) => setLossDistribution(res.data ?? []))
      .catch((err) => {
        console.error("Loss distribution fetch error:", err);
        setErrorLossDist("Gagal memuat distribusi kerugian.");
        setLossDistribution([]);
      })
      .finally(() => setLoadingLossDist(false));
  }, [hazard, scenario, climate, runId]);

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
    const values = lossDistribution
      .map((d) => safeNumber(d.loss))
      .filter((v) => v > 0);

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

    const makeLabel = (lo: number, hi: number) =>
      `${formatCompact(lo)}–${formatCompact(hi)}`;

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
  }, [lossDistribution]);

  const hasTopRegionData = useMemo(
    () => topRegions.some((item) => safeNumber(item.loss) > 0),
    [topRegions]
  );

  const hasLossDistData = useMemo(
    () => histogramData.buckets.some((b) => b.count > 0),
    [histogramData]
  );

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* ── Left: Top 10 Kabupaten/Kota ─────────────────────────────────── */}
      <div className="card card-accent-primary p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[var(--color-primary-soft)] p-2">
                  <MapPinned className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <h4 className="text-lg font-bold tracking-tight text-heading">
                  Top 10 Kabupaten/Kota
                </h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                Ranking wilayah dengan kerugian tertinggi untuk {getHazardLabel(hazard)} ·{" "}
                {scenario.toUpperCase()} · {getClimateLabel(climate)}
              </p>
            </div>
            <div className="rounded-full border border-[var(--color-border)] bg-[var(--color-gray-light)] px-3 py-1 text-xs font-semibold text-heading">
              Klik untuk fokus ke peta
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="surface-soft rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Wilayah Tertinggi
              </p>
              <p className="mt-2 text-lg font-bold text-heading">
                {loadingTopRegions ? "Loading..." : topRegionSummary.name}
              </p>
            </div>
            <div className="surface-soft rounded-2xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Loss Tertinggi
              </p>
              <p className="mt-2 text-lg font-bold text-heading">
                {loadingTopRegions
                  ? "Loading..."
                  : formatRupiah(topRegionSummary.value)}
              </p>
            </div>
          </div>

          <div className="surface-soft rounded-2xl px-4 py-3">
            {loadingTopRegions ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-36 rounded bg-[var(--color-border)]" />
                <div className="h-4 w-48 rounded bg-[var(--color-border)]" />
              </div>
            ) : errorTopRegions ? (
              <p className="text-sm text-red-600">{errorTopRegions}</p>
            ) : !hasTopRegionData ? (
              <p className="text-sm text-muted">
                Belum ada wilayah dengan kerugian yang cukup untuk ditampilkan.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[var(--content-surface,var(--dashboard-surface-solid,#ffffff))] p-2 shadow-sm">
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

          <div className="h-80 w-full">
            {loadingTopRegions ? (
              <DashboardLoadingBlock
                heightClass="h-80"
                title="Memuat ranking wilayah..."
                description="Sistem sedang menyusun wilayah dengan kerugian tertinggi."
              />
            ) : errorTopRegions ? (
              <div className="flex h-80 w-full items-center justify-center rounded-2xl border border-[var(--dashboard-status-danger-border)] bg-[var(--dashboard-status-danger-bg)] text-sm text-[var(--dashboard-status-danger-text)]">
                {errorTopRegions}
              </div>
            ) : !hasTopRegionData ? (
              <DashboardEmptyState
                message="Belum ada data top wilayah untuk kombinasi filter ini."
                actionHint="Coba ubah hazard, scenario, atau climate condition."
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
                    onClick={(data: any) => {
                      const regionName = data?.name ?? "";
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

      {/* ── Right: Distribusi Loss (Histogram) ──────────────────────────── */}
      <div className="card card-accent-secondary p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[var(--color-secondary-soft)] p-2">
                  <BarChart3 className="h-4 w-4 text-[var(--color-secondary-dark)]" />
                </div>
                <h4 className="text-lg font-bold tracking-tight text-heading">
                  Distribusi Loss
                </h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                Sebaran jumlah kabupaten/kota berdasarkan rentang kerugian untuk{" "}
                {getHazardLabel(hazard)} · {scenario.toUpperCase()} ·{" "}
                {getClimateLabel(climate)}
              </p>
            </div>
            <div className="rounded-full border border-[var(--color-border)] bg-[var(--color-gray-light)] px-3 py-1 text-xs font-semibold text-heading">
              {scenario.toUpperCase()}
            </div>
          </div>

          {/* Stats: mean · median · min · max */}
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {STAT_ITEMS.map(({ key, label }) => (
              <div
                key={key}
                className="surface-soft rounded-2xl p-3"
              >
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {label}
                </p>
                <p className="mt-1.5 truncate text-sm font-bold text-heading">
                  {loadingLossDist ? (
                    <span className="animate-pulse text-muted">—</span>
                  ) : histogramData.stats != null ? (
                    `Rp ${formatCompact(histogramData.stats[key])}`
                  ) : (
                    "—"
                  )}
                </p>
              </div>
            ))}
          </div>

          <div className="surface-soft rounded-2xl px-4 py-3">
            {loadingLossDist ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-32 rounded bg-[var(--color-border)]" />
                <div className="h-4 w-44 rounded bg-[var(--color-border)]" />
              </div>
            ) : errorLossDist ? (
              <p className="text-sm text-red-600">{errorLossDist}</p>
            ) : !hasLossDistData ? (
              <p className="text-sm text-muted">
                Belum ada data distribusi yang dapat divisualisasikan.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-[var(--content-surface,var(--dashboard-surface-solid,#ffffff))] p-2 shadow-sm">
                  <BarChart3 className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-heading">
                    Pola distribusi kerugian
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    Setiap batang menunjukkan jumlah kabupaten/kota dalam
                    rentang kerugian tertentu. Distribusi condong ke kanan
                    mengindikasikan konsentrasi risiko di sedikit wilayah.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full">
            {loadingLossDist ? (
              <DashboardLoadingBlock
                heightClass="h-72"
                title="Memuat distribusi kerugian..."
                description="Data kerugian per kabupaten sedang diproses."
              />
            ) : errorLossDist ? (
              <div className="flex h-72 w-full items-center justify-center rounded-2xl border border-[var(--dashboard-status-danger-border)] bg-[var(--dashboard-status-danger-bg)] text-sm text-[var(--dashboard-status-danger-text)]">
                {errorLossDist}
              </div>
            ) : !hasLossDistData ? (
              <DashboardEmptyState
                message="Belum ada data distribusi untuk kombinasi filter ini."
                actionHint="Coba ubah hazard, scenario, atau climate condition."
              />
            ) : (
              <>
                <div className="h-72 w-full">
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
                    <Tooltip content={<HistogramTooltip />} />
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
