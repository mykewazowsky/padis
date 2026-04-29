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
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Label,
} from "recharts";

// -- Tipe Data --
interface HistoricalRecord {
  year: string;
  flood: number;
  drought: number;
}

const metadataRules = [
  {
    name: "Batas Administrasi",
    source: "Badan Informasi Geospasial (BIG)",
    icon: MapIcon,
    iconColor: "text-blue-500",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description:
      "Digunakan sebagai referensi spasial dasar untuk spatial join dan agregasi estimasi kerugian (Loss & AAL) hingga ke tingkat kabupaten/kota.",
    specs: [
      { label: "Tipe Geometri", value: "Vector Polygon" },
      { label: "Format File", value: ".SHP / .GeoJSON" },
      { label: "Atribut Kunci", value: "id_kabkota, kab_kota" },
      { label: "Sistem Referensi", value: "WGS 84 (EPSG:4326)" },
    ],
  },
  {
    name: "Penutupan Lahan Sawah",
    source: "Kementerian LHK",
    icon: Layers,
    iconColor: "text-emerald-500",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description:
      "Layer spasial yang merepresentasikan footprint area persawahan. Digunakan untuk proses masking dan ekstraksi nilai hazard yang tumpang tindih (overlay).",
    specs: [
      { label: "Tipe Geometri", value: "Vector Polygon" },
      { label: "Skala Pemetaan", value: "1:250000" },
      { label: "Format File", value: ".SHP / .GPKG" },
      { label: "Validasi", value: "Clean Topology (No Self-Intersect)" },
    ],
  },
  {
    name: "Pemodelan Genangan Banjir",
    source: "HEC-RAS 2D Analysis",
    icon: Droplets,
    iconColor: "text-cyan-500",
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
    description:
      "Layer raster hasil simulasi hidrodinamika 2D yang berisi nilai kedalaman genangan (inundation depth) dalam satuan meter untuk diintegrasikan dengan kurva kerentanan.",
    specs: [
      { label: "Tipe Data", value: "Raster (.TIFF)" },
      { label: "Resolusi Spasial", value: "30 meter" },
      { label: "Skenario Baseline", value: "R25, R50, R100, R250" },
      { label: "Skenario Iklim", value: "RC25, RC50, RC100, RC250" },
    ],
  },
  {
    name: "Indeks Kekeringan (SPI)",
    source: "CHIRPS, GPM, MME",
    icon: Leaf,
    iconColor: "text-orange-500",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
    description:
      "Layer raster nilai Standardized Precipitation Index yang merepresentasikan tingkat defisit curah hujan ekstrem berdasarkan observasi satelit dan proyeksi Multi-Model Ensemble.",
    specs: [
      { label: "Tipe Data", value: "Raster (.TIFF)" },
      { label: "Resolusi Spasial", value: "~11 Kilometer" },
      { label: "Skenario GPM", value: "RP25, RP50, RP100, RP250" },
      { label: "Skenario MME", value: "RP25, RP50, RP100, RP250" },
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

// Formatter angka besar
const formatYAxis = (tickItem: number) => {
  const value = Math.round(tickItem);

  if (value >= 1000000) return `${Math.round(value / 1000000)} Juta`;
  if (value >= 1000) return `${Math.round(value / 1000)} rb`;
  return value.toString();
};

// Formatter persen untuk kurva kerentanan
const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

export default function MetodologiPage() {
  const [histData, setHistData] = useState<HistoricalRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const hazardWeights = [
    {
      label: "Banjir",
      value: 0.6776836021,
      color: "blue",
      description:
        "Bobot dominan dalam komposisi multihazard berdasarkan basis historis kejadian dan tingkat dampak.",
    },
    {
      label: "Kekeringan",
      value: 0.3223163979,
      color: "orange",
      description:
        "Bobot pendamping dalam komposisi multihazard untuk merepresentasikan kontribusi risiko kekeringan.",
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
    <>
      {/* 1. HERO SECTION */}
      <section className="section-gradient-primary relative overflow-hidden text-white">
        <div className="hero-grid-overlay" />
        <div className="hero-orb hero-orb-primary -left-10 top-10 h-44 w-44" />
        <div className="hero-orb hero-orb-secondary right-0 top-0 h-56 w-56" />
        <div className="hero-orb hero-orb-soft bottom-0 left-1/3 h-36 w-36" />

        <div className="section-container relative py-16 lg:py-24 text-center">
          <div className="mx-auto max-w-4xl">
            <span className="badge badge-secondary">Metodologi Teknis</span>

            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Metodologi Analisis Risiko Spasial
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-blue-100 md:text-base">
              Sistem berbasis raster yang mengintegrasikan hazard, kerentanan, dan
              exposure untuk menghasilkan estimasi Loss dan AAL tingkat kabupaten.
            </p>

            {/* Conceptual flow grid — 4 stages of the risk equation */}
            <div className="mx-auto mt-10 grid max-w-2xl grid-cols-2 gap-3 text-left sm:grid-cols-4">
              {[
                { label: "Hazard", sub: "Banjir & Kekeringan" },
                { label: "Exposure", sub: "Sawah per Kab/Kota" },
                { label: "Vulnerability", sub: "Kurva Kerentanan" },
                { label: "Loss & AAL", sub: "Output Risiko" },
              ].map((item, i) => (
                <div
                  key={item.label}
                  className={`rounded-2xl border px-4 py-3 ${
                    i === 3
                      ? "border-[var(--color-secondary)]/40 bg-[var(--color-secondary)]/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${
                    i === 3 ? "text-[var(--color-secondary)]" : "text-blue-200"
                  }`}>
                    {item.label}
                  </p>
                  <p className="mt-1 text-[11px] leading-snug text-blue-100/70">
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
                Justifikasi Ancaman &amp; Keterpaparan
              </h2>
              <p className="text-muted mt-4 leading-relaxed md:text-lg max-w-3xl mx-auto">
                Pemodelan PADIS didasari oleh perbandingan antara riwayat
                tingginya frekuensi bencana{" "}
                <span className="font-semibold text-heading">(Hazard)</span>{" "}
                dengan wilayah-wilayah yang memiliki tingkat produksi padi
                terbesar{" "}
                <span className="font-semibold text-heading">(Exposure)</span>.
              </p>
            </div>

            <div className="card p-6 md:p-8">
              {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center text-muted">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                  <p>Memuat dan memproses data CSV...</p>
                </div>
              ) : (
                <>
                  {/* GRAFIK 1: TREN BENCANA TAHUNAN */}
                  <div className="mb-10">
                    <h4 className="mb-4 text-lg font-bold text-heading flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-muted" />
                      Tren Historis Tahunan Bencana (DIBI)
                    </h4>
                    <div className="chart-shell h-[350px] w-full p-4 pt-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={histData}
                          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                        >
                          <CartesianGrid
                            strokeDasharray="3 3"
                            vertical={false}
                            stroke="#E2E8F0"
                          />
                          <XAxis
                            dataKey="year"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748B", fontSize: 12 }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fill: "#64748B", fontSize: 11 }}
                            tickFormatter={formatYAxis}
                            width={65}
                            allowDecimals={false}
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "12px",
                              border: "none",
                              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
                            formatter={(value: any, name: any) => [
                              Math.round(Number(value)), // 🔥 hilangkan desimal
                              name === "Kejadian Banjir" ? "Banjir" : "Kekeringan",
                            ]}
                            labelFormatter={(label) => `Tahun: ${label}`}
                          />
                          <Legend
                            iconType="circle"
                            wrapperStyle={{ paddingTop: "20px" }}
                          />
                          <Line
                            name="Kejadian Banjir"
                            type="monotone"
                            dataKey="flood"
                            stroke="#3B82F6"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6 }}
                          />
                          <Line
                            name="Kejadian Kekeringan"
                            type="monotone"
                            dataKey="drought"
                            stroke="#F97316"
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* CARD PEMBOBOTAN MULTIHAZARD */}
                  <div className="mt-8 px-2 md:px-4">
                    <div className="mx-auto max-w-[1100px]">
                      <div className="mb-4 text-center">
                        <p className="section-eyebrow text-sm">Pembobotan Multihazard</p>
                        <h4 className="mt-1 text-lg font-bold text-heading">
                          Bobot Hazard untuk Analisis Multihazard
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-muted">
                          Bobot berikut digunakan sebagai dasar komposisi
                          analisis multihazard berdasarkan basis historis
                          kejadian dan tingkat dampak ekonomi.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* CARD BANJIR */}
                        <div className="panel-primary rounded-2xl p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)]">
                                Hazard
                              </p>
                              <h5 className="mt-1 text-xl font-bold text-heading">
                                Banjir
                              </h5>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                              <Droplets className="h-5 w-5 text-[var(--color-primary)]" />
                            </div>
                          </div>

                          <div className="surface-white mt-4 px-4 py-3">
                            <p className="section-eyebrow text-[11px]">Final Weight</p>
                            <p className="mt-1 text-lg font-bold text-heading">
                              0.6776836021
                            </p>
                          </div>

                          <p className="mt-3 text-sm leading-relaxed text-muted">
                            Nilai ini merepresentasikan kontribusi relatif
                            banjir dalam pembentukan analisis multihazard.
                          </p>
                        </div>

                        {/* CARD KEKERINGAN */}
                        <div className="panel-secondary rounded-2xl p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary-dark)]">
                                Hazard
                              </p>
                              <h5 className="mt-1 text-xl font-bold text-heading">
                                Kekeringan
                              </h5>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                              <Leaf className="h-5 w-5 text-[var(--color-secondary-dark)]" />
                            </div>
                          </div>

                          <div className="surface-white mt-4 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-secondary-dark)]">Final Weight</p>
                            <p className="mt-1 text-lg font-bold text-heading">
                              0.3223163979
                            </p>
                          </div>

                          <p className="mt-3 text-sm leading-relaxed text-muted">
                            Nilai ini merepresentasikan kontribusi relatif
                            kekeringan dalam komposisi analisis multihazard.
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

      {/* 3. SKENARIO CLIMATE DAN NON-CLIMATE */}
      <section className="section-shell bg-white">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="text-heading text-balance text-3xl font-bold tracking-tight md:text-4xl">
                Skenario Climate dan Non-Climate
              </h2>
              <p className="text-muted mt-4 leading-relaxed md:text-lg max-w-3xl mx-auto">
                Dalam PADIS, istilah{" "}
                <strong className="text-heading">Climate</strong> dan{" "}
                <strong className="text-heading">Non-Climate</strong> digunakan
                sebagai penanda <em>skenario raster hazard</em> pada analisis
                risiko banjir dan kekeringan — bukan perbedaan metode maupun
                format data.
              </p>
            </div>

            {/* Kartu perbandingan dua skenario */}
            <div className="grid items-center gap-4 md:grid-cols-[1fr_auto_1fr]">
              {/* Non-Climate */}
              <div className="card p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="section-eyebrow text-xs mb-1">Skenario</p>
                    <h5 className="text-xl font-bold text-heading">
                      Non-Climate
                    </h5>
                    <p className="text-sm italic text-muted mt-0.5">
                      Baseline Scenario
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
                    <History className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  Merepresentasikan kondisi acuan berdasarkan kondisi dasar,
                  historis, atau eksisting, tanpa mempertimbangkan proyeksi
                  perubahan iklim secara eksplisit. Skenario ini berfungsi
                  sebagai referensi untuk mengukur tingkat risiko pada kondisi
                  baseline.
                </p>
              </div>

              {/* vs divider */}
              <div className="hidden md:flex items-center justify-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border)] bg-white text-[11px] font-bold text-muted shadow-sm">
                  vs
                </span>
              </div>

              {/* Climate */}
              <div className="card card-accent-secondary p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-secondary-dark)] mb-1">
                      Skenario
                    </p>
                    <h5 className="text-xl font-bold text-heading">Climate</h5>
                    <p className="text-sm italic text-[var(--color-secondary-dark)] mt-0.5">
                      Climate Projection Scenario
                    </p>
                  </div>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] bg-white shadow-sm">
                    <TrendingUp className="h-5 w-5 text-[var(--color-secondary-dark)]" />
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  Merepresentasikan kondisi hazard yang mempertimbangkan
                  pengaruh iklim atau proyeksi perubahan iklim. Nilai raster
                  pada skenario ini mencerminkan potensi perubahan intensitas
                  bahaya akibat faktor iklim di masa mendatang.
                </p>
              </div>
            </div>

            {/* Info bersama: format raster + catatan alur risiko */}
            <div className="alert-info mt-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-2">
                    Format Raster Hazard (Kedua Skenario)
                  </p>
                  <div className="flex flex-col gap-1 text-sm">
                    <span>
                      <span className="font-medium text-blue-700">Banjir</span>{" "}
                      — nilai kedalaman genangan (meter)
                    </span>
                    <span>
                      <span className="font-medium text-orange-700">
                        Kekeringan
                      </span>{" "}
                      — nilai Standardized Precipitation Index (SPI)
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 shrink-0 text-muted mt-0.5" />
                  <p className="text-sm leading-relaxed text-muted">
                    Kedua skenario diproses melalui alur perhitungan risiko yang
                    sama: ekstraksi nilai hazard, penerapan kurva kerentanan,
                    estimasi <em>loss</em>, dan agregasi ke{" "}
                    <strong className="text-heading">
                      Annual Average Loss (AAL)
                    </strong>{" "}
                    tingkat kabupaten/kota.
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
            title="Model Kerentanan (Vulnerability Curve)"
            desc="Kurva kerentanan merepresentasikan hubungan antara indeks bencana dan tingkat kehilangan produktivitas padi (loss of productivity) pada masing-masing hazard."
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
                      Kerentanan Banjir
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

              <div className="mb-6 h-[320px] w-full overflow-hidden chart-shell p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={floodCurveData}
                    margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E2E8F0"
                    />
                    <XAxis
                      dataKey="x"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      interval={15}
                      label={{
                        value: "Kedalaman Genangan (m)",
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      domain={[0, 1]}
                      tickFormatter={formatPercent}
                      width={60}
                    >
                      <Label
                        value="Loss of Productivity (%)"
                        angle={-90}
                        position="insideLeft"
                        offset={10}
                        style={{
                          textAnchor: "middle",
                          fill: "#64748B",
                          fontSize: 12,
                        }}
                      />
                    </YAxis>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: any) => [
                        formatPercent(Number(value)),
                        "Loss",
                      ]}
                      labelFormatter={(label) => `Kedalaman: ${label} m`}
                    />
                    <Legend wrapperStyle={{ paddingTop: "16px" }} />
                    <Line
                      name="Kurva Kerentanan Banjir"
                      type="monotone"
                      dataKey="lop"
                      stroke="#3B82F6"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="alert-info mt-auto">
                <p className="font-medium mb-2 flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4" /> Formulasi Kerentanan
                </p>

                <p className="leading-relaxed text-sm">
                  Kurva ini menunjukkan hubungan antara kedalaman genangan
                  banjir dan kehilangan produktivitas padi (
                  <strong>loss of productivity</strong>). Formulasi yang
                  digunakan mengacu pada Hendrawan &amp; Komori (2021) untuk
                  merepresentasikan respons kerentanan banjir pada analisis
                  PADIS.
                </p>

                <div className="surface-white mt-3 rounded-lg px-4 py-3">
                  <p className="section-eyebrow text-[11px]">
                    Persamaan Loss
                  </p>
                  <p className="mt-1 font-mono text-sm font-medium text-heading">
                    y = 0.52 + 0.29 ln(x)
                  </p>
                </div>

                <p className="mt-3 leading-relaxed text-sm">
                  Pada formulasi ini, <strong>y</strong> merepresentasikan nilai{" "}
                  <strong>loss rate / loss of productivity</strong>, sedangkan{" "}
                  <strong>x</strong> merepresentasikan kedalaman genangan banjir
                  maksimum (meter).
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
                      Kerentanan Kekeringan
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

              <div className="mb-6 h-[320px] w-full overflow-hidden chart-shell p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={droughtCurveData}
                    margin={{ top: 10, right: 20, left: 20, bottom: 10 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E2E8F0"
                    />
                    <XAxis
                      dataKey="x"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      interval={10}
                      label={{
                        value: "Indeks Kekeringan Ternormalisasi",
                        position: "insideBottom",
                        offset: -5,
                      }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#64748B", fontSize: 11 }}
                      domain={[0, 1]}
                      tickFormatter={formatPercent}
                      width={60}
                    >
                      <Label
                        value="Loss of Productivity (%)"
                        angle={-90}
                        position="insideLeft"
                        offset={10}
                        style={{
                          textAnchor: "middle",
                          fill: "#64748B",
                          fontSize: 12,
                        }}
                      />
                    </YAxis>
                    <Tooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                      }}
                      formatter={(value: any) => [
                        formatPercent(Number(value)),
                        "Loss",
                      ]}
                      labelFormatter={(label) => `Indeks: ${label}`}
                    />
                    <Legend wrapperStyle={{ paddingTop: "16px" }} />
                    <Line
                      name="Kurva Kerentanan Kekeringan"
                      type="monotone"
                      dataKey="lop"
                      stroke="#F97316"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="alert-warning mt-auto">
                <p className="font-medium mb-2 flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4" /> Formulasi Kerentanan
                </p>

                <p className="leading-relaxed text-sm">
                  Kurva ini menunjukkan hubungan antara intensitas kekeringan
                  dan kehilangan produktivitas padi (
                  <strong>loss of productivity</strong>). Formulasi yang
                  digunakan mengacu pada adaptasi kurva kerentanan kekeringan
                  dari Guo dkk. (2021) untuk analisis PADIS.
                </p>

                <div className="surface-white mt-3 rounded-lg px-4 py-3">
                  <p className="section-eyebrow text-[11px]">
                    Persamaan Loss
                  </p>
                  <p className="mt-1 font-mono text-sm font-medium text-heading break-words">
                    y = −0.8381x³ + 0.8967x² + 0.9064x − 0.0106
                  </p>
                </div>

                <p className="mt-3 leading-relaxed text-sm">
                  Pada formulasi ini, <strong>y</strong> merepresentasikan nilai{" "}
                  <strong>loss rate / loss of productivity</strong>, sedangkan{" "}
                  <strong>x</strong> merepresentasikan indeks kekeringan yang
                  telah dinormalisasi.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. METADATA SECTION */}
      <section className="section-shell bg-white">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title="Spesifikasi & Metadata Geospasial"
            label="Data Sources"
            desc="Katalog sumber data utama beserta parameter teknis yang digunakan sebagai input pemodelan risiko."
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
      <section className="section-shell bg-white">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary-soft)]/40 via-white to-[var(--color-secondary-soft)]/30 p-10 text-center shadow-[var(--shadow-lg)]">
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
              <div className="absolute right-10 bottom-10 h-40 w-40 rounded-full bg-[var(--color-secondary)]/10 blur-3xl" />
            </div>

            <div className="relative z-10">
              <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
                LANGKAH BERIKUTNYA
              </p>
              <h3 className="mt-2 text-3xl font-bold text-[var(--color-text)] md:text-4xl">
                Coba Langsung Analisis Risiko Padi
              </h3>
              <p className="mx-auto mt-4 max-w-2xl text-[var(--color-gray)] md:text-lg">
                Gunakan dashboard PADIS untuk melihat estimasi kerugian,
                membandingkan skenario, dan mengidentifikasi wilayah prioritas
                secara spasial.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link
                  href="/dashboard"
                  className="btn-primary px-6 py-3 text-base font-semibold"
                >
                  Buka Dashboard
                </Link>
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 text-sm text-[var(--color-gray)] hover:text-[var(--color-text)]"
                >
                  Kembali ke Beranda <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}