"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Droplets,
  Leaf,
  Map as MapIcon, // <-- INI YANG SEBELUMNYA TERLEWAT
  ArrowRight,
  Layers,
  Database,
  Info,
  History,
  Download,
  AlertTriangle,
  TrendingUp,
  Loader2,
  MapPin,
  Wheat
} from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts";

// -- Tipe Data --
interface HistoricalRecord {
  year: string;
  flood: number;
  drought: number;
}

interface RegencyRecord {
  kabupaten: string;
  flood: number;
  drought: number;
  total: number;
}

interface ProductionRecord {
  kab_kota: string;
  prov: string;
  total_prod: number;
}

const metadataRules = [
  {
    name: "Batas Administrasi",
    source: "Badan Informasi Geospasial (BIG)",
    icon: MapIcon, // <-- DISESUAIKAN DENGAN ALIAS
    iconColor: "text-blue-500",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description: "Digunakan sebagai referensi spasial dasar untuk spatial join dan agregasi estimasi kerugian (Loss & AAL) hingga ke tingkat kabupaten/kota.",
    specs: [
      { label: "Tipe Geometri", value: "Vector Polygon" },
      { label: "Format File", value: ".SHP / .GeoJSON" },
      { label: "Atribut Kunci", value: "id_kabkota, kab_kota" },
      { label: "Sistem Referensi", value: "WGS 84 (EPSG:4326)" },
    ]
  },
  {
    name: "Lahan Baku Sawah",
    source: "Kementerian ATR/BPN",
    icon: Layers,
    iconColor: "text-emerald-500",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "Layer spasial yang merepresentasikan footprint area persawahan. Digunakan untuk proses masking dan ekstraksi nilai hazard yang tumpang tindih (overlay).",
    specs: [
      { label: "Tipe Geometri", value: "Vector Polygon" },
      { label: "Skala Pemetaan", value: "1:5.000" },
      { label: "Format File", value: ".SHP / .GPKG" },
      { label: "Validasi", value: "Clean Topology (No Self-Intersect)" },
    ]
  },
  {
    name: "Pemodelan Genangan Banjir",
    source: "HEC-RAS 2D Analysis",
    icon: Droplets,
    iconColor: "text-cyan-500",
    badgeColor: "bg-cyan-50 text-cyan-700 border-cyan-200",
    description: "Layer raster hasil simulasi hidrodinamika 2D yang berisi nilai kedalaman genangan (inundation depth) dalam satuan meter untuk diintegrasikan dengan kurva kerentanan.",
    specs: [
      { label: "Tipe Data", value: "Raster (.TIFF)" },
      { label: "Resolusi Spasial", value: "8 Meter" },
      { label: "Skenario Baseline", value: "R25, R50, R100, R250" },
      { label: "Skenario Iklim", value: "RC25, RC50, RC100, RC250" },
    ]
  },
  {
    name: "Indeks Kekeringan (SPI)",
    source: "CHIRPS, GPM, MME",
    icon: Leaf,
    iconColor: "text-orange-500",
    badgeColor: "bg-orange-50 text-orange-700 border-orange-200",
    description: "Layer raster nilai Standardized Precipitation Index yang merepresentasikan tingkat defisit curah hujan ekstrem berdasarkan observasi satelit dan proyeksi Multi-Model Ensemble.",
    specs: [
      { label: "Tipe Data", value: "Raster (.TIFF)" },
      { label: "Resolusi Spasial", value: "~5 Kilometer" },
      { label: "Skenario GPM", value: "RP25, RP50, RP100, RP250" },
      { label: "Skenario MME", value: "RP25, RP50, RP100, RP250" },
    ]
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

// Fungsi formatter untuk mengubah angka besar ke format rb (Ribu) / Juta untuk chart produksi
const formatYAxis = (tickItem: number) => {
  if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)} Juta`;
  if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(0)} rb`;
  return tickItem.toString();
};

export default function MetodologiPage() {
  const [histData, setHistData] = useState<HistoricalRecord[]>([]);
  const [regencyData, setRegencyData] = useState<RegencyRecord[]>([]);
  const [prodData, setProdData] = useState<ProductionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totals, setTotals] = useState({ flood: 0, drought: 0, prod: 0 });

  useEffect(() => {
    const fetchCSV = async () => {
      try {
        // 1. Fetch Data Tahunan Bencana
        const resTahunan = await fetch("/historis/data_historis_banjir_kekeringan_DIBI.csv");
        const csvTahunan = await resTahunan.text();
        const linesTahunan = csvTahunan.trim().split("\n").slice(1);
        let sumFlood = 0;
        let sumDrought = 0;

        const parsedTahunan = linesTahunan.map((line) => {
          const delimiter = line.includes(";") ? ";" : ",";
          const [tahun, banjir, kekeringan] = line.split(delimiter);
          const fValue = parseFloat(banjir) || 0;
          const dValue = parseFloat(kekeringan) || 0;
          sumFlood += fValue;
          sumDrought += dValue;
          return { year: tahun?.trim() || "N/A", flood: fValue, drought: dValue };
        });

        // 2. Fetch Data Kabupaten/Kota Bencana
        const resKabKota = await fetch("/historis/data_historis_banjir_kekeringan_DIBI_kabkota.csv");
        const csvKabKota = await resKabKota.text();
        const linesKabKota = csvKabKota.trim().split("\n").slice(1);
        
        // --- DI SINI ERRORNYA SUDAH TERATASI KARENA ALIAS IMPORT MapIcon ---
        const kabKotaMap = new Map<string, RegencyRecord>();

        linesKabKota.forEach((line) => {
          const delimiter = line.includes(";") ? ";" : ",";
          const [kategori, kabupaten, jumlah] = line.split(delimiter);
          if (!kabupaten) return;
          const cat = kategori?.trim().toLowerCase() || "";
          const kab = kabupaten?.trim() || "Unknown";
          const count = parseFloat(jumlah) || 0;

          if (!kabKotaMap.has(kab)) {
            kabKotaMap.set(kab, { kabupaten: kab, flood: 0, drought: 0, total: 0 });
          }

          const record = kabKotaMap.get(kab)!;
          if (cat.includes("banjir")) record.flood += count;
          else if (cat.includes("kering") || cat.includes("kekeringan")) record.drought += count;
          record.total = record.flood + record.drought;
        });

        const parsedKabKota = Array.from(kabKotaMap.values())
          .sort((a, b) => b.total - a.total)
          .slice(0, 15);

        // 3. Fetch Data Produksi Padi
        const resProd = await fetch("/produksi/total_prod_padi.csv");
        const csvProd = await resProd.text();
        const linesProd = csvProd.trim().split("\n").slice(1);
        let sumProd = 0;

        const allProdData = linesProd.map((line) => {
          const delimiter = line.includes(";") ? ";" : ",";
          const [id_kabkota, kab_kota, id_prov, prov, tahun, total_prod] = line.split(delimiter);
          const valProd = parseFloat(total_prod) || 0;
          sumProd += valProd;

          return {
            kab_kota: kab_kota?.trim() || "Unknown",
            prov: prov?.trim() || "Unknown",
            total_prod: valProd
          };
        });

        const top15Prod = allProdData
          .sort((a, b) => b.total_prod - a.total_prod)
          .slice(0, 15);

        setHistData(parsedTahunan);
        setRegencyData(parsedKabKota);
        setProdData(top15Prod);
        setTotals({ flood: sumFlood, drought: sumDrought, prod: sumProd });

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
              PADIS mengintegrasikan pemodelan genangan, indeks kekeringan, dan analisis multihazard untuk memberikan visualisasi serta estimasi risiko wilayah padi secara presisi.
            </p>
          </div>
        </div>
      </section>

      {/* 2. BASELINE DATA (BENCANA & PRODUKSI) */}
      <section className="relative overflow-hidden bg-slate-50 py-20 lg:py-24 text-gray-900 border-b border-gray-200">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          
          <div className="mx-auto max-w-5xl">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center justify-center rounded-full bg-blue-100 px-3 py-1 mb-4 border border-blue-200">
                <History className="h-4 w-4 text-blue-700 mr-2" />
                <span className="text-sm font-medium text-blue-800">Baseline Data (Live CSV)</span>
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Justifikasi Ancaman & Keterpaparan
              </h2>
              <p className="mt-4 text-lg text-gray-600 leading-relaxed max-w-3xl mx-auto">
                Pemodelan PADIS didasari oleh perbandingan antara riwayat tingginya frekuensi bencana (<span className="font-semibold text-gray-800">Hazard</span>) dengan wilayah-wilayah yang memiliki tingkat produksi padi terbesar (<span className="font-semibold text-gray-800">Exposure</span>).
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
                        <LineChart data={histData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                          <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tick={{ fill: '#64748B', fontSize: 11 }}
                            tickFormatter={formatYAxis} 
                            width={65} // <-- Perlebar menjadi 65 agar teks "Juta" tidak terpotong
                          />
                          <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                          <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                          <Line name="Kejadian Banjir" type="monotone" dataKey="flood" stroke="#3B82F6" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                          <Line name="Kejadian Kekeringan" type="monotone" dataKey="drought" stroke="#F97316" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* GRAFIK 2 & 3: PERBANDINGAN LOKASI (SIDE BY SIDE ON DESKTOP) */}
                  <div className="grid gap-8 lg:grid-cols-2">
                    
                    {/* Bar Chart 1: Distribusi Bencana */}
                    <div className="flex flex-col">
                      <h4 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
                        <MapPin className="h-5 w-5 text-red-500" />
                        Top 15 Wilayah Terdampak Bencana
                      </h4>
                      <div className="h-[420px] w-full rounded-2xl border border-gray-100 bg-slate-50/50 p-5 shadow-sm transition-shadow hover:shadow-md">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={regencyData} margin={{ top: 10, right: 10, left: 0, bottom: 85 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis 
                              dataKey="kabupaten" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748B', fontSize: 11 }} 
                              angle={-45}
                              textAnchor="end"
                              dy={12}
                              interval={0}
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 11 }} />
                            <Tooltip 
                              cursor={{ fill: 'rgba(226, 232, 240, 0.4)' }} 
                              contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: any, name: any) => [new Intl.NumberFormat('id-ID').format(Number(value)), name]}
                            />
                            <Legend 
                              verticalAlign="top" 
                              wrapperStyle={{ paddingBottom: '20px', fontSize: '12px' }} 
                              iconType="circle" 
                            />
                            <Bar name="Banjir" dataKey="flood" stackId="a" fill="#3B82F6" radius={[0, 0, 4, 4]} maxBarSize={45} />
                            <Bar name="Kekeringan" dataKey="drought" stackId="a" fill="#F97316" radius={[4, 4, 0, 0]} maxBarSize={45} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Bar Chart 2: Distribusi Produksi Padi */}
                    <div className="flex flex-col">
                      <h4 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-800">
                        <Wheat className="h-5 w-5 text-amber-500" />
                        Top 15 Wilayah Produksi Padi (Ton)
                      </h4>
                      <div className="h-[420px] w-full rounded-2xl border border-amber-100/50 bg-amber-50/40 p-5 shadow-sm transition-shadow hover:shadow-md">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={prodData} margin={{ top: 10, right: 10, left: 0, bottom: 85 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                            <XAxis 
                              dataKey="kab_kota" 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748B', fontSize: 11 }} 
                              angle={-45}
                              textAnchor="end"
                              dy={12}
                              interval={0}
                            />
                            <YAxis 
                              axisLine={false} 
                              tickLine={false} 
                              tick={{ fill: '#64748B', fontSize: 11 }}
                              tickFormatter={formatYAxis} 
                              width={45}
                            />
                            <Tooltip 
                              cursor={{ fill: 'rgba(245, 158, 11, 0.1)' }} 
                              contentStyle={{ borderRadius: '12px', border: 'none', fontSize: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                              formatter={(value: any) => [`${new Intl.NumberFormat('id-ID').format(Number(value))} Ton`, 'Total Produksi']}
                            />
                            <Legend 
                              verticalAlign="top" 
                              wrapperStyle={{ paddingBottom: '20px', fontSize: '12px', visibility: 'hidden' }} 
                            />
                            <Bar name="Total Produksi" dataKey="total_prod" fill="#F59E0B" radius={[4, 4, 0, 0]} maxBarSize={45} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                  </div>

                  {/* Footer action */}
                  <div className="mt-10 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-6">
                    <p className="text-sm text-gray-500 italic">
                      *Sumber Data: Portal DIBI BNPB & Data Produksi BPS
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <a href="/total_prod_padi.csv" download className="inline-flex items-center gap-2 rounded-xl bg-amber-100 px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-200">
                        <Download className="h-4 w-4" /> Data Produksi
                      </a>
                      <a href="/historis/data_historis_banjir_kekeringan_DIBI_kabkota.csv" download className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800">
                        <Download className="h-4 w-4" /> Data Bencana
                      </a>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. KURVA KERENTANAN (HANYA GAMBAR & REFERENSI) */}
      <section className="relative overflow-hidden bg-white py-20 lg:py-24 text-gray-900 border-b border-gray-200">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title="Model Kerentanan (Vulnerability Curve)"
            desc="Nilai Loss of Production (LOP) direpresentasikan berdasarkan fungsi model kerentanan historis untuk ekstraksi nilai piksel spasial."
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
                    <h3 className="text-xl font-bold text-gray-900">Kerentanan Banjir</h3>
                    <p className="text-sm text-gray-500 italic">Hendrawan & Komori (2021)</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white aspect-[16/10] relative shadow-inner">
                <Image 
                  src="/kurva/kurva_banjir.jpeg"
                  alt="Grafik Kurva Kerentanan Banjir Padi (Hendrawan & Komori, 2021)"
                  fill
                  className="object-contain p-2"
                />
              </div>

              <div className="mt-auto rounded-xl bg-blue-50 p-4 border border-blue-100">
                <p className="font-medium text-blue-900 mb-1 flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4" /> Konteks Ekstraksi Spasial
                </p>
                <p className="text-blue-800/80 leading-relaxed text-sm">
                  Kurva ini digunakan untuk mentransformasikan kedalaman genangan banjir menjadi nilai LOP. Indeks raster diekstraksi <strong>eksklusif hanya pada poligon lahan sawah</strong>.
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
                    <h3 className="text-xl font-bold text-gray-900">Kerentanan Kekeringan</h3>
                    <p className="text-sm text-gray-500 italic">Guo dkk. (2021)</p>
                  </div>
                </div>
              </div>

              <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white aspect-[16/10] relative shadow-inner">
                <Image 
                  src="/kurva/kurva_kekeringan.jpeg"
                  alt="Grafik Kurva Kerentanan Kekeringan Padi (Guo dkk., 2021)"
                  fill
                  className="object-contain p-2"
                />
              </div>

              <div className="mt-auto rounded-xl bg-orange-50 p-4 border border-orange-100">
                <p className="font-medium text-orange-900 mb-1 flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4" /> Konteks Ekstraksi Spasial
                </p>
                <p className="text-orange-800/80 leading-relaxed text-sm">
                  Kurva ini digunakan untuk mengkonversi nilai raster SPI ke tingkat LOP. Sama seperti banjir, overlay spasial difokuskan <strong>hanya pada tutupan sawah aktif</strong>.
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
                    <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${rule.badgeColor}`}>
                      <Icon className={`h-5 w-5 ${rule.iconColor}`} />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight">{rule.name}</h3>
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
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{spec.label}</span>
                          <span className="text-xs font-medium text-gray-900 mt-0.5">{spec.value}</span>
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
                Gunakan dashboard PADIS untuk melihat estimasi kerugian, membandingkan skenario, dan mengidentifikasi wilayah prioritas secara spasial.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-4">
                <Link href="/dashboard" className="btn-primary px-6 py-3 text-base font-semibold">
                  Buka Dashboard
                </Link>
                <Link href="/" className="inline-flex items-center gap-2 text-sm text-[var(--color-gray)] hover:text-[var(--color-text)]">
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