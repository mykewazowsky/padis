"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  Layers3,
  MapPinned,
  PieChart as PieChartIcon,
  Target,
} from "lucide-react";
import { fetchJson } from "../../lib/fetcher";
import DashboardLoadingBlock from "../dashboard/DashboardLoadingBlock";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";

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

type BreakdownItem = {
  hazard: string;
  total: number;
};

const COLORS = [
  "var(--color-primary)",
  "var(--color-secondary)",
  "var(--color-accent)",
];

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

  return cleaned.length > 20 ? `${cleaned.slice(0, 20)}…` : cleaned;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
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
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-semibold tracking-wide text-gray-500">
        {labelPrefix}: {fullName}
      </p>
      <div className="mt-2 space-y-1">
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-gray-700">
              {entry.name}:{" "}
              <span className="font-semibold text-gray-900">
                {formatRupiah(safeNumber(entry.value))}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CustomPieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: any[];
}) {
  if (!active || !payload || !payload.length) return null;

  const item = payload[0]?.payload;

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-semibold tracking-wide text-gray-500">
        Hazard: {item?.hazard ?? "-"}
      </p>
      <div className="mt-2 text-sm text-gray-700">
        <div>
          Loss:{" "}
          <span className="font-semibold text-gray-900">
            {formatRupiah(safeNumber(item?.totalValue))}
          </span>
        </div>
        <div>
          Share:{" "}
          <span className="font-semibold text-gray-900">
            {formatPercent(safeNumber(item?.percent))}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function AdvancedCharts({
  scenario,
  hazard,
  climate,
  runId,
  selectedRegion,
  onRegionSelect,
}: Props) {
  const [topRegions, setTopRegions] = useState<TopRegionItem[]>([]);
  const [breakdown, setBreakdown] = useState<BreakdownItem[]>([]);

  const [loadingTopRegions, setLoadingTopRegions] = useState(false);
  const [loadingBreakdown, setLoadingBreakdown] = useState(false);

  const [errorTopRegions, setErrorTopRegions] = useState<string | null>(null);
  const [errorBreakdown, setErrorBreakdown] = useState<string | null>(null);

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
    setLoadingBreakdown(true);
    setErrorBreakdown(null);

    fetchJson<BreakdownItem[]>(
      `/api/hazard-breakdown?scenario=${scenario}&climate=${climate}${runId != null ? `&run_id=${runId}` : ""}`
    )
      .then(setBreakdown)
      .catch((err) => {
        console.error("Breakdown fetch error:", err);
        setErrorBreakdown("Gagal memuat breakdown hazard.");
        setBreakdown([]);
      })
      .finally(() => setLoadingBreakdown(false));
  }, [scenario, climate, runId]);

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
          ? "#111827"
          : index < 3
            ? "var(--color-primary)"
            : "#93c5fd",
      };
    });
  }, [topRegions, selectedRegion]);

  const topRegionSummary = useMemo(() => {
    if (!topRegions.length) {
      return {
        name: "-",
        value: 0,
      };
    }

    return {
      name: topRegions[0].name,
      value: topRegions[0].loss,
    };
  }, [topRegions]);

  const breakdownWithPercent = useMemo(() => {
    const total = breakdown.reduce((sum, item) => sum + safeNumber(item.total), 0);

    return breakdown.map((item, index) => ({
      ...item,
      totalValue: safeNumber(item.total),
      percent: total > 0 ? (safeNumber(item.total) / total) * 100 : 0,
      fill: COLORS[index % COLORS.length],
    }));
  }, [breakdown]);

  const dominantHazard = useMemo(() => {
    if (!breakdownWithPercent.length) {
      return {
        hazard: "-",
        totalValue: 0,
        percent: 0,
      };
    }

    return breakdownWithPercent.reduce((max, item) =>
      item.totalValue > max.totalValue ? item : max
    );
  }, [breakdownWithPercent]);

  const hasTopRegionData = useMemo(() => {
    return topRegions.some((item) => safeNumber(item.loss) > 0);
  }, [topRegions]);

  const hasBreakdownData = useMemo(() => {
    return breakdownWithPercent.some((item) => safeNumber(item.totalValue) > 0);
  }, [breakdownWithPercent]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="card card-accent-primary p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[var(--color-primary-soft)] p-2">
                  <MapPinned className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <h4 className="text-lg font-bold tracking-tight text-gray-900">
                  Top 10 Kabupaten/Kota
                </h4>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Ranking wilayah dengan loss tertinggi untuk {getHazardLabel(hazard)} ·{" "}
                {scenario.toUpperCase()} · {getClimateLabel(climate)}
              </p>
            </div>

            <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
              Click to focus
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Wilayah Tertinggi
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {loadingTopRegions ? "Loading..." : topRegionSummary.name}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Loss Tertinggi
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {loadingTopRegions
                  ? "Loading..."
                  : formatRupiah(topRegionSummary.value)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            {loadingTopRegions ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-36 rounded bg-gray-200" />
                <div className="h-4 w-48 rounded bg-gray-200" />
              </div>
            ) : errorTopRegions ? (
              <p className="text-sm text-red-600">{errorTopRegions}</p>
            ) : !hasTopRegionData ? (
              <p className="text-sm text-gray-500">
                Belum ada wilayah dengan loss yang cukup untuk ditampilkan.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <Target className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Fokus cepat ke peta
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
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
                description="Sistem sedang menyusun wilayah dengan loss tertinggi."
              />
            ) : errorTopRegions ? (
              <div className="flex h-80 w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-sm text-red-600">
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
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(value) => formatCompact(safeNumber(value))}
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="shortName"
                    width={148}
                    tick={{ fill: "#374151", fontSize: 11 }}
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

          <div className="flex flex-wrap gap-4 text-xs text-gray-600">
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
                style={{ backgroundColor: "#111827" }}
              />
              Wilayah terpilih
            </div>
          </div>
        </div>
      </div>

      <div className="card card-accent-secondary p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[var(--color-secondary-soft)] p-2">
                  <PieChartIcon className="h-4 w-4 text-[var(--color-secondary-dark)]" />
                </div>
                <h4 className="text-lg font-bold tracking-tight text-gray-900">
                  Breakdown Hazard
                </h4>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Komposisi total loss antar hazard untuk {scenario.toUpperCase()} ·{" "}
                {getClimateLabel(climate)}
              </p>
            </div>

            <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
              Scenario {scenario.toUpperCase()}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Hazard Dominan
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {loadingBreakdown ? "Loading..." : dominantHazard.hazard}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Share Dominan
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {loadingBreakdown
                  ? "Loading..."
                  : `${formatPercent(dominantHazard.percent)}`}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            {loadingBreakdown ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-32 rounded bg-gray-200" />
                <div className="h-4 w-44 rounded bg-gray-200" />
              </div>
            ) : errorBreakdown ? (
              <p className="text-sm text-red-600">{errorBreakdown}</p>
            ) : !hasBreakdownData ? (
              <p className="text-sm text-gray-500">
                Belum ada breakdown hazard yang dapat divisualisasikan.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <Layers3 className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Komposisi antar hazard
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    Chart ini menunjukkan proporsi kontribusi Flood, Drought,
                    dan Multi-hazard pada total loss skenario aktif.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="h-80 w-full">
            {loadingBreakdown ? (
              <DashboardLoadingBlock
                heightClass="h-80"
                title="Memuat komposisi hazard..."
                description="Proporsi loss antar hazard sedang dihitung."
              />
            ) : errorBreakdown ? (
              <div className="flex h-80 w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-sm text-red-600">
                {errorBreakdown}
              </div>
            ) : !hasBreakdownData ? (
              <DashboardEmptyState
                message="Belum ada komposisi hazard yang cukup untuk ditampilkan pada chart ini."
                actionHint="Pastikan layer output tersedia untuk scenario dan climate aktif."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={breakdownWithPercent}
                    dataKey="totalValue"
                    nameKey="hazard"
                    outerRadius={105}
                    innerRadius={55}
                    paddingAngle={3}
                  >
                    {breakdownWithPercent.map((entry) => (
                      <Cell key={entry.hazard} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {loadingBreakdown
              ? Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="animate-pulse rounded-2xl border border-gray-200 bg-white px-4 py-3"
                  >
                    <div className="h-4 w-20 rounded bg-gray-200" />
                    <div className="mt-3 h-4 w-28 rounded bg-gray-200" />
                    <div className="mt-2 h-4 w-16 rounded bg-gray-200" />
                  </div>
                ))
              : !hasBreakdownData
                ? null
                : breakdownWithPercent.map((item) => (
                    <div
                      key={item.hazard}
                      className="rounded-2xl border border-gray-200 bg-white px-4 py-3"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-sm"
                          style={{ backgroundColor: item.fill }}
                        />
                        <p className="text-sm font-medium text-gray-900">
                          {item.hazard}
                        </p>
                      </div>
                      <p className="mt-2 text-sm text-gray-600">
                        {formatRupiah(item.totalValue)}
                      </p>
                      <p className="mt-1 text-xs text-gray-500">
                        {formatPercent(item.percent)} dari total
                      </p>
                    </div>
                  ))}
          </div>
        </div>
      </div>
    </div>
  );
}