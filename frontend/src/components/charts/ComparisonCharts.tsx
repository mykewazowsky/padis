"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ResponsiveContainer } from "recharts";
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
  runId?: number;
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
  const h = hazard.toLowerCase().replace(/[-\s]/g, "");
  if (h === "flood") return "Flood";
  if (h === "drought") return "Drought";
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

// ─── Dumbbell Chart ───────────────────────────────────────────────────────────

type DumbbellRow = { [key: string]: string | number };

function DumbbellChart({
  data,
  categoryKey,
  tooltipLabelPrefix,
  width = 400,
  height = 300,
}: {
  data: DumbbellRow[];
  categoryKey: string;
  tooltipLabelPrefix: string;
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<{
    row: DumbbellRow;
    px: number;
    py: number;
  } | null>(null);

  const W_NUM = Math.max(Number(width), 100);
  const H_NUM = Math.max(Number(height), 60);

  const MARGIN = { top: 32, right: 32, bottom: 36, left: 110 };
  const CW = Math.max(W_NUM - MARGIN.left - MARGIN.right, 10);
  const CH = Math.max(H_NUM - MARGIN.top - MARGIN.bottom, 10);

  const n = data.length;
  const rowH = n > 0 ? CH / n : 40;
  const DOT_R = 7;

  const allVals = data.flatMap((d) => [
    Number(d.nonclimate ?? 0),
    Number(d.climate ?? 0),
  ]);
  const maxVal = Math.max(...allVals, 1);
  const xScale = (v: number) => (v / maxVal) * CW;

  const TICK_COUNT = 4;
  const ticks = Array.from(
    { length: TICK_COUNT + 1 },
    (_, i) => (maxVal * i) / TICK_COUNT
  );

  const TOOLTIP_W = 220;
  const tooltipLeft = hovered
    ? hovered.px + 14 + TOOLTIP_W > W_NUM
      ? hovered.px - TOOLTIP_W - 14
      : hovered.px + 14
    : 0;

  return (
    <div style={{ position: "relative", width: W_NUM, height: H_NUM }}>
      <svg
        ref={svgRef}
        width={W_NUM}
        height={H_NUM}
        onMouseLeave={() => setHovered(null)}
      >
        {/* Legend */}
        <g transform={`translate(${MARGIN.left}, 10)`}>
          <circle cx={0} cy={6} r={5} fill={NONCLIMATE_COLOR} />
          <text
            x={10}
            y={6}
            dominantBaseline="middle"
            fontSize={11}
            fill="#374151"
            fontFamily="inherit"
          >
            Non-Climate
          </text>
          <circle cx={102} cy={6} r={5} fill={CLIMATE_COLOR} />
          <text
            x={112}
            y={6}
            dominantBaseline="middle"
            fontSize={11}
            fill="#374151"
            fontFamily="inherit"
          >
            Climate
          </text>
        </g>

        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          {/* Vertical grid lines */}
          {ticks.map((t, i) => (
            <line
              key={i}
              x1={xScale(t)}
              x2={xScale(t)}
              y1={0}
              y2={CH}
              stroke="#e5e7eb"
              strokeDasharray="3 3"
            />
          ))}

          {/* Data rows */}
          {data.map((row, i) => {
            const cy = rowH * i + rowH / 2;
            const xNC = xScale(Number(row.nonclimate ?? 0));
            const xCC = xScale(Number(row.climate ?? 0));
            const label = String(row[categoryKey] ?? "");
            const lineX1 = Math.min(xNC, xCC);
            const lineX2 = Math.max(xNC, xCC);

            return (
              <g
                key={i}
                onMouseMove={(e) => {
                  const rect = svgRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  setHovered({
                    row,
                    px: e.clientX - rect.left,
                    py: e.clientY - rect.top,
                  });
                }}
                style={{ cursor: "pointer" }}
              >
                {/* Category label */}
                <text
                  x={-10}
                  y={cy}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fill="#374151"
                  fontSize={12}
                  fontFamily="inherit"
                >
                  {label}
                </text>

                {/* Connecting line */}
                <line
                  x1={lineX1}
                  x2={lineX2}
                  y1={cy}
                  y2={cy}
                  stroke="#d1d5db"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />

                {/* Nonclimate dot */}
                <circle
                  cx={xNC}
                  cy={cy}
                  r={DOT_R}
                  fill={NONCLIMATE_COLOR}
                  stroke="white"
                  strokeWidth={2}
                />

                {/* Climate dot */}
                <circle
                  cx={xCC}
                  cy={cy}
                  r={DOT_R}
                  fill={CLIMATE_COLOR}
                  stroke="white"
                  strokeWidth={2}
                />
              </g>
            );
          })}

          {/* X axis line */}
          <line x1={0} x2={CW} y1={CH} y2={CH} stroke="#d1d5db" />

          {/* X axis ticks + labels */}
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={xScale(t)}
                x2={xScale(t)}
                y1={CH}
                y2={CH + 5}
                stroke="#d1d5db"
              />
              <text
                x={xScale(t)}
                y={CH + 18}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={11}
                fontFamily="inherit"
              >
                {formatCompact(t)}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Hover tooltip */}
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-lg"
          style={{
            left: tooltipLeft,
            top: Math.max(4, hovered.py - 44),
            width: TOOLTIP_W,
          }}
        >
          <p className="text-xs font-semibold tracking-wide text-gray-500">
            {tooltipLabelPrefix}: {String(hovered.row[categoryKey] ?? "")}
          </p>
          <div className="mt-2 space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: NONCLIMATE_COLOR }}
              />
              <span className="text-gray-700">
                Non-Climate:{" "}
                <span className="font-semibold text-gray-900">
                  {formatRupiah(Number(hovered.row.nonclimate ?? 0))}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: CLIMATE_COLOR }}
              />
              <span className="text-gray-700">
                Climate:{" "}
                <span className="font-semibold text-gray-900">
                  {formatRupiah(Number(hovered.row.climate ?? 0))}
                </span>
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComparisonCharts({ hazard, runId }: Props) {
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

    fetchJson<AalAllHazardsItem[]>(
      `/api/aal-summary-all-hazards${runId != null ? `?run_id=${runId}` : ""}`
    )
      .then((json) => setAalAllHazards(json))
      .catch((err) => {
        console.error("AAL all hazards fetch error:", err);
        setErrorAAL("Gagal memuat perbandingan AAL antar hazard.");
        setAalAllHazards([]);
      })
      .finally(() => setLoadingAAL(false));
  }, [runId]);

  useEffect(() => {
    setLoadingLoss(true);
    setErrorLoss(null);

    fetchJson<LossCompareClimateItem[]>(
      `/api/loss-summary-compare-climate?hazard=${hazard}${runId != null ? `&run_id=${runId}` : ""}`
    )
      .then((json) => setLossCompareClimate(json))
      .catch((err) => {
        console.error("Loss compare climate fetch error:", err);
        setErrorLoss("Gagal memuat perbandingan total loss climate vs non-climate.");
        setLossCompareClimate([]);
      })
      .finally(() => setLoadingLoss(false));
  }, [hazard, runId]);

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
      {/* ── AAL Antar Hazard ── */}
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
              <div className="animate-pulse space-y-2">
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
                <DumbbellChart
                  data={aalChartData}
                  categoryKey="hazard"
                  tooltipLabelPrefix="Hazard"
                />
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Total Loss per Scenario ── */}
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
              <div className="animate-pulse space-y-2">
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
                <DumbbellChart
                  data={lossCompareClimate}
                  categoryKey="scenario"
                  tooltipLabelPrefix="Scenario"
                />
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
