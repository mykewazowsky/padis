"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
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
import { useChartTheme } from "./chartTheme";

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
  if (h === "flood") return "Banjir";
  if (h === "drought") return "Kekeringan";
  return "Multi-hazard";
}

function formatPercentChange(climateValue: number, nonclimateValue: number) {
  if (!nonclimateValue || nonclimateValue === 0) {
    return {
      label: "N/A",
      colorClass: "text-muted",
      description: "Perubahan belum dapat dihitung.",
      isUp: false,
      delta: 0,
    };
  }

  const change = ((climateValue - nonclimateValue) / nonclimateValue) * 100;
  const isUp = change >= 0;

  return {
    label: `${isUp ? "+" : "-"}${Math.abs(change).toFixed(1)}%`,
    colorClass: isUp
      ? "text-[var(--dashboard-status-danger-text)]"
      : "text-[var(--dashboard-status-success-text)]",
    description: isUp
      ? "Nilai climate lebih tinggi dibanding non-climate."
      : "Nilai climate lebih rendah dibanding non-climate.",
    isUp,
    delta: climateValue - nonclimateValue,
  };
}

const NONCLIMATE_COLOR = "var(--color-primary)";
const CLIMATE_COLOR = "var(--color-secondary)";

const HAZARD_COLORS: Record<string, string> = {
  Banjir: "#3b82f6",
  Kekeringan: "#f97316",
  "Multi-hazard": "#a855f7",
};

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
const STATUS_BADGE_CLASS =
  "shrink-0 border-l border-[var(--dashboard-border-solid)] pl-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--dashboard-text-soft)]";
const PRIMARY_ICON_CLASS =
  "text-[var(--color-primary)]";
const WARNING_ICON_CLASS =
  "text-[var(--color-secondary-dark)]";

// ─── Custom Shapes ────────────────────────────────────────────────────────────

function HazardDot({
  cx = 0,
  cy = 0,
  fill = "#8884d8",
  payload,
}: {
  cx?: number;
  cy?: number;
  fill?: string;
  payload?: ScatterPoint;
}) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={fill} stroke="var(--chart-tooltip-bg)" strokeWidth={2} />
      <text
        x={cx}
        y={cy - 13}
        textAnchor="middle"
        fontSize={11}
        fill={fill}
        fontWeight={600}
        fontFamily="inherit"
      >
        {payload?.name}
      </text>
    </g>
  );
}

// ─── Custom Tooltips ──────────────────────────────────────────────────────────

type ScatterPoint = { x: number; y: number; name: string };

function ScatterTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: ScatterPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-3.5 py-3 shadow-[var(--chart-tooltip-shadow)]">
      <p className="text-xs font-semibold tracking-wide text-[var(--chart-tooltip-muted)]">
        {d.name}
      </p>
      <div className="mt-2 space-y-1">
        <div className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: NONCLIMATE_COLOR }}
          />
          <span className="text-[var(--chart-tooltip-muted)]">
            Non-Climate:{" "}
            <span className="font-semibold text-[var(--chart-tooltip-text)]">
              {formatRupiah(d.x)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ backgroundColor: CLIMATE_COLOR }}
          />
          <span className="text-[var(--chart-tooltip-muted)]">
            Climate:{" "}
            <span className="font-semibold text-[var(--chart-tooltip-text)]">
              {formatRupiah(d.y)}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function LineTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--chart-tooltip-border)] bg-[var(--chart-tooltip-bg)] px-3.5 py-3 shadow-[var(--chart-tooltip-shadow)]">
      <p className="text-xs font-semibold tracking-wide text-[var(--chart-tooltip-muted)]">
        {String(label ?? "").toUpperCase()}
      </p>
      <div className="mt-2 space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-[var(--chart-tooltip-muted)]">
              {entry.name === "nonclimate" ? "Non-Climate" : "Climate"}:{" "}
              <span className="font-semibold text-[var(--chart-tooltip-text)]">
                {formatRupiah(Number(entry.value))}
              </span>
            </span>
          </div>
        ))}
      </div>
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
  const chartTheme = useChartTheme();

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
        setErrorLoss(
          "Gagal memuat perbandingan total loss climate vs non-climate."
        );
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

  const scatterData = useMemo<ScatterPoint[]>(() => {
    return aalChartData.map((d) => ({
      x: d.nonclimate,
      y: d.climate,
      name: d.hazard,
    }));
  }, [aalChartData]);

  const scatterDomain = useMemo((): [number, number] => {
    const vals = aalChartData.flatMap((d) => [d.nonclimate, d.climate]);
    if (!vals.length || Math.max(...vals) === 0) return [0, 1];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min || max * 0.1) * 0.2;
    return [Math.max(0, min - pad), max + pad];
  }, [aalChartData]);

  const sortedLossData = useMemo(() => {
    const rpNum = (s: string) => parseInt(s.replace(/\D/g, ""), 10) || 0;
    return [...lossCompareClimate].sort(
      (a, b) => rpNum(a.scenario) - rpNum(b.scenario)
    );
  }, [lossCompareClimate]);

  const lossYDomain = useMemo((): [number, number] => {
    if (!sortedLossData.length) return [0, 1];
    const vals = sortedLossData.flatMap((d) => [
      safeNumber(d.nonclimate),
      safeNumber(d.climate),
    ]);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = (max - min || 1) * 0.12;
    return [Math.max(0, min - pad), max + pad];
  }, [sortedLossData]);

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
          colorClass: "text-muted",
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
          colorClass: "text-muted",
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
      {/* ── AAL Antar Hazard — Scatter Comparison ── */}
      <div className={CHART_CARD_CLASS}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={PRIMARY_ICON_CLASS}>
                  <ArrowRightLeft className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <h4 className="text-base font-bold tracking-tight text-heading">
                  AAL Antar Hazard
                </h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                Perbandingan AAL Non-Climate dan Climate untuk Banjir, Kekeringan,
                dan Multi-hazard.
              </p>
            </div>

            {!loadingAAL && !errorAAL && hasAALData ? (
              <div className={STATUS_BADGE_CLASS}>
                All Hazards
              </div>
            ) : null}
          </div>

          <div className={METRIC_RAIL_CLASS}>
            <div className={METRIC_CELL_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Hazard Tertinggi
              </p>
              <p className="text-sm font-semibold text-heading">
                {loadingAAL ? "Loading..." : topAalHazard.hazardLabel}
              </p>
            </div>

            <div className={METRIC_CELL_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Nilai Tertinggi
              </p>
              <p className="text-sm font-semibold text-heading">
                {loadingAAL
                  ? "Loading..."
                  : formatRupiah(
                      Math.max(topAalHazard.value, topAalHazard.climateValue)
                    )}
              </p>
            </div>
          </div>

          <div className={INSIGHT_ROW_CLASS}>
            {loadingAAL ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-40 rounded bg-[var(--color-border)]" />
                <div className="h-4 w-52 rounded bg-[var(--color-border)]" />
              </div>
            ) : errorAAL ? (
              <p className="text-sm text-[var(--dashboard-status-danger-text)]">{errorAAL}</p>
            ) : !hasAALData ? (
              <p className="text-sm text-muted">
                Belum ada data AAL antar hazard yang dapat divisualisasikan.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 text-[var(--color-primary)]">
                  {topAalHazard.changeInfo.isUp ? (
                    <TrendingUp className="h-4 w-4 text-[var(--dashboard-status-danger-text)]" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-[var(--dashboard-status-success-text)]" />
                  )}
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${topAalHazard.changeInfo.colorClass}`}
                  >
                    {topAalHazard.hazardLabel}: {topAalHazard.changeInfo.label}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {topAalHazard.changeInfo.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={CHART_CANVAS_CLASS}>
            {loadingAAL ? (
              <DashboardLoadingBlock
                heightClass="h-full"
                title="Memuat AAL lintas hazard..."
                description="Ringkasan AAL antar hazard sedang disiapkan."
              />
            ) : errorAAL ? (
              <div className={ERROR_CANVAS_CLASS}>
                {errorAAL}
              </div>
            ) : !hasAALData ? (
              <DashboardEmptyState
                message="Belum ada nilai AAL antar hazard yang cukup untuk ditampilkan pada chart ini."
                actionHint="Pastikan file AAL banjir, kekeringan, dan multi tersedia."
                compact
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart
                  margin={{ top: 10, right: 30, bottom: 50, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name="Non-Climate"
                    tickFormatter={formatCompact}
                    domain={scatterDomain}
                    tick={{ fontSize: 11, fill: chartTheme.axis }}
                    label={{
                      value: "Non-Climate (Rp)",
                      position: "insideBottom",
                      offset: -25,
                      fontSize: 11,
                      fill: chartTheme.axis,
                    }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name="Climate"
                    tickFormatter={formatCompact}
                    domain={scatterDomain}
                    width={72}
                    tick={{ fontSize: 11, fill: chartTheme.axis }}
                    label={{
                      value: "Climate (Rp)",
                      angle: -90,
                      position: "insideLeft",
                      offset: 20,
                      fontSize: 11,
                      fill: chartTheme.axis,
                    }}
                  />
                  <Tooltip content={<ScatterTooltip />} />
                  <ReferenceLine
                    segment={[
                      { x: scatterDomain[0], y: scatterDomain[0] },
                      { x: scatterDomain[1], y: scatterDomain[1] },
                    ]}
                    stroke={chartTheme.reference}
                    strokeDasharray="5 5"
                    strokeWidth={1.5}
                    label={{
                      value: "y = x",
                      position: "insideTopRight",
                      fontSize: 10,
                      fill: chartTheme.reference,
                    }}
                  />
                  {scatterData.map((point) => (
                    <Scatter
                      key={point.name}
                      name={point.name}
                      data={[point]}
                      fill={HAZARD_COLORS[point.name] ?? "#8884d8"}
                      shape={HazardDot}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* ── Total Loss per Scenario — Line Chart ── */}
      <div className={CHART_CARD_CLASS}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className={WARNING_ICON_CLASS}>
                  <BarChart3 className="h-4 w-4 text-[var(--color-secondary-dark)]" />
                </div>
                <h4 className="text-base font-bold tracking-tight text-heading">
                  Total Loss per Scenario
                </h4>
              </div>
              <p className="mt-2 text-sm text-muted">
                Perbandingan Non-Climate dan Climate untuk hazard{" "}
                {getHazardLabel(hazard)} pada semua scenario.
              </p>
            </div>

            <div className={STATUS_BADGE_CLASS}>
              {getHazardLabel(hazard)}
            </div>
          </div>

          <div className={METRIC_RAIL_CLASS}>
            <div className={METRIC_CELL_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Scenario Tertinggi
              </p>
              <p className="text-sm font-semibold text-heading">
                {loadingLoss ? "Loading..." : lossInsight.topScenario}
              </p>
            </div>

            <div className={METRIC_CELL_CLASS}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                Total Loss Tertinggi
              </p>
              <p className="text-sm font-semibold text-heading">
                {loadingLoss
                  ? "Loading..."
                  : formatRupiah(lossInsight.topValue)}
              </p>
            </div>
          </div>

          <div className={INSIGHT_ROW_CLASS}>
            {loadingLoss ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 w-36 rounded bg-[var(--color-border)]" />
                <div className="h-4 w-52 rounded bg-[var(--color-border)]" />
              </div>
            ) : errorLoss ? (
              <p className="text-sm text-[var(--dashboard-status-danger-text)]">{errorLoss}</p>
            ) : !hasLossData ? (
              <p className="text-sm text-muted">
                Belum ada total kerugian per scenario yang dapat dianalisis.
              </p>
            ) : (
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0 text-[var(--color-primary)]">
                  <CloudSun className="h-4 w-4 text-[var(--color-primary)]" />
                </div>
                <div>
                  <p
                    className={`text-sm font-semibold ${lossInsight.compareInfo.colorClass}`}
                  >
                    Total climate vs non-climate:{" "}
                    {lossInsight.compareInfo.label}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {lossInsight.compareInfo.description}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className={CHART_CANVAS_CLASS}>
            {loadingLoss ? (
              <DashboardLoadingBlock
                heightClass="h-full"
                title="Memuat perbandingan total kerugian..."
                description="Ringkasan kerugian climate vs non-climate sedang disiapkan."
              />
            ) : errorLoss ? (
              <div className={ERROR_CANVAS_CLASS}>
                {errorLoss}
              </div>
            ) : !hasLossData ? (
              <DashboardEmptyState
                message="Belum ada total kerugian per scenario yang dapat ditampilkan untuk hazard ini."
                actionHint="Pastikan layer web output tersedia untuk semua scenario."
                compact
              />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={sortedLossData}
                  margin={{ top: 10, right: 20, bottom: 10, left: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="scenario"
                    tickFormatter={(v: string) => v.toUpperCase()}
                    tick={{ fontSize: 12, fill: chartTheme.axis }}
                  />
                  <YAxis
                    tickFormatter={formatCompact}
                    domain={lossYDomain}
                    width={72}
                    tick={{ fontSize: 11, fill: chartTheme.axis }}
                  />
                  <Tooltip content={<LineTooltip />} />
                  <Legend
                    wrapperStyle={{ color: chartTheme.axis, fontSize: 12 }}
                    formatter={(value: string) =>
                      value === "nonclimate" ? "Non-Climate" : "Climate"
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="nonclimate"
                    name="nonclimate"
                    stroke={NONCLIMATE_COLOR}
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: NONCLIMATE_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 7 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="climate"
                    name="climate"
                    stroke={CLIMATE_COLOR}
                    strokeWidth={2.5}
                    dot={{ r: 5, fill: CLIMATE_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
