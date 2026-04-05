"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import {
  ArrowRightLeft,
  BarChart3,
  CloudSun,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { fetchJson } from "../../lib/fetcher";
import DashboardLoadingBlock from "../dashboard/DashboardLoadingBlock";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";

type Props = {
  hazard: string;
};

type AalAllHazardsItem = {
  hazard: string;
  total_aal_nonclimate: number;
  total_aal_climate: number;
};

type LossCompareClimateItem = {
  scenario: string;
  nonclimate: number;
  climate: number;
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

function formatPercentChange(climateValue: number, nonclimateValue: number) {
  if (!nonclimateValue || nonclimateValue === 0) {
    return {
      label: "N/A",
      colorClass: "text-gray-500",
      description: "Perubahan belum dapat dihitung.",
      isUp: false,
      delta: 0,
    };
  }

  const change = ((climateValue - nonclimateValue) / nonclimateValue) * 100;
  const isUp = change >= 0;

  return {
    label: `${isUp ? "+" : "-"}${Math.abs(change).toFixed(1)}%`,
    colorClass: isUp ? "text-red-600" : "text-green-600",
    description: isUp
      ? "Nilai climate lebih tinggi dibanding non-climate."
      : "Nilai climate lebih rendah dibanding non-climate.",
    isUp,
    delta: climateValue - nonclimateValue,
  };
}

const NONCLIMATE_COLOR = "var(--color-primary)";
const CLIMATE_COLOR = "var(--color-secondary)";

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

  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg">
      <p className="text-xs font-semibold tracking-wide text-gray-500">
        {labelPrefix}: {label}
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

export default function ComparisonCharts({ hazard }: Props) {
  const [aalAllHazards, setAalAllHazards] = useState<AalAllHazardsItem[]>([]);
  const [lossCompareClimate, setLossCompareClimate] = useState<
    LossCompareClimateItem[]
  >([]);

  const [loadingAAL, setLoadingAAL] = useState(false);
  const [loadingLoss, setLoadingLoss] = useState(false);

  const [errorAAL, setErrorAAL] = useState<string | null>(null);
  const [errorLoss, setErrorLoss] = useState<string | null>(null);

  useEffect(() => {
    setLoadingAAL(true);
    setErrorAAL(null);

    fetchJson<AalAllHazardsItem[]>("/api/aal-summary-all-hazards")
      .then((json) => setAalAllHazards(json))
      .catch((err) => {
        console.error("AAL all hazards fetch error:", err);
        setErrorAAL("Gagal memuat perbandingan AAL antar hazard.");
        setAalAllHazards([]);
      })
      .finally(() => setLoadingAAL(false));
  }, []);

  useEffect(() => {
    setLoadingLoss(true);
    setErrorLoss(null);

    fetchJson<LossCompareClimateItem[]>(
      `/api/loss-summary-compare-climate?hazard=${hazard}`
    )
      .then((json) => setLossCompareClimate(json))
      .catch((err) => {
        console.error("Loss compare climate fetch error:", err);
        setErrorLoss("Gagal memuat perbandingan total loss climate vs non-climate.");
        setLossCompareClimate([]);
      })
      .finally(() => setLoadingLoss(false));
  }, [hazard]);

  const aalChartData = useMemo(() => {
    return aalAllHazards.map((item) => ({
      hazard: getHazardLabel(item.hazard),
      nonclimate: safeNumber(item.total_aal_nonclimate),
      climate: safeNumber(item.total_aal_climate),
    }));
  }, [aalAllHazards]);

  const hasAALData = useMemo(() => {
    return aalChartData.some(
      (item) => safeNumber(item.nonclimate) > 0 || safeNumber(item.climate) > 0
    );
  }, [aalChartData]);

  const topAalHazard = useMemo(() => {
    if (!aalAllHazards.length) {
      return {
        hazardLabel: "-",
        value: 0,
        climateValue: 0,
        changeInfo: {
          label: "N/A",
          colorClass: "text-gray-500",
          description: "Perubahan belum dapat dihitung.",
          isUp: false,
          delta: 0,
        },
      };
    }

    const ranked = [...aalAllHazards].sort((a, b) => {
      const aMax = Math.max(
        safeNumber(a.total_aal_nonclimate),
        safeNumber(a.total_aal_climate)
      );
      const bMax = Math.max(
        safeNumber(b.total_aal_nonclimate),
        safeNumber(b.total_aal_climate)
      );
      return bMax - aMax;
    });

    const top = ranked[0];
    const changeInfo = formatPercentChange(
      safeNumber(top.total_aal_climate),
      safeNumber(top.total_aal_nonclimate)
    );

    return {
      hazardLabel: getHazardLabel(top.hazard),
      value: safeNumber(top.total_aal_nonclimate),
      climateValue: safeNumber(top.total_aal_climate),
      changeInfo,
    };
  }, [aalAllHazards]);

  const hasLossData = useMemo(() => {
    return lossCompareClimate.some(
      (item) =>
        safeNumber(item.nonclimate) > 0 || safeNumber(item.climate) > 0
    );
  }, [lossCompareClimate]);

  const lossInsight = useMemo(() => {
    if (!lossCompareClimate.length) {
      return {
        topScenario: "-",
        topValue: 0,
        nonclimateTotal: 0,
        climateTotal: 0,
        compareInfo: {
          label: "N/A",
          colorClass: "text-gray-500",
          description: "Perubahan belum dapat dihitung.",
          isUp: false,
          delta: 0,
        },
      };
    }

    const ranked = [...lossCompareClimate].sort((a, b) => {
      const aMax = Math.max(safeNumber(a.nonclimate), safeNumber(a.climate));
      const bMax = Math.max(safeNumber(b.nonclimate), safeNumber(b.climate));
      return bMax - aMax;
    });

    const top = ranked[0];

    const nonclimateTotal = lossCompareClimate.reduce(
      (sum, item) => sum + safeNumber(item.nonclimate),
      0
    );
    const climateTotal = lossCompareClimate.reduce(
      (sum, item) => sum + safeNumber(item.climate),
      0
    );

    const compareInfo = formatPercentChange(climateTotal, nonclimateTotal);

    return {
      topScenario: top?.scenario ?? "-",
      topValue: Math.max(
        safeNumber(top?.nonclimate),
        safeNumber(top?.climate)
      ),
      nonclimateTotal,
      climateTotal,
      compareInfo,
    };
  }, [lossCompareClimate]);

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <div className="card card-accent-primary p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[var(--color-primary-soft)] p-2">
                  <ArrowRightLeft className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <h4 className="text-lg font-bold tracking-tight text-gray-900">
                  AAL Antar Hazard
                </h4>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Perbandingan AAL Non-Climate dan Climate untuk Flood, Drought,
                dan Multi-hazard.
              </p>
            </div>

            {!loadingAAL && !errorAAL && hasAALData ? (
              <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
                All Hazards
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Hazard Tertinggi
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {loadingAAL ? "Loading..." : topAalHazard.hazardLabel}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Nilai Tertinggi
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {loadingAAL
                  ? "Loading..."
                  : formatRupiah(
                      Math.max(topAalHazard.value, topAalHazard.climateValue)
                    )}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            {loadingAAL ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-40 rounded bg-gray-200" />
                <div className="h-4 w-52 rounded bg-gray-200" />
              </div>
            ) : errorAAL ? (
              <p className="text-sm text-red-600">{errorAAL}</p>
            ) : !hasAALData ? (
              <p className="text-sm text-gray-500">
                Belum ada data AAL antar hazard yang dapat divisualisasikan.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  {topAalHazard.changeInfo.isUp ? (
                    <TrendingUp className="h-4 w-4 text-red-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-green-600" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${topAalHazard.changeInfo.colorClass}`}
                  >
                    {topAalHazard.hazardLabel}: {topAalHazard.changeInfo.label}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {topAalHazard.changeInfo.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="h-80 w-full">
            {loadingAAL ? (
              <DashboardLoadingBlock
                heightClass="h-80"
                title="Memuat AAL lintas hazard..."
                description="Ringkasan AAL antar hazard sedang disiapkan."
              />
            ) : errorAAL ? (
              <div className="flex h-80 w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-sm text-red-600">
                {errorAAL}
              </div>
            ) : !hasAALData ? (
              <DashboardEmptyState
                message="Belum ada nilai AAL antar hazard yang cukup untuk ditampilkan pada chart ini."
                actionHint="Pastikan file AAL flood, drought, dan multi tersedia."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={aalChartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="hazard"
                    tick={{ fill: "#374151", fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCompact(safeNumber(value))}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip labelPrefix="Hazard" />} />
                  <Legend />
                  <Bar
                    dataKey="nonclimate"
                    name="Non-Climate"
                    fill={NONCLIMATE_COLOR}
                    radius={[10, 10, 0, 0]}
                  />
                  <Bar
                    dataKey="climate"
                    name="Climate"
                    fill={CLIMATE_COLOR}
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      <div className="card card-accent-secondary p-5 md:p-6">
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-[var(--color-secondary-soft)] p-2">
                  <BarChart3 className="h-4 w-4 text-[var(--color-secondary-dark)]" />
                </div>
                <h4 className="text-lg font-bold tracking-tight text-gray-900">
                  Total Loss per Scenario
                </h4>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                Perbandingan Non-Climate dan Climate untuk hazard{" "}
                {getHazardLabel(hazard)} pada semua scenario.
              </p>
            </div>

            <div className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700">
              {getHazardLabel(hazard)}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Scenario Tertinggi
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {loadingLoss ? "Loading..." : lossInsight.topScenario}
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total Loss Tertinggi
              </p>
              <p className="mt-2 text-lg font-bold text-gray-900">
                {loadingLoss ? "Loading..." : formatRupiah(lossInsight.topValue)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
            {loadingLoss ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-4 w-36 rounded bg-gray-200" />
                <div className="h-4 w-52 rounded bg-gray-200" />
              </div>
            ) : errorLoss ? (
              <p className="text-sm text-red-600">{errorLoss}</p>
            ) : !hasLossData ? (
              <p className="text-sm text-gray-500">
                Belum ada total loss per scenario yang dapat dianalisis.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-white p-2 shadow-sm">
                  <CloudSun className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${lossInsight.compareInfo.colorClass}`}
                  >
                    Total climate vs non-climate: {lossInsight.compareInfo.label}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">
                    {lossInsight.compareInfo.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="h-80 w-full">
            {loadingLoss ? (
              <DashboardLoadingBlock
                heightClass="h-80"
                title="Memuat perbandingan total loss..."
                description="Ringkasan loss climate vs non-climate sedang disiapkan."
              />
            ) : errorLoss ? (
              <div className="flex h-80 w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-sm text-red-600">
                {errorLoss}
              </div>
            ) : !hasLossData ? (
              <DashboardEmptyState
                message="Belum ada total loss per scenario yang dapat ditampilkan untuk hazard ini."
                actionHint="Pastikan layer web output tersedia untuk semua scenario."
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={lossCompareClimate}
                  margin={{ top: 10, right: 10, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="scenario"
                    tick={{ fill: "#374151", fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(value) => formatCompact(safeNumber(value))}
                    tick={{ fill: "#6b7280", fontSize: 12 }}
                  />
                  <Tooltip content={<CustomTooltip labelPrefix="Scenario" />} />
                  <Legend />
                  <Bar
                    dataKey="nonclimate"
                    name="Non-Climate"
                    fill={NONCLIMATE_COLOR}
                    radius={[10, 10, 0, 0]}
                  />
                  <Bar
                    dataKey="climate"
                    name="Climate"
                    fill={CLIMATE_COLOR}
                    radius={[10, 10, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}