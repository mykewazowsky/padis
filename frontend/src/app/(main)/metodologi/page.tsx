"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Droplets,
  Leaf,
  Map as MapIcon,
  ArrowRight,
  Layers,
  Database,
  Info,
  History,
  TrendingUp,
  Loader2,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
  ReferenceLine,
} from "recharts";
import { useChartTheme } from "@/components/charts/chartTheme";
import { useLanguage } from "@/contexts/LanguageContext";

// -- Tipe Data --
interface HistoricalRecord {
  year: string;
  flood: number;
  drought: number;
}

const metadataRules = [
  {
    name: "Batas Administrasi",
    source: "Badan Informasi Geospasial (BIG), 2020",
    icon: MapIcon,
    iconColor: "text-blue-500",
    badgeColor: "border-[var(--content-border)] bg-[var(--content-surface-muted)] text-[var(--content-text)]",
    description:
      "Digunakan sebagai referensi spasial dasar untuk spatial join dan agregasi estimasi kerugian langsung & AAL hingga ke tingkat kabupaten/kota.",
    specs: [
      { label: "Tipe Geometri", value: "Vector Polygon" },
      { label: "Format File", value: ".SHP / .GeoJSON" },
      { label: "Atribut Kunci", value: "id_kabkota, kab_kota" },
      { label: "Sistem Referensi", value: "WGS 84 (EPSG:4326)" },
    ],
  },
  {
    name: "Penutupan Lahan Sawah",
    source: "Kementerian LHK, 2022",
    icon: Layers,
    iconColor: "text-emerald-500",
    badgeColor: "border-[var(--content-border)] bg-[var(--content-surface-muted)] text-[var(--content-text)]",
    description:
      "Layer spasial yang merepresentasikan penutupan lahan area persawahan. Digunakan untuk proses masking dan ekstraksi nilai hazard yang tumpang tindih (overlay).",
    specs: [
      { label: "Tipe Geometri", value: "Vector Polygon" },
      { label: "Skala Pemetaan", value: "1:250000" },
      { label: "Format File", value: ".SHP / .GPKG" },
      { label: "Validasi", value: "Clean Topology (No Self-Intersect)" },
    ],
  },
  {
    name: "Pemodelan Genangan Banjir",
    source: "ITB-BPDLH Project, 2025",
    icon: Droplets,
    iconColor: "text-cyan-500",
    badgeColor: "border-[var(--content-border)] bg-[var(--content-surface-muted)] text-[var(--content-text)]",
    description:
      "Layer raster hasil simulasi hidrodinamika 2D menggunakan HEC-RAS 2D Analysis yang berisi nilai ketinggian genangan (inundation depth) dalam satuan meter untuk diintegrasikan dengan kurva kerentanan.",
    specs: [
      { label: "Tipe Data", value: "Raster (.TIFF)" },
      { label: "Resolusi Spasial", value: "30 meter" },
      { label: "Skenario Baseline", value: "R25, R50, R100, R250" },
      { label: "Skenario Projection", value: "RC25, RC50, RC100, RC250" },
    ],
  },
  {
    name: "Indeks Kekeringan",
    source: "ITB-BPDLH Project, 2025",
    icon: Leaf,
    iconColor: "text-orange-500",
    badgeColor: "border-[var(--content-border)] bg-[var(--content-surface-muted)] text-[var(--content-text)]",
    description:
      "Layer raster nilai Standardized Precipitation Index yang merepresentasikan tingkat defisit curah hujan ekstrem berdasarkan observasi satelit dan proyeksi Multi-Model Ensemble.",
    specs: [
      { label: "Tipe Data", value: "Raster (.TIFF)" },
      { label: "Resolusi Spasial", value: "~11 Kilometer" },
      { label: "Skenario Baseline", value: "GPM25, GPM50, GPM100, GPM250" },
      { label: "Skenario Projection", value: "MME25, MME50, MME100, MME250" },
    ],
  },
];

function SectionHeader({
  title,
  desc,
  label,
  centered = true,
}: {
  title: string;
  desc?: string;
  label?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {label && <p className="section-eyebrow mb-3">{label}</p>}
      <h2 className="text-heading text-balance text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h2>
      {desc ? (
        <p className="text-muted mt-4 leading-relaxed md:text-lg">{desc}</p>
      ) : null}
    </div>
  );
}

// Formatter persen untuk kurva kerentanan
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export default function MetodologiPage() {
  const [histData, setHistData] = useState<HistoricalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const chartTheme = useChartTheme();
  const { t } = useLanguage();

  const formatYAxis = (tickItem: number) => {
    const value = Math.round(tickItem);
    if (value >= 1000000) return `${Math.round(value / 1000000)} ${t("metodologi.millionAbbr")}`;
    if (value >= 1000) return `${Math.round(value / 1000)} ${t("metodologi.thousandAbbr")}`;
    return value.toString();
  };

  const metadataRules = [
    {
      name: t("metodologi.adminBoundaryName"),
      source: t("metodologi.adminBoundarySource"),
      icon: MapIcon,
      iconColor: "text-blue-500",
      badgeColor: "border-[var(--content-border)] bg-[var(--content-surface-muted)] text-[var(--content-text)]",
      description: t("metodologi.adminBoundaryDesc"),
      specs: [
        { label: t("metodologi.specGeomType"), value: "Vector Polygon" },
        { label: t("metodologi.specFormat"), value: ".SHP / .GeoJSON" },
        { label: t("metodologi.specKeyAttr"), value: "id_kabkota, kab_kota" },
        { label: t("metodologi.specRefSystem"), value: "WGS 84 (EPSG:4326)" },
      ],
    },
    {
      name: t("metodologi.riceCoverName"),
      source: t("metodologi.riceCoverSource"),
      icon: Layers,
      iconColor: "text-emerald-500",
      badgeColor: "border-[var(--content-border)] bg-[var(--content-surface-muted)] text-[var(--content-text)]",
      description: t("metodologi.riceCoverDesc"),
      specs: [
        { label: t("metodologi.specGeomType"), value: "Vector Polygon" },
        { label: t("metodologi.specScale"), value: "1:250000" },
        { label: t("metodologi.specFormat"), value: ".SHP / .GPKG" },
        { label: t("metodologi.specValidation"), value: "Clean Topology (No Self-Intersect)" },
      ],
    },
    {
      name: t("metodologi.floodModelingName"),
      source: t("metodologi.floodModelingSource"),
      icon: Droplets,
      iconColor: "text-cyan-500",
      badgeColor: "border-[var(--content-border)] bg-[var(--content-surface-muted)] text-[var(--content-text)]",
      description: t("metodologi.floodModelingDesc"),
      specs: [
        { label: t("metodologi.specDataType"), value: "Raster (.TIFF)" },
        { label: t("metodologi.specSpatialRes"), value: "30 meter" },
        { label: t("metodologi.specBaselineScen"), value: "R25, R50, R100, R250" },
        { label: t("metodologi.specProjectionScen"), value: "RC25, RC50, RC100, RC250" },
      ],
    },
    {
      name: t("metodologi.droughtIndexName"),
      source: t("metodologi.droughtIndexSource"),
      icon: Leaf,
      iconColor: "text-orange-500",
      badgeColor: "border-[var(--content-border)] bg-[var(--content-surface-muted)] text-[var(--content-text)]",
      description: t("metodologi.droughtIndexDesc"),
      specs: [
        { label: t("metodologi.specDataType"), value: "Raster (.TIFF)" },
        { label: t("metodologi.specSpatialRes"), value: "~11 Kilometer" },
        { label: t("metodologi.specBaselineScen"), value: "GPM25, GPM50, GPM100, GPM250" },
        { label: t("metodologi.specProjectionScen"), value: "MME25, MME50, MME100, MME250" },
      ],
    },
  ];

  const floodCurveData = useMemo(() => {
    const data = [];
    for (let x = 0.2; x <= 1.9; x += 0.01) {
      const y = 0.52 + 0.29 * Math.log(x);
      data.push({
        x: Number(x.toFixed(2)),
        lop: Number(Math.max(0, Math.min(1, y)).toFixed(4)),
      });
    }
    return data;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncViewport = () => setIsMobile(mediaQuery.matches);

    syncViewport();
    mediaQuery.addEventListener("change", syncViewport);
    return () => mediaQuery.removeEventListener("change", syncViewport);
  }, []);

  const vulnerabilityTickStyle = {
    fill: chartTheme.axis,
    fontSize: isMobile ? 10 : 11,
  };

  const vulnerabilityChartMargin = isMobile
    ? { top: 8, right: 10, left: 6, bottom: 56 }
    : { top: 10, right: 20, left: 20, bottom: 10 };

  const vulnerabilityXAxisLabel = (
    value: string
  ): {
    value: string;
    position: "bottom" | "insideBottom";
    offset: number;
    style: { fill: string; fontSize: number };
  } => ({
    value,
    position: isMobile ? "bottom" : "insideBottom",
    offset: isMobile ? 16 : -5,
    style: {
      fill: chartTheme.axis,
      fontSize: isMobile ? 11 : 12,
    },
  });

  const droughtCurveData = useMemo(() => {
    const data = [];
    for (let x = 0.0; x <= 1.0; x += 0.01) {
      const y =
        -0.8381 * Math.pow(x, 3) +
        0.8967 * Math.pow(x, 2) +
        0.9064 * x -
        0.0106;

      data.push({
        x: Number(x.toFixed(2)),
        lop: Number(Math.max(0, Math.min(1, y)).toFixed(4)),
      });
    }
    return data;
  }, []);

  useEffect(() => {
    const fetchCSV = async () => {
      try {
        const resTahunan = await fetch(
          "/historis/data_historis_banjir_kekeringan_DIBI.csv"
        );
        const csvTahunan = await resTahunan.text();
        const linesTahunan = csvTahunan.trim().split("\n").slice(1);

        const parsedTahunan = linesTahunan.map((line) => {
          const delimiter = line.includes(";") ? ";" : ",";
          const [tahun, banjir, kekeringan] = line.split(delimiter);
          const fValue = Math.round(parseFloat(banjir) || 0);
          const dValue = Math.round(parseFloat(kekeringan) || 0);

          return {
            year: tahun?.trim() || "N/A",
            flood: fValue,
            drought: dValue,
          };
        });

        setHistData(parsedTahunan);
      } catch (error) {
        console.error("Gagal mengambil data CSV:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCSV();
  }, []);

  return (
    <div className="content-theme">
      {/* 1. HERO SECTION */}
      <section className="content-hero-gradient relative overflow-hidden text-white">
        <div className="content-hero-overlay" />
        <div className="hero-grid-overlay" />
        <div className="hero-orb hero-orb-primary -left-10 top-10 h-44 w-44" />
        <div className="hero-orb hero-orb-secondary right-0 top-0 h-56 w-56" />
        <div className="hero-orb hero-orb-soft bottom-0 left-1/3 h-36 w-36" />

        <div className="section-container relative py-16 lg:py-24 text-center">
          <div className="mx-auto max-w-4xl">
            <span className="badge badge-secondary">{t("metodologi.badge")}</span>

            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              {t("metodologi.title")}
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-[var(--content-hero-muted)] md:text-base">
              {t("metodologi.description")}
            </p>

            {/* Conceptual flow grid — 4 stages of the risk equation */}
            <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
              {[
                { label: t("metodologi.conceptHazard"), sub: t("metodologi.conceptHazardSub") },
                { label: t("metodologi.conceptExposure"), sub: t("metodologi.conceptExposureSub") },
                { label: t("metodologi.conceptVulnerability"), sub: t("metodologi.conceptVulnerabilitySub") },
                { label: t("metodologi.conceptLoss"), sub: t("metodologi.conceptLossSub") },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={`animate-fade-up rounded-2xl border px-4 py-3 ${
                    i === 3
                      ? "border-[var(--color-secondary)]/40 bg-[var(--color-secondary)]/10"
                      : "border-[var(--content-hero-glass-border)] bg-[var(--content-hero-glass-bg)]"
                  }`}
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${
                    i === 3 ? "text-[var(--color-secondary)]" : "text-[var(--content-hero-soft)]"
                  }`}>
                    {item.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-[var(--content-hero-muted)]/75">
                    {item.sub}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 2. BASELINE DATA (BENCANA & PRODUKSI) */}
      <section className="section-shell section-soft">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="text-heading text-balance text-3xl font-bold tracking-tight md:text-4xl">
                {t("metodologi.justificationTitle")}
              </h2>
              <p className="text-muted mt-4 leading-relaxed md:text-lg max-w-3xl mx-auto">
                {t("metodologi.justificationText")}
              </p>
            </div>

            <div className="card p-6 md:p-8">
              {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center text-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                  <p>{t("metodologi.loadingCsv")}</p>
                </div>
              ) : (
                <>
                  {/* GRAFIK 1: TREN BENCANA TAHUNAN */}
                  <div className="mb-10">
                    <h4 className="mb-4 text-lg font-bold text-heading flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-muted" />
                      {t("metodologi.historicalTitle")}
                    </h4>
                    <div className="chart-shell h-[350px] w-full p-4 pt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={histData}
                          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                        >
                          <defs>
                            <linearGradient id="gradFloodHist" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="gradDroughtHist" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#F97316" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke={chartTheme.grid}
                          />
                          <XAxis
                            dataKey="year"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: chartTheme.axis, fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: chartTheme.axis, fontSize: 11 }}
                            tickFormatter={formatYAxis}
                            width={65}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "12px",
                              backgroundColor: chartTheme.tooltipBg,
                              border: `1px solid ${chartTheme.tooltipBorder}`,
                              boxShadow: chartTheme.tooltipShadow,
                              color: chartTheme.tooltipText,
                            }}
                            itemStyle={{ color: chartTheme.tooltipText }}
                            labelStyle={{ color: chartTheme.tooltipMuted }}
                            formatter={(value: unknown, name: unknown) => [
                              Math.round(Number(value)),
                              name === t("metodologi.floodIncidentsLabel") ? t("charts.flood") : t("charts.drought"),
                            ]}
                            labelFormatter={(label) => `${t("metodologi.yearLabel")} ${label}`}
                          />
                          <Legend
                            iconType="circle"
                            wrapperStyle={{ color: chartTheme.axis, paddingTop: "20px" }}
                          />
                          <Area
                            name={t("metodologi.floodIncidentsLabel")}
                            type="monotone"
                            dataKey="flood"
                            stroke="#3B82F6"
                            strokeWidth={2.5}
                            fill="url(#gradFloodHist)"
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                          <Area
                            name={t("metodologi.droughtIncidentsLabel")}
                            type="monotone"
                            dataKey="drought"
                            stroke="#F97316"
                            strokeWidth={2.5}
                            fill="url(#gradDroughtHist)"
                            dot={false}
                            activeDot={{ r: 6, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* CARD PEMBOBOTAN MULTIHAZARD */}
                  <div className="mt-8 px-2 md:px-4">
                    <div className="mx-auto max-w-[1100px]">
                      <div className="mb-4 text-center">
                        <p className="section-eyebrow text-sm">{t("metodologi.weightingTitle")}</p>
                        <h4 className="mt-1 text-lg font-bold text-heading">
                          {t("metodologi.weightingSubtitle")}
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          {t("metodologi.weightingDesc")}
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* CARD BANJIR */}
                        <div className="panel-primary rounded-2xl p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                                {t("metodologi.hazardLabel")}
                              </p>
                              <h5 className="mt-1 text-xl font-bold text-heading">
                                {t("metodologi.floodLabel")}
                              </h5>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--content-surface)] shadow-sm">
                              <Droplets className="h-5 w-5 text-[var(--color-primary)]" />
                            </div>
                          </div>

                          <div className="surface-white mt-4 px-4 py-3">
                            <p className="section-eyebrow text-[11px]">{t("metodologi.finalWeightLabel")}</p>
                            <p className="mt-1 text-lg font-bold text-heading">
                              0.68
                            </p>
                          </div>

                          <p className="mt-3 text-sm leading-relaxed text-muted">
                            {t("metodologi.floodWeightDesc")}
                          </p>
                        </div>

                        {/* CARD KEKERINGAN */}
                        <div className="panel-secondary rounded-2xl p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary-dark)]">
                                {t("metodologi.hazardLabel")}
                              </p>
                              <h5 className="mt-1 text-xl font-bold text-heading">
                                {t("metodologi.droughtLabel")}
                              </h5>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--content-surface)] shadow-sm">
                              <Leaf className="h-5 w-5 text-[var(--color-secondary-dark)]" />
                            </div>
                          </div>

                          <div className="surface-white mt-4 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-secondary-dark)]">{t("metodologi.finalWeightLabel")}</p>
                            <p className="mt-1 text-lg font-bold text-heading">
                              0.32
                            </p>
                          </div>

                          <p className="mt-3 text-sm leading-relaxed text-muted">
                            {t("metodologi.droughtWeightDesc")}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. SKENARIO PROJECTION DAN BASELINE */}
      <section className="section-shell content-section">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="text-heading text-balance text-3xl font-bold tracking-tight md:text-4xl">
                {t("metodologi.scenariosTitle")}
              </h2>
              <p className="text-muted mt-4 leading-relaxed md:text-lg max-w-3xl mx-auto">
                {t("metodologi.scenariosDescPart1")}{" "}
                <strong className="text-heading">Projection</strong>{" "}
                {t("common.and")}{" "}
                <strong className="text-heading">Baseline</strong>{" "}
                {t("metodologi.scenariosDescPart2")} <em>raster hazard</em>
                {t("metodologi.scenariosDescPart3")}{" "}
                <strong className="text-heading">{t("metodologi.scenariosDescPart4")}</strong>{" "}
                {t("metodologi.scenariosDescPart5")}
              </p>
            </div>

            {/* Kartu perbandingan dua skenario */}
            <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
              {/* Baseline */}
              <div className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="section-eyebrow text-xs mb-1">{t("metodologi.scenarioEyebrow")}</p>
                    <h5 className="text-xl font-bold text-heading">
                      {t("metodologi.baselineLabel")}
                    </h5>
                    <p className="text-sm italic text-muted mt-0.5">
                      {t("metodologi.baselineSubtitle")}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--content-surface)] shadow-sm">
                    <History className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {t("metodologi.baselineDesc")}
                </p>
              </div>

              {/* vs divider */}
              <div className="hidden md:flex items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--content-surface)] text-[11px] font-bold text-muted shadow-sm">
                  {t("metodologi.vsLabel")}
                </span>
              </div>

              {/* Iklim */}
              <div className="card card-accent-secondary p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary-dark)] mb-1">
                      {t("metodologi.scenarioEyebrow")}
                    </p>
                    <h5 className="text-xl font-bold text-heading">{t("metodologi.projectionLabel")}</h5>
                    <p className="text-sm italic text-[var(--color-secondary-dark)] mt-0.5">
                      {t("metodologi.projectionSubtitle")}
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--content-surface)] shadow-sm">
                    <TrendingUp className="h-5 w-5 text-[var(--color-secondary-dark)]" />
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {t("metodologi.projectionDesc")}
                </p>
              </div>
            </div>

            {/* Info bersama: format raster + catatan alur risiko */}
            <div className="alert-info mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                    {t("metodologi.rasterFormatLabel")}
                  </p>
                  <div className="flex flex-col gap-1 text-sm">
                    <span>
                      <span className="font-medium text-blue-700">{t("metodologi.floodLabel")}</span>{" "}
                      {t("metodologi.floodValueDesc")}
                    </span>
                    <span>
                      <span className="font-medium text-orange-700">
                        {t("metodologi.droughtLabel")}
                      </span>{" "}
                      {t("metodologi.droughtValueDesc")}
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 shrink-0 text-muted mt-0.5" />
                  <p className="text-sm leading-relaxed text-muted">
                    {t("metodologi.processExplanation")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. KURVA KERENTANAN */}
      <section className="section-shell section-soft">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title={t("metodologi.vulnTitle")}
            desc={t("metodologi.vulnDesc")}
          />

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            {/* KURVA BANJIR */}
            <div className="card card-accent-primary flex flex-col p-8">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] shadow-sm">
                    <Droplets className="h-7 w-7 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-heading">
                      {t("metodologi.floodVulnTitle")}
                    </h3>
                    <a
                      href="https://www.scopus.com/pages/publications/85099980139?origin=resultslist"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted italic hover:text-[var(--color-primary)] hover:underline"
                    >
                      Hendrawan &amp; Komori (2021)
                    </a>
                  </div>
                </div>
              </div>

              <div className="mb-3 h-[360px] w-full overflow-hidden chart-shell p-3 sm:mb-6 sm:h-[320px] sm:p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={floodCurveData}
                    margin={vulnerabilityChartMargin}
                  >
                    <defs>
                      <linearGradient id="gradFloodCurve" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartTheme.grid}
                    />
                    <XAxis
                      dataKey="x"
                      axisLine={false}
                      tickLine={false}
                      tick={vulnerabilityTickStyle}
                      interval={isMobile ? 34 : 15}
                      tickMargin={isMobile ? 12 : 6}
                      angle={isMobile ? -32 : 0}
                      textAnchor={isMobile ? "end" : "middle"}
                      height={isMobile ? 60 : undefined}
                      label={vulnerabilityXAxisLabel(t("metodologi.floodXAxisLabel"))}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={vulnerabilityTickStyle}
                      domain={[0, 1]}
                      tickFormatter={formatPercent}
                      width={isMobile ? 44 : 60}
                    >
                      <Label
                        value={t("metodologi.lossOfProductivity")}
                        angle={-90}
                        position="insideLeft"
                        offset={10}
                        style={{
                          textAnchor: "middle",
                          fill: chartTheme.axis,
                          fontSize: 12,
                        }}
                      />
                    </YAxis>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        backgroundColor: chartTheme.tooltipBg,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        boxShadow: chartTheme.tooltipShadow,
                        color: chartTheme.tooltipText,
                      }}
                      itemStyle={{ color: chartTheme.tooltipText }}
                      labelStyle={{ color: chartTheme.tooltipMuted }}
                      formatter={(value: unknown) => [
                        formatPercent(Number(value)),
                        "Loss",
                      ]}
                      labelFormatter={(label) => `${t("metodologi.floodTooltipPrefix")}: ${label} m`}
                    />
                    <ReferenceLine
                      y={0.5}
                      stroke={chartTheme.grid}
                      strokeDasharray="5 3"
                      label={{
                        value: "50% LOP",
                        position: "insideTopRight",
                        fill: chartTheme.axis,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                    {!isMobile ? (
                      <Legend
                        verticalAlign="bottom"
                        iconType="plainline"
                        wrapperStyle={{ color: chartTheme.axis, paddingTop: "16px" }}
                      />
                    ) : null}
                    <Area
                      name={t("metodologi.floodVulnCurveName")}
                      type="monotone"
                      dataKey="lop"
                      stroke="#3B82F6"
                      strokeWidth={2.5}
                      fill="url(#gradFloodCurve)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mb-4 flex items-center gap-2 text-sm text-muted md:hidden">
                <span className="h-0.5 w-6 rounded-full bg-[#3B82F6]" />
                <span>{t("metodologi.floodCurveMobileLabel")}</span>
              </div>

              <div className="alert-info mt-auto">
                <p className="font-medium mb-2 flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4" /> {t("metodologi.formulationLabel")}
                </p>

                <p className="leading-relaxed text-sm">
                  {t("metodologi.floodCurveDesc")}
                </p>

                <div className="surface-white mt-3 rounded-lg px-4 py-3">
                  <p className="section-eyebrow text-[11px]">
                    {t("metodologi.floodFormulaTitle")}
                  </p>
                  <p className="mt-1 font-mono text-sm font-medium text-heading">
                    y = 0.52 + 0.29 ln(x)
                  </p>
                </div>

                <p className="mt-3 leading-relaxed text-sm">
                  {t("metodologi.floodFormulaExplain")}
                </p>
              </div>
            </div>

            {/* KURVA KEKERINGAN */}
            <div className="card card-accent-secondary flex flex-col p-8">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-secondary-soft)] shadow-sm">
                    <Leaf className="h-7 w-7 text-[var(--color-secondary-dark)]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-heading">
                      {t("metodologi.droughtVulnTitle")}
                    </h3>
                    <a
                      href="https://www.scopus.com/pages/publications/85090017371?origin=resultslist"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted italic hover:text-[var(--color-secondary-dark)] hover:underline"
                    >
                      Guo dkk. (2021)
                    </a>
                  </div>
                </div>
              </div>

              <div className="mb-3 h-[360px] w-full overflow-hidden chart-shell p-3 sm:mb-6 sm:h-[320px] sm:p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={droughtCurveData}
                    margin={vulnerabilityChartMargin}
                  >
                    <defs>
                      <linearGradient id="gradDroughtCurve" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke={chartTheme.grid}
                    />
                    <XAxis
                      dataKey="x"
                      axisLine={false}
                      tickLine={false}
                      tick={vulnerabilityTickStyle}
                      interval={isMobile ? 22 : 10}
                      tickMargin={isMobile ? 12 : 6}
                      angle={isMobile ? -32 : 0}
                      textAnchor={isMobile ? "end" : "middle"}
                      height={isMobile ? 60 : undefined}
                      label={vulnerabilityXAxisLabel(t("metodologi.droughtXAxisLabel"))}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={vulnerabilityTickStyle}
                      domain={[0, 1]}
                      tickFormatter={formatPercent}
                      width={isMobile ? 44 : 60}
                    >
                      <Label
                        value={t("metodologi.lossOfProductivity")}
                        angle={-90}
                        position="insideLeft"
                        offset={10}
                        style={{
                          textAnchor: "middle",
                          fill: chartTheme.axis,
                          fontSize: 12,
                        }}
                      />
                    </YAxis>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        backgroundColor: chartTheme.tooltipBg,
                        border: `1px solid ${chartTheme.tooltipBorder}`,
                        boxShadow: chartTheme.tooltipShadow,
                        color: chartTheme.tooltipText,
                      }}
                      itemStyle={{ color: chartTheme.tooltipText }}
                      labelStyle={{ color: chartTheme.tooltipMuted }}
                      formatter={(value: unknown) => [
                        formatPercent(Number(value)),
                        "Loss",
                      ]}
                      labelFormatter={(label) => `${t("metodologi.droughtTooltipPrefix")}: ${label}`}
                    />
                    <ReferenceLine
                      y={0.5}
                      stroke={chartTheme.grid}
                      strokeDasharray="5 3"
                      label={{
                        value: "50% LOP",
                        position: "insideTopRight",
                        fill: chartTheme.axis,
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    />
                    {!isMobile ? (
                      <Legend
                        verticalAlign="bottom"
                        iconType="plainline"
                        wrapperStyle={{ color: chartTheme.axis, paddingTop: "16px" }}
                      />
                    ) : null}
                    <Area
                      name={t("metodologi.droughtVulnCurveName")}
                      type="monotone"
                      dataKey="lop"
                      stroke="#F97316"
                      strokeWidth={2.5}
                      fill="url(#gradDroughtCurve)"
                      dot={false}
                      activeDot={{ r: 5, strokeWidth: 0 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mb-4 flex items-center gap-2 text-sm text-muted md:hidden">
                <span className="h-0.5 w-6 rounded-full bg-[#F97316]" />
                <span>{t("metodologi.droughtCurveMobileLabel")}</span>
              </div>

              <div className="alert-warning mt-auto">
                <p className="font-medium mb-2 flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4" /> {t("metodologi.formulationLabel")}
                </p>

                <p className="leading-relaxed text-sm">
                  {t("metodologi.droughtCurveDesc")}
                </p>

                <div className="surface-white mt-3 rounded-lg px-4 py-3">
                  <p className="section-eyebrow text-[11px]">
                    {t("metodologi.floodFormulaTitle")}
                  </p>
                  <p className="mt-1 font-mono text-sm font-medium text-heading break-words">
                    y = −0.8381x³ + 0.8967x² + 0.9064x − 0.0106
                  </p>
                </div>

                <p className="mt-3 leading-relaxed text-sm">
                  {t("metodologi.droughtFormulaExplain")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. METADATA SECTION */}
      <section className="section-shell content-section">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title={t("metodologi.metadataTitle")}
            label={t("metodologi.metadataLabel")}
            desc={t("metodologi.metadataDesc")}
          />

          <div className="mx-auto mt-12 max-w-5xl grid gap-4">
            {metadataRules.map((rule, index) => {
              const Icon = rule.icon;
              const rowNum = String(index + 1).padStart(2, "0");
              return (
                <div
                  key={index}
                  className="card flex flex-col md:flex-row gap-6 p-5"
                >
                  {/* Bagian Kiri: Judul & Deskripsi */}
                  <div className="flex-1 flex gap-4">
                    <div className="flex shrink-0 flex-col items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[var(--color-border)] text-[10px] font-bold text-muted">
                        {rowNum}
                      </span>
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${rule.badgeColor}`}
                      >
                        <Icon className={`h-5 w-5 ${rule.iconColor}`} />
                      </div>
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-heading leading-tight">
                          {rule.name}
                        </h3>
                        <span className="badge badge-outline text-[11px] gap-1">
                          <Database className="h-3 w-3" />
                          {rule.source}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted">
                        {rule.description}
                      </p>
                    </div>
                  </div>

                  {/* Bagian Kanan: Spesifikasi Teknis */}
                  <div className="surface-soft md:w-[40%] shrink-0 rounded-xl p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {rule.specs.map((spec, idx) => (
                        <div key={idx} className="flex flex-col">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                            {spec.label}
                          </span>
                          <span className="text-xs font-medium text-heading mt-0.5">
                            {spec.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. CTA SECTION */}
      <section className="section-shell content-section">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="content-cta-panel relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] p-6 text-center shadow-[var(--shadow-lg)] sm:p-10">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
              <div className="absolute right-10 bottom-10 h-40 w-40 rounded-full bg-[var(--color-secondary)]/10 blur-3xl" />
            </div>

            <div className="relative z-10">
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
                {t("metodologi.ctaBadge")}
              </p>
              <h3 className="mt-2 text-2xl font-bold text-[var(--color-text)] md:text-3xl lg:text-4xl">
                {t("metodologi.ctaTitle")}
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-[var(--color-gray)] md:text-lg">
                {t("metodologi.ctaDesc")}
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/dashboard"
                  className="btn-primary px-6 py-3 text-base font-semibold"
                >
                  {t("metodologi.openDashboard")}
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-gray)] hover:text-[var(--color-text)]"
                >
                  {t("metodologi.backToHome")} <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
