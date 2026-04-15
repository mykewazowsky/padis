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
  centered = true,
}: {
  title: string;
  desc?: string;
  centered?: boolean;
}) {
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
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
  if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)} Juta`;
  if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)} rb`;
  return tickItem.toString();
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
          const fValue = parseFloat(banjir) || 0;
          const dValue = parseFloat(kekeringan) || 0;

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
            <span className="badge badge-secondary">Pendekatan Sistem</span>
            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Metodologi Analisis Risiko Spasial
            </h1>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-blue-100 md:text-lg">
              PADIS mengintegrasikan pemodelan genangan, indeks kekeringan, dan
              analisis multihazard untuk memberikan visualisasi serta estimasi
              risiko wilayah padi secara presisi.
            </p>
          </div>
        </div>
      </section>

      {/* 2. BASELINE DATA (BENCANA & PRODUKSI) */}
      <section className="relative overflow-hidden bg-slate-50 py-20 lg:py-24 text-gray-900 border-b border-gray-200">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Justifikasi Ancaman & Keterpaparan
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
                Pemodelan PADIS didasari oleh perbandingan antara riwayat
                tingginya frekuensi bencana{" "}
                <span className="font-semibold text-gray-800">(Hazard)</span>{" "}
                dengan wilayah-wilayah yang memiliki tingkat produksi padi
                terbesar{" "}
                <span className="font-semibold text-gray-800">(Exposure)</span>.
              </p>
            </div>

            <div className="rounded-[2rem] border border-gray-200 bg-white p-6 shadow-sm md:p-8">
              {isLoading ? (
                <div className="flex h-64 flex-col items-center justify-center text-slate-500">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mb-3" />
                  <p>Memuat dan memproses data CSV...</p>
                </div>
              ) : (
                <>
                  {/* GRAFIK 1: TREN BENCANA TAHUNAN */}
                  <div className="mb-10">
                    <h4 className="mb-4 text-lg font-bold text-gray-800 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-gray-500" />
                      Tren Historis Tahunan Bencana (DIBI)
                    </h4>
                    <div className="h-[350px] w-full rounded-xl border border-gray-100 bg-slate-50/30 p-4 pt-6">
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
                          />
                          <Tooltip
                            contentStyle={{
                              borderRadius: "12px",
                              border: "none",
                              boxShadow:
                                "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                            }}
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
                        <h4 className="text-lg font-bold text-gray-800">
                          Bobot Hazard untuk Analisis Multihazard
                        </h4>
                        <p className="mt-1 text-sm leading-relaxed text-gray-600">
                          Bobot berikut digunakan sebagai dasar komposisi
                          analisis multihazard berdasarkan basis historis
                          kejadian dan tingkat dampak ekonomi.
                        </p>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        {/* CARD BANJIR */}
                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-blue-700">
                                Hazard
                              </p>
                              <h5 className="mt-1 text-xl font-bold text-blue-900">
                                Banjir
                              </h5>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                              <Droplets className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-blue-100 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">
                              Final Weight
                            </p>
                            <p className="mt-1 text-lg font-bold text-gray-900">
                              0.6776836021
                            </p>
                          </div>

                          <p className="mt-3 text-sm leading-relaxed text-blue-800/80">
                            Nilai ini merepresentasikan kontribusi relatif
                            banjir dalam pembentukan analisis multihazard.
                          </p>
                        </div>

                        {/* CARD KEKERINGAN */}
                        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-medium text-orange-700">
                                Hazard
                              </p>
                              <h5 className="mt-1 text-xl font-bold text-orange-900">
                                Kekeringan
                              </h5>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm">
                              <Leaf className="h-5 w-5 text-orange-600" />
                            </div>
                          </div>

                          <div className="mt-4 rounded-xl border border-orange-100 bg-white px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500">
                              Final Weight
                            </p>
                            <p className="mt-1 text-lg font-bold text-gray-900">
                              0.3223163979
                            </p>
                          </div>

                          <p className="mt-3 text-sm leading-relaxed text-orange-800/80">
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

      {/* 3. KURVA KERENTANAN */}
      <section className="relative overflow-hidden bg-white py-20 lg:py-24 text-gray-900 border-b border-gray-200">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title="Model Kerentanan (Vulnerability Curve)"
            desc="Kurva kerentanan merepresentasikan hubungan antara indeks bencana dan tingkat kehilangan produktivitas padi (loss of productivity) pada masing-masing hazard."
          />

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            {/* KURVA BANJIR */}
            <div className="flex flex-col rounded-[2rem] border border-blue-200 bg-slate-50 p-8 shadow-sm transition hover:shadow-md">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 shadow-sm">
                    <Droplets className="h-7 w-7 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Kerentanan Banjir
                    </h3>
                    <p className="text-sm text-gray-500 italic">
                      Hendrawan &amp; Komori (2021)
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6 h-[320px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-inner">
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

              <div className="mt-auto rounded-xl bg-blue-50 p-4 border border-blue-100">
                <p className="font-medium text-blue-900 mb-2 flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4" /> Formulasi Kerentanan
                </p>

                <p className="text-blue-800/90 leading-relaxed text-sm">
                  Kurva ini menunjukkan hubungan antara kedalaman genangan
                  banjir dan kehilangan produktivitas padi (
                  <strong>loss of productivity</strong>). Formulasi yang
                  digunakan mengacu pada Hendrawan &amp; Komori (2021) untuk
                  merepresentasikan respons kerentanan banjir pada analisis
                  PADIS.
                </p>

                <div className="mt-3 rounded-lg border border-blue-100 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">
                    Persamaan Loss
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900">
                    y = 0.52 + 0.29 ln(x)
                  </p>
                </div>

                <p className="mt-3 text-blue-800/80 leading-relaxed text-sm">
                  Pada formulasi ini, <strong>y</strong> merepresentasikan nilai{" "}
                  <strong>loss rate / loss of productivity</strong>, sedangkan{" "}
                  <strong>x</strong> merepresentasikan kedalaman genangan banjir
                  maksimum (meter).
                </p>
              </div>
            </div>

            {/* KURVA KEKERINGAN */}
            <div className="flex flex-col rounded-[2rem] border border-orange-200 bg-slate-50 p-8 shadow-sm transition hover:shadow-md">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 shadow-sm">
                    <Leaf className="h-7 w-7 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">
                      Kerentanan Kekeringan
                    </h3>
                    <p className="text-sm text-gray-500 italic">
                      Guo dkk. (2021)
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6 h-[320px] w-full overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-inner">
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

              <div className="mt-auto rounded-xl bg-orange-50 p-4 border border-orange-100">
                <p className="font-medium text-orange-900 mb-2 flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4" /> Formulasi Kerentanan
                </p>

                <p className="text-orange-800/90 leading-relaxed text-sm">
                  Kurva ini menunjukkan hubungan antara intensitas kekeringan
                  dan kehilangan produktivitas padi (
                  <strong>loss of productivity</strong>). Formulasi yang
                  digunakan mengacu pada adaptasi kurva kerentanan kekeringan
                  dari Guo dkk. (2021) untuk analisis PADIS.
                </p>

                <div className="mt-3 rounded-lg border border-orange-100 bg-white px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500">
                    Persamaan Loss
                  </p>
                  <p className="mt-1 text-sm font-medium text-gray-900 break-words">
                    y = −0.8381x³ + 0.8967x² + 0.9064x − 0.0106
                  </p>
                </div>

                <p className="mt-3 text-orange-800/80 leading-relaxed text-sm">
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

      {/* 4. METADATA SECTION */}
      <section className="relative overflow-hidden bg-slate-50 py-16 lg:py-20 text-gray-900 border-b border-gray-200">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title="Spesifikasi & Metadata Geospasial"
            desc="Katalog sumber data utama beserta parameter teknis yang digunakan sebagai input pemodelan risiko."
          />

          <div className="mx-auto mt-12 max-w-5xl grid gap-4">
            {metadataRules.map((rule, index) => {
              const Icon = rule.icon;
              return (
                <div
                  key={index}
                  className="group flex flex-col md:flex-row gap-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
                >
                  {/* Bagian Kiri: Judul & Deskripsi */}
                  <div className="flex-1 flex gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${rule.badgeColor}`}
                    >
                      <Icon className={`h-5 w-5 ${rule.iconColor}`} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">
                          {rule.name}
                        </h3>
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <Database className="h-3 w-3" />
                          {rule.source}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-gray-600">
                        {rule.description}
                      </p>
                    </div>
                  </div>

                  {/* Bagian Kanan: Spesifikasi Teknis */}
                  <div className="md:w-[40%] shrink-0 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {rule.specs.map((spec, idx) => (
                        <div key={idx} className="flex flex-col">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                            {spec.label}
                          </span>
                          <span className="text-xs font-medium text-gray-900 mt-0.5">
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

      {/* 5. CTA SECTION */}
      <section className="relative overflow-hidden bg-white pb-20 pt-20">
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