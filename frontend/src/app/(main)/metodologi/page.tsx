import Link from "next/link";
import {
  Droplets,
  Leaf,
  LineChart,
  Map,
  FileText,
  ArrowRight,
  Layers,
  Database,
  Calculator,
  Info
} from "lucide-react";

const metadataRules = [
  {
    name: "Batas Administrasi",
    source: "Badan Informasi Geospasial (BIG)",
    icon: Map,
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

export default function MetodologiPage() {
  return (
    <>
      {/* HERO SECTION */}
      <section className="section-gradient-primary relative overflow-hidden text-white">
        <div className="hero-grid-overlay" />
        <div className="hero-orb hero-orb-primary -left-10 top-10 h-44 w-44" />
        <div className="hero-orb hero-orb-secondary right-0 top-0 h-56 w-56" />
        <div className="hero-orb hero-orb-soft bottom-0 left-1/3 h-36 w-36" />

        <div className="section-container relative py-20 lg:py-28">
          <div className="mx-auto max-w-4xl text-center">
            <span className="badge badge-secondary">Pendekatan Sistem</span>

            <h1 className="mt-4 text-balance text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Metodologi Analisis Risiko Spasial
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-base leading-relaxed text-blue-100 md:text-lg">
              PADIS mengintegrasikan pemodelan genangan, indeks kekeringan, dan analisis multihazard melalui fungsi matematis terukur untuk menghitung estimasi kerugian ekonomi padi.
            </p>
          </div>
        </div>
      </section>

      {/* KALKULASI KERUGIAN EKONOMI (LOSS) */}
      <section className="relative overflow-hidden bg-white py-16 text-gray-900 border-b border-gray-200">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <div className="mx-auto max-w-4xl rounded-[2rem] border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50/30 p-8 shadow-sm md:p-10">
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-700">
                    <Calculator className="h-6 w-6" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900">Kalkulasi Kerugian Ekonomi</h3>
                </div>
                <p className="text-gray-700 leading-relaxed mb-6">
                  Kerugian akibat bencana (Loss) dihitung dengan mengalikan total produksi padi, Loss of Production (LOP) dari fungsi kerentanan, dan harga Gabah Kering Panen (GKP).
                </p>
                
                {/* Rumus Utama */}
                <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-inner">
                  <code className="text-lg font-mono font-semibold text-amber-700 block text-center break-words">
                    Loss = total_prod &times; lop_bencana &times; gabah_kering_panen
                  </code>
                </div>
              </div>

              {/* Variabel Penjelas */}
              <div className="w-full md:w-[45%] flex flex-col gap-3">
                <div className="rounded-xl bg-white p-4 border border-amber-100 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900 mb-1">total_prod</p>
                  <p className="text-xs text-gray-600">Diambil dari data tabular <code className="bg-gray-100 px-1 rounded">total_prod_padi.csv</code>.</p>
                </div>
                <div className="rounded-xl bg-white p-4 border border-amber-100 shadow-sm">
                  <p className="text-sm font-semibold text-gray-900 mb-1 flex justify-between">
                    gabah_kering_panen 
                    <span className="text-amber-600">Rp6.500,00</span>
                  </p>
                  <p className="text-xs text-gray-600">Harga GKP tahun 2025. <span className="font-medium text-amber-700">Dapat diperbarui secara dinamis oleh Admin</span> melalui menu Edit/Unggah Data.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* RUMUS KERENTANAN BANJIR & KEKERINGAN */}
      <section className="relative overflow-hidden bg-slate-50 py-20 lg:py-24 text-gray-900 border-b border-gray-200">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title="Model Kerentanan (Vulnerability Curve)"
            desc="Nilai Loss of Production (LOP) didapatkan dari transformasi nilai piksel hazard berdasarkan fungsi matematika berikut."
          />

          <div className="mt-16 grid gap-8 lg:grid-cols-2">
            
            {/* RUMUS BANJIR */}
            <div className="flex flex-col rounded-[2rem] border border-blue-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 shadow-sm">
                  <Droplets className="h-7 w-7 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Kerentanan Banjir</h3>
                  <p className="text-sm text-gray-500">Ekstraksi LOP berbasis kedalaman</p>
                </div>
              </div>

              {/* Box Rumus */}
              <div className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 mb-6">
                <code className="text-lg font-mono font-semibold text-blue-800">
                  y = 0.2885 &middot; ln(x) + 0.5148
                </code>
              </div>

              <div className="flex-1 space-y-4 text-sm text-gray-700">
                <div>
                  <p className="font-semibold text-gray-900">Keterangan Variabel:</p>
                  <ul className="mt-2 space-y-2 list-disc list-inside ml-2">
                    <li><code className="font-mono bg-blue-50 text-blue-700 px-1 rounded">y</code> = <span className="font-medium">lop_banjir</span></li>
                    <li><code className="font-mono bg-blue-50 text-blue-700 px-1 rounded">x</code> = Kedalaman genangan banjir (meter).</li>
                  </ul>
                </div>
                <div className="rounded-xl bg-blue-50/50 p-4 border border-blue-100">
                  <p className="font-medium text-blue-900 mb-1 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Proses Spasial Zonal:
                  </p>
                  <p className="text-blue-800/80 leading-relaxed">
                    Nilai <code className="font-mono">x</code> didapat dari rata-rata indeks raster (R25-R250, RC25-RC250) per Kabupaten/Kota, yang diekstraksi <strong>secara eksklusif hanya pada poligon tutupan lahan sawah</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* RUMUS KEKERINGAN */}
            <div className="flex flex-col rounded-[2rem] border border-orange-200 bg-white p-8 shadow-sm">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 shadow-sm">
                  <Leaf className="h-7 w-7 text-orange-600" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Kerentanan Kekeringan</h3>
                  <p className="text-sm text-gray-500">Ekstraksi LOP berbasis indeks SPI</p>
                </div>
              </div>

              {/* Box Rumus */}
              <div className="flex w-full flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 mb-6 font-mono text-orange-900 overflow-x-auto">
                <p className="mb-4 text-sm bg-white px-3 py-1 rounded border border-slate-200 shadow-sm">
                  DI = (|x| - |x|<sub>min</sub>) / (|x|<sub>max</sub> - |x|<sub>min</sub>)
                </p>
                
                {/* Visualisasi Pecahan Kompleks dengan HTML/Tailwind */}
                <div className="flex items-center gap-3 text-[15px] sm:text-base font-semibold">
                  <span>LR =</span>
                  <div className="flex flex-col items-center text-center">
                    <span className="border-b-[1.5px] border-orange-900/50 px-2 pb-1.5">
                      [ 1 / (1 + b &middot; e<sup>c &middot; DI</sup>) ] - [ 1 / (1 + b) ]
                    </span>
                    <span className="px-2 pt-1.5">
                      [ 1 / (1 + b &middot; e<sup>c</sup>) ] - [ 1 / (1 + b) ]
                    </span>
                  </div>
                  <span>&times; a</span>
                </div>
              </div>

              <div className="flex-1 space-y-4 text-sm text-gray-700">
                <div>
                  <p className="font-semibold text-gray-900">Keterangan Variabel:</p>
                  <ul className="mt-2 space-y-2 list-disc list-inside ml-2">
                    <li><code className="font-mono bg-orange-50 text-orange-700 px-1 rounded">LR</code> = <span className="font-medium">lop_kekeringan</span></li>
                    <li><code className="font-mono bg-orange-50 text-orange-700 px-1 rounded">x</code> = Nilai raster SPI (mme_rp25-250, gpm_rp25-250).</li>
                    <li>Konstanta: <strong>a = 0.8</strong> | <strong>b = 4</strong> | <strong>c = 6</strong></li>
                  </ul>
                </div>
                <div className="rounded-xl bg-orange-50/50 p-4 border border-orange-100">
                  <p className="font-medium text-orange-900 mb-1 flex items-center gap-2">
                    <Info className="w-4 h-4" /> Proses Spasial Zonal:
                  </p>
                  <p className="text-orange-800/80 leading-relaxed">
                    Sama halnya dengan banjir, nilai indeks raster dirata-ratakan pada batas administrasi <strong>hanya jika berpotongan dengan poligon tutupan lahan sawah</strong>.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* METADATA SECTION DENGAN SPESIFIKASI TEKNIS */}
      <section className="relative overflow-hidden bg-white py-20 lg:py-24 text-gray-900">
        <div className="relative mx-auto w-full max-w-[1400px] px-6 lg:px-10">
          <SectionHeader
            title="Spesifikasi & Metadata Geospasial"
            desc="Katalog sumber data utama beserta parameter teknis yang digunakan sebagai input pemodelan risiko dalam pipeline PADIS."
          />

          <div className="mx-auto mt-16 max-w-4xl">
            <div className="grid gap-6">
              {metadataRules.map((rule, index) => {
                const Icon = rule.icon;
                return (
                  <div 
                    key={index} 
                    className="flex flex-col gap-6 rounded-3xl border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md lg:p-8"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border ${rule.badgeColor}`}>
                          <Icon className={`h-6 w-6 ${rule.iconColor}`} />
                        </div>
                        <div>
                          <h3 className="text-xl font-bold text-gray-900">{rule.name}</h3>
                          <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            <Database className="h-3 w-3" />
                            {rule.source}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm leading-relaxed text-gray-600">
                      {rule.description}
                    </p>

                    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">Parameter Teknis Data</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
                        {rule.specs.map((spec, idx) => (
                          <div key={idx} className="flex justify-between sm:flex-col sm:justify-start">
                            <span className="text-xs text-gray-500">{spec.label}</span>
                            <span className="text-sm font-medium text-gray-900 sm:mt-0.5">{spec.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section className="relative overflow-hidden bg-white pb-20">
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