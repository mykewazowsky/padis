"use client";

import {
  AlertTriangle,
  BookOpen,
  Database,
  Download,
  FileOutput,
  Layers3,
  ShieldCheck,
  Users,
  Workflow,
  ChevronRight,
  FileText,
  TableProperties,
  FolderTree,
  PlayCircle,
  Map,
  LayoutDashboard,
  Star,
  Palette,
  FileSpreadsheet,
  BarChart3,
  Pencil,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type UploadRule = {
  name: string;
  format: string;
  filename: string;
  destination: string;
  notes: string[];
};

type AttributeRule = {
  dataset: string;
  attributes: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
};

type GuideNavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

// ─── Nav ──────────────────────────────────────────────────────────────────────

const guideNavItems: GuideNavItem[] = [
  { id: "overview",           label: "Overview",              icon: BookOpen },
  { id: "upload-standard",    label: "Standar Data",          icon: FolderTree },
  { id: "attribute-standard", label: "Standar Atribut",       icon: TableProperties },
  { id: "menu-guide",         label: "Panduan Menu Admin",    icon: ShieldCheck },
  { id: "usage-flow",         label: "Alur Kerja Admin",      icon: ChevronRight },
  { id: "map-classification", label: "Klasifikasi Peta",      icon: Palette },
  { id: "report-guide",       label: "Panduan Laporan",       icon: FileSpreadsheet },
  { id: "troubleshooting",    label: "Troubleshooting",       icon: AlertTriangle },
];

// ─── Data ─────────────────────────────────────────────────────────────────────

const uploadRules: UploadRule[] = [
  {
    name: "Admin Boundary",
    format: ".gpkg",
    filename: "regions.gpkg",
    destination: "raw/administrasi/",
    notes: [
      "Dipakai sebagai batas wilayah utama untuk agregasi kabupaten/kota.",
      "Wajib memiliki field id_kabkota, kab_kota, dan prov.",
      "Pastikan geometri valid, tidak rusak, dan tidak self-intersect.",
    ],
  },
  {
    name: "Sawah Layer",
    format: ".gpkg",
    filename: "sawah_selected.gpkg",
    destination: "raw/exposure/",
    notes: [
      "Dipakai sebagai layer exposure sawah untuk overlay dan analisis risiko.",
      "Pastikan layer merepresentasikan area sawah aktif yang akan dianalisis.",
      "Disarankan polygon bersih — tidak self-intersect, tidak ada geometri NULL.",
    ],
  },
  {
    name: "Total Produksi Padi",
    format: ".csv",
    filename: "totalproduksipadi.csv",
    destination: "raw/exposure/",
    notes: [
      "Dipakai untuk menghitung nilai kerugian ekonomi (Loss dan AAL).",
      "Gunakan encoding UTF-8 atau UTF-8-SIG.",
      "Gunakan identifier wilayah (id_kabkota) yang konsisten dengan admin boundary.",
    ],
  },
  {
    name: "Raster Hazard Banjir (8 file)",
    format: ".tif",
    filename: "flood_r25.tif, flood_r50.tif, flood_r100.tif, flood_r250.tif, flood_rc25.tif, flood_rc50.tif, flood_rc100.tif, flood_rc250.tif",
    destination: "raw/hazard/",
    notes: [
      "Nama file harus persis sesuai standar agar pipeline dapat membacanya otomatis.",
      "Prefix r* = skenario Baseline; prefix rc* = skenario Projection (perubahan iklim).",
      "Angka suffix = return period: 25, 50, 100, 250 tahun.",
      "Pastikan raster memiliki extent, resolusi, dan CRS yang valid.",
    ],
  },
  {
    name: "Raster Hazard Kekeringan (8 file)",
    format: ".tif",
    filename: "drought_r25.tif, drought_r50.tif, drought_r100.tif, drought_r250.tif, drought_rc25.tif, drought_rc50.tif, drought_rc100.tif, drought_rc250.tif",
    destination: "raw/hazard/",
    notes: [
      "Konvensi penamaan sama dengan raster banjir.",
      "Prefix r* = Baseline; rc* = Projection.",
      "Nilai raster merepresentasikan indeks kekeringan (0–1).",
      "Pastikan raster dapat dibaca oleh GDAL tanpa error.",
    ],
  },
];

const attributeRules: AttributeRule[] = [
  {
    dataset: "Admin Boundary (regions.gpkg)",
    attributes: [
      { name: "id_kabkota",  type: "string / integer", required: true,  description: "Identifier unik kabupaten/kota untuk join dan agregasi data." },
      { name: "kab_kota",    type: "string",           required: true,  description: "Nama kabupaten/kota untuk dashboard, tooltip peta, dan laporan." },
      { name: "prov",        type: "string",           required: true,  description: "Nama provinsi untuk grouping dan tampilan informasi wilayah." },
      { name: "geometry",    type: "polygon/multipolygon", required: true, description: "Geometri batas wilayah yang valid untuk overlay spasial." },
    ],
  },
  {
    dataset: "Total Produksi Padi (totalproduksipadi.csv)",
    attributes: [
      { name: "id_kabkota",       type: "string / integer", required: true,  description: "Identifier wilayah, harus konsisten dengan admin boundary." },
      { name: "kab_kota",         type: "string",           required: true,  description: "Nama kabupaten/kota untuk verifikasi manual." },
      { name: "prov",             type: "string",           required: false, description: "Provinsi — disarankan untuk validasi tambahan." },
      { name: "total_prod_padi",  type: "number (ton)",     required: true,  description: "Total produksi padi (ton) sebagai basis kalkulasi kerugian ekonomi." },
    ],
  },
  {
    dataset: "Sawah Layer (sawah_selected.gpkg)",
    attributes: [
      { name: "geometry", type: "polygon / multipolygon", required: true, description: "Geometri area sawah yang valid dan dapat di-overlay dengan raster hazard." },
    ],
  },
];

const adminMenuGuides = [
  {
    title: "Overview",
    icon: LayoutDashboard,
    desc: "Menampilkan ringkasan sistem: run aktif, statistik jumlah wilayah, status pipeline, dan akses cepat ke semua menu utama.",
  },
  {
    title: "Data Management",
    icon: Database,
    desc: "Melihat preview file data yang tersedia, memeriksa ketersediaan file input (raster, vektor, CSV), dan memilih active source untuk analisis.",
  },
  {
    title: "Process Control",
    icon: PlayCircle,
    desc: "Memilih hazard (Banjir, Kekeringan, Multi-hazard), mengatur parameter run, menjalankan pipeline penuh, dan memantau progress secara langsung.",
  },
  {
    title: "Pipeline Monitor",
    icon: Map,
    desc: "Melihat alur proses (Preprocess → Zonal → Analysis → ETL), riwayat 10 run terakhir (termasuk run ETL standalone), aktivasi run aktif, serta edit nama run dan operator.",
  },
  {
    title: "Outputs",
    icon: FileOutput,
    desc: "Melihat hasil analisis per hazard, preview file output, dan mengunduh file hasil akhir (CSV/GPKG).",
  },
  {
    title: "Users",
    icon: Users,
    desc: "Mengelola akun pengguna: mengubah role (user/admin), mengubah status aktif/nonaktif, dan mereset akses.",
  },
  {
    title: "Admin Guide",
    icon: ShieldCheck,
    desc: "Dokumentasi operasional panel admin: standar data, atribut wajib, alur kerja, klasifikasi peta, dan panduan lengkap dalam format PDF.",
  },
];

const troubleshootingItems = [
  {
    problem: "Preview data kosong di Data Management",
    solution: "Periksa apakah file sudah ditempatkan di folder yang benar dengan nama yang sesuai standar (case-sensitive).",
  },
  {
    problem: "Pipeline gagal di tahap Preprocess",
    solution: "Pastikan semua file raster (.tif) tersedia lengkap (8 file banjir + 8 file kekeringan) dan dapat dibaca GDAL tanpa error.",
  },
  {
    problem: "Pipeline gagal di tahap Analysis",
    solution: "Cek apakah data produksi padi (totalproduksipadi.csv) tersedia dan field total_prod_padi berisi nilai numerik valid.",
  },
  {
    problem: "Hasil tidak muncul di dashboard setelah pipeline selesai",
    solution: "Buka Pipeline Monitor → aktifkan run yang selesai sebagai run aktif menggunakan tombol 'Aktifkan'.",
  },
  {
    problem: "Run ETL standalone tidak muncul di riwayat",
    solution: "Sudah diperbaiki: run dengan source='etl' kini muncul di riwayat. Pastikan backend sudah menggunakan versi terbaru.",
  },
  {
    problem: "Pengguna tidak bisa mengakses admin panel",
    solution: "Pastikan role pengguna adalah 'admin' dan status akun 'active' di menu Users.",
  },
  {
    problem: "Peta tidak menampilkan data setelah filter dipilih",
    solution: "Pastikan run aktif sudah ada dan mengandung data untuk hazard yang dipilih. Cek Pipeline Monitor → Validation.",
  },
  {
    problem: "Laporan PDF gagal di-generate",
    solution: "Pastikan ada data untuk kombinasi hazard + skenario + return period yang dipilih, dan run aktif sudah dikonfirmasi.",
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ eyebrow, title, desc }: { eyebrow: string; title: string; desc: string }) {
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">{desc}</p>
    </div>
  );
}

function GuideSection({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {children}
    </section>
  );
}

// ─── Manual book print function ───────────────────────────────────────────────

function handleDownloadManual() {
  const html = `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8"/>
<title>Manual Book PADIS</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 10pt;
    color: #1e293b;
    line-height: 1.6;
    background: #fff;
  }
  .page { max-width: 720px; margin: 0 auto; padding: 40px 48px; }

  /* Cover */
  .cover {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 80px 48px;
    border-bottom: 3px solid #166534;
    page-break-after: always;
  }
  .cover-label {
    font-size: 9pt;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: #166534;
    margin-bottom: 16px;
  }
  .cover-title {
    font-size: 32pt;
    font-weight: 800;
    line-height: 1.1;
    color: #0f172a;
    margin-bottom: 8px;
  }
  .cover-subtitle {
    font-size: 14pt;
    font-weight: 400;
    color: #475569;
    margin-bottom: 40px;
  }
  .cover-meta {
    font-size: 9pt;
    color: #94a3b8;
    border-top: 1px solid #e2e8f0;
    padding-top: 16px;
    margin-top: 40px;
  }
  .cover-meta strong { color: #475569; }

  /* TOC */
  .toc { page-break-after: always; padding: 56px 0; }
  .toc-title { font-size: 20pt; font-weight: 800; color: #0f172a; margin-bottom: 32px; border-bottom: 2px solid #166534; padding-bottom: 8px; }
  .toc-item { display: flex; justify-content: space-between; align-items: baseline; padding: 7px 0; border-bottom: 1px dotted #e2e8f0; font-size: 10pt; }
  .toc-item-num { font-weight: 700; color: #166534; min-width: 28px; }
  .toc-item-label { flex: 1; padding: 0 8px; color: #334155; }
  .toc-item-page { color: #94a3b8; font-size: 9pt; }
  .toc-sub { padding-left: 28px; font-size: 9pt; color: #64748b; }

  /* Sections */
  .section { page-break-before: always; padding: 48px 0; }
  .section-num { font-size: 9pt; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #166534; margin-bottom: 6px; }
  .section-title { font-size: 18pt; font-weight: 800; color: #0f172a; margin-bottom: 6px; }
  .section-desc { font-size: 10pt; color: #64748b; margin-bottom: 28px; border-bottom: 1px solid #f1f5f9; padding-bottom: 20px; }

  /* Sub-sections */
  h3 { font-size: 11pt; font-weight: 700; color: #0f172a; margin: 22px 0 8px; }
  h4 { font-size: 10pt; font-weight: 600; color: #334155; margin: 14px 0 6px; }
  p { margin-bottom: 8px; font-size: 10pt; color: #334155; }

  /* Tables */
  table { width: 100%; border-collapse: collapse; margin: 16px 0 24px; font-size: 9pt; }
  th { background: #f8fafc; color: #475569; font-weight: 700; text-align: left; padding: 8px 10px; border: 1px solid #e2e8f0; }
  td { padding: 7px 10px; border: 1px solid #e2e8f0; color: #334155; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }

  /* Code / filename */
  code { font-family: 'Consolas', 'Courier New', monospace; font-size: 8.5pt; background: #f1f5f9; padding: 1px 5px; border-radius: 3px; color: #166534; }

  /* Steps */
  .steps { counter-reset: step; margin: 16px 0; }
  .step { display: flex; gap: 12px; margin-bottom: 10px; align-items: flex-start; }
  .step-num { min-width: 24px; height: 24px; background: #166534; color: #fff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 8.5pt; font-weight: 700; flex-shrink: 0; margin-top: 1px; }
  .step-body { font-size: 10pt; color: #334155; padding-top: 2px; }

  /* Badges */
  .badge-req { background: #fee2e2; color: #991b1b; padding: 1px 7px; border-radius: 10px; font-size: 8pt; font-weight: 700; }
  .badge-opt { background: #f1f5f9; color: #475569; padding: 1px 7px; border-radius: 10px; font-size: 8pt; font-weight: 600; }
  .badge-new { background: #dcfce7; color: #166534; padding: 1px 7px; border-radius: 10px; font-size: 8pt; font-weight: 700; }

  /* Callout */
  .callout { border-left: 3px solid #166534; background: #f0fdf4; padding: 10px 14px; border-radius: 0 6px 6px 0; margin: 14px 0; font-size: 9.5pt; color: #166534; }
  .callout-warn { border-color: #d97706; background: #fffbeb; color: #92400e; }
  .callout-info { border-color: #2563eb; background: #eff6ff; color: #1e3a8a; }

  /* Classification table */
  .cls-row { display: flex; align-items: center; gap: 10px; padding: 5px 0; border-bottom: 1px solid #f1f5f9; }
  .cls-swatch { width: 16px; height: 16px; border-radius: 3px; flex-shrink: 0; }

  /* Print */
  @media print {
    body { font-size: 10pt; }
    .cover { min-height: auto; padding: 60px 0; }
    .page { padding: 0; }
    .section { page-break-before: always; }
    .no-break { page-break-inside: avoid; }
  }
</style>
</head>
<body>
<div class="page">

<!-- ═══ COVER ═══════════════════════════════════════════════════════════════ -->
<div class="cover">
  <div class="cover-label">Manual Book · Sistem PADIS</div>
  <div class="cover-title">PADIS</div>
  <div class="cover-subtitle">Paddy Disaster Information System<br/>Panduan Operasional Lengkap</div>
  <p style="color:#475569;font-size:10pt;max-width:480px;line-height:1.7;">
    Dokumentasi operasional sistem analisis risiko bencana lahan sawah berbasis GIS.
    Mencakup standar data, alur pipeline, penggunaan panel admin, interpretasi peta,
    dan panduan laporan.
  </p>
  <div class="cover-meta">
    <strong>Versi:</strong> 1.0 &nbsp;·&nbsp;
    <strong>Tahun:</strong> 2025 &nbsp;·&nbsp;
    <strong>Platform:</strong> Web Application (Next.js + Flask) &nbsp;·&nbsp;
    <strong>Akses:</strong> Admin Internal
  </div>
</div>

<!-- ═══ DAFTAR ISI ══════════════════════════════════════════════════════════ -->
<div class="toc">
  <div class="toc-title">Daftar Isi</div>
  <div class="toc-item"><span class="toc-item-num">1</span><span class="toc-item-label">Pendahuluan & Arsitektur Sistem</span></div>
  <div class="toc-item toc-sub"><span class="toc-item-num"></span><span class="toc-item-label">1.1 Gambaran Umum PADIS</span></div>
  <div class="toc-item toc-sub"><span class="toc-item-num"></span><span class="toc-item-label">1.2 Komponen Sistem</span></div>
  <div class="toc-item toc-sub"><span class="toc-item-num"></span><span class="toc-item-label">1.3 Skenario Analisis</span></div>
  <div class="toc-item"><span class="toc-item-num">2</span><span class="toc-item-label">Standar Data Input</span></div>
  <div class="toc-item toc-sub"><span class="toc-item-num"></span><span class="toc-item-label">2.1 Struktur Folder</span></div>
  <div class="toc-item toc-sub"><span class="toc-item-num"></span><span class="toc-item-label">2.2 Standar File & Atribut</span></div>
  <div class="toc-item"><span class="toc-item-num">3</span><span class="toc-item-label">Panel Admin — Panduan Menu</span></div>
  <div class="toc-item toc-sub"><span class="toc-item-num"></span><span class="toc-item-label">3.1–3.7 Setiap Menu</span></div>
  <div class="toc-item"><span class="toc-item-num">4</span><span class="toc-item-label">Pipeline Analisis</span></div>
  <div class="toc-item toc-sub"><span class="toc-item-num"></span><span class="toc-item-label">4.1 Tahapan Pipeline</span></div>
  <div class="toc-item toc-sub"><span class="toc-item-num"></span><span class="toc-item-label">4.2 Alur Kerja Admin</span></div>
  <div class="toc-item"><span class="toc-item-num">5</span><span class="toc-item-label">Klasifikasi & Visualisasi Peta</span></div>
  <div class="toc-item"><span class="toc-item-num">6</span><span class="toc-item-label">Laporan Analisis</span></div>
  <div class="toc-item"><span class="toc-item-num">7</span><span class="toc-item-label">Troubleshooting</span></div>
  <div class="toc-item"><span class="toc-item-num">8</span><span class="toc-item-label">Referensi Teknis</span></div>
</div>

<!-- ═══ 1. PENDAHULUAN ══════════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-num">Bab 1</div>
  <div class="section-title">Pendahuluan & Arsitektur Sistem</div>
  <div class="section-desc">Gambaran umum sistem, tujuan, dan komponen teknis PADIS.</div>

  <h3>1.1 Gambaran Umum PADIS</h3>
  <p>
    PADIS (<em>Paddy Disaster Information System</em>) adalah sistem informasi berbasis web untuk
    analisis dan visualisasi risiko bencana pada lahan sawah di Indonesia. Sistem ini mengintegrasikan
    data hazard (banjir dan kekeringan), data exposure (sawah dan produksi padi), serta
    metodologi analisis kerugian ekonomi untuk menghasilkan informasi risiko per kabupaten/kota.
  </p>
  <p>
    Output utama sistem adalah peta risiko interaktif, ringkasan kerugian langsung (Loss) dan
    kerugian tahunan rata-rata (AAL), serta laporan analisis dalam format PDF dan Excel.
  </p>

  <h3>1.2 Komponen Sistem</h3>
  <table>
    <tr><th>Komponen</th><th>Teknologi</th><th>Fungsi</th></tr>
    <tr><td>Frontend</td><td>Next.js (React), Tailwind CSS, Leaflet</td><td>Dashboard, peta interaktif, panel admin</td></tr>
    <tr><td>Backend API</td><td>Flask (Python)</td><td>REST API, autentikasi, serve vector tiles</td></tr>
    <tr><td>Database</td><td>PostgreSQL + PostGIS (Supabase)</td><td>Simpan hasil analisis, manajemen run, user</td></tr>
    <tr><td>Pipeline</td><td>Python (GDAL, Shapely, Pandas)</td><td>Preprocess → Zonal → Analysis → ETL</td></tr>
    <tr><td>Tiles</td><td>MVT / Protobuf via leaflet.vectorgrid</td><td>Render layer risiko di peta</td></tr>
  </table>

  <h3>1.3 Skenario Analisis</h3>
  <p>Setiap analisis menggunakan kombinasi tiga parameter:</p>
  <table>
    <tr><th>Parameter</th><th>Nilai</th><th>Keterangan</th></tr>
    <tr><td>Hazard</td><td>Banjir, Kekeringan, Multi-hazard</td><td>Jenis bahaya yang dianalisis</td></tr>
    <tr><td>Return Period</td><td>RP25, RP50, RP100, RP250</td><td>Periode ulang kejadian (tahun)</td></tr>
    <tr><td>Skenario</td><td>Baseline (r*), Projection (rc*)</td><td>Parameter standar pemodelan hazard vs proyeksi skenario masa depan (RCP/SSP)</td></tr>
  </table>
  <div class="callout">
    Total kombinasi per run penuh: 3 hazard × 4 RP × 2 skenario = 24 kombinasi analisis.
  </div>
</div>

<!-- ═══ 2. STANDAR DATA ════════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-num">Bab 2</div>
  <div class="section-title">Standar Data Input</div>
  <div class="section-desc">Format, lokasi, dan atribut minimum yang wajib dipenuhi sebelum menjalankan pipeline.</div>

  <h3>2.1 Struktur Folder</h3>
  <table>
    <tr><th>Folder</th><th>Isi</th></tr>
    <tr><td><code>raw/administrasi/</code></td><td>Admin boundary (regions.gpkg)</td></tr>
    <tr><td><code>raw/exposure/</code></td><td>Sawah layer + data produksi padi CSV</td></tr>
    <tr><td><code>raw/hazard/</code></td><td>Raster hazard banjir dan kekeringan (16 file)</td></tr>
    <tr><td><code>data/output/</code></td><td>Hasil analisis pipeline (CSV, GPKG)</td></tr>
  </table>

  <h3>2.2 Standar File & Nama</h3>

  <h4>Admin Boundary</h4>
  <table>
    <tr><th>Field</th><th>Tipe</th><th>Status</th><th>Keterangan</th></tr>
    <tr><td><code>id_kabkota</code></td><td>string/int</td><td><span class="badge-req">Required</span></td><td>Identifier unik kabupaten/kota</td></tr>
    <tr><td><code>kab_kota</code></td><td>string</td><td><span class="badge-req">Required</span></td><td>Nama kabupaten/kota</td></tr>
    <tr><td><code>prov</code></td><td>string</td><td><span class="badge-req">Required</span></td><td>Nama provinsi</td></tr>
  </table>

  <h4>Data Produksi Padi CSV</h4>
  <table>
    <tr><th>Field</th><th>Tipe</th><th>Status</th><th>Keterangan</th></tr>
    <tr><td><code>id_kabkota</code></td><td>string/int</td><td><span class="badge-req">Required</span></td><td>Harus konsisten dengan admin boundary</td></tr>
    <tr><td><code>kab_kota</code></td><td>string</td><td><span class="badge-req">Required</span></td><td>Nama wilayah untuk verifikasi</td></tr>
    <tr><td><code>total_prod_padi</code></td><td>number (ton)</td><td><span class="badge-req">Required</span></td><td>Basis kalkulasi kerugian ekonomi</td></tr>
    <tr><td><code>prov</code></td><td>string</td><td><span class="badge-opt">Optional</span></td><td>Provinsi untuk validasi tambahan</td></tr>
  </table>

  <h4>Raster Hazard — Konvensi Nama File</h4>
  <table>
    <tr><th>Hazard</th><th>Baseline (r*)</th><th>Projection (rc*)</th></tr>
    <tr><td>Banjir</td><td>flood_r25.tif, flood_r50.tif, flood_r100.tif, flood_r250.tif</td><td>flood_rc25.tif, flood_rc50.tif, flood_rc100.tif, flood_rc250.tif</td></tr>
    <tr><td>Kekeringan</td><td>drought_r25.tif, drought_r50.tif, drought_r100.tif, drought_r250.tif</td><td>drought_rc25.tif, drought_rc50.tif, drought_rc100.tif, drought_rc250.tif</td></tr>
  </table>
  <div class="callout callout-warn">
    Nama file bersifat case-sensitive. Perbedaan satu karakter akan menyebabkan pipeline tidak mengenali file dan gagal di tahap Preprocess.
  </div>
</div>

<!-- ═══ 3. PANEL ADMIN ════════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-num">Bab 3</div>
  <div class="section-title">Panel Admin — Panduan Menu</div>
  <div class="section-desc">Fungsi dan cara penggunaan setiap menu di panel admin PADIS.</div>

  <h3>3.1 Overview</h3>
  <p>Halaman utama admin. Menampilkan:</p>
  <ul style="margin:8px 0 16px 20px;color:#334155;font-size:10pt;">
    <li>Ringkasan run aktif dan statistik sistem</li>
    <li>Status pipeline terkini</li>
    <li>Akses cepat ke semua menu utama</li>
  </ul>

  <h3>3.2 Data Management</h3>
  <p>Digunakan untuk memverifikasi ketersediaan file data sebelum menjalankan pipeline.</p>
  <ul style="margin:8px 0 16px 20px;color:#334155;font-size:10pt;">
    <li>Preview file yang tersedia di server</li>
    <li>Cek ketersediaan raster, vektor, dan CSV</li>
    <li>Pilih active source untuk analisis</li>
  </ul>

  <h3>3.3 Process Control</h3>
  <p>Digunakan untuk menjalankan pipeline analisis.</p>
  <div class="steps">
    <div class="step"><div class="step-num">1</div><div class="step-body">Pilih hazard: Banjir, Kekeringan, atau Multi-hazard</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-body">Isi run name dan operator (opsional)</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-body">Klik Jalankan Pipeline</div></div>
    <div class="step"><div class="step-num">4</div><div class="step-body">Pantau progress di panel live atau di Pipeline Monitor</div></div>
  </div>

  <h3>3.4 Pipeline Monitor</h3>
  <p>Menampilkan riwayat run dan status pipeline secara real-time (auto-refresh 4 detik).</p>
  <table>
    <tr><th>Fitur</th><th>Keterangan</th></tr>
    <tr><td>Riwayat Run</td><td>10 run terakhir, diurutkan berdasarkan ID (terbaru di atas). Mencakup run pipeline dan run ETL standalone.</td></tr>
    <tr><td>Edit Metadata</td><td>Klik ikon pensil pada kolom Run Name, Operator, atau Tahun Model untuk mengubah nilai secara inline.</td></tr>
    <tr><td>Aktifkan Run</td><td>Tombol 'Aktifkan' tersedia untuk run berstatus success. Setelah diaktifkan, dashboard publik menggunakan data run ini.</td></tr>
    <tr><td>Hapus Run</td><td>Menghapus run beserta semua data turunannya (AAL, Loss, Zonal). Memerlukan konfirmasi ID run.</td></tr>
    <tr><td>Validasi</td><td>Sebelum aktivasi/hapus, sistem menampilkan jumlah kabupaten per hazard per tabel sebagai ringkasan kelengkapan data.</td></tr>
  </table>

  <h3>3.5 Outputs</h3>
  <p>Menampilkan file hasil analisis: CSV agregasi per kabupaten dan file GPKG untuk GIS.</p>

  <h3>3.6 Users</h3>
  <p>Manajemen pengguna: ubah role (user/admin), ubah status aktif/nonaktif.</p>
  <div class="callout callout-warn">
    Run aktif tidak dapat dihapus. Aktifkan run lain terlebih dahulu sebelum menghapus run yang sedang aktif.
  </div>

  <h3>3.7 Admin Guide</h3>
  <p>Halaman ini. Berisi dokumentasi lengkap dan tombol unduh Manual Book PDF.</p>
</div>

<!-- ═══ 4. PIPELINE ═══════════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-num">Bab 4</div>
  <div class="section-title">Pipeline Analisis</div>
  <div class="section-desc">Alur tahapan pipeline dari data mentah hingga hasil yang siap ditampilkan di dashboard.</div>

  <h3>4.1 Tahapan Pipeline</h3>
  <table>
    <tr><th>#</th><th>Tahap</th><th>Proses</th><th>Output</th></tr>
    <tr><td>1</td><td><strong>Preprocess</strong></td><td>Reproyeksi raster ke CRS standar, interseksi geometri sawah dengan admin boundary</td><td>Raster terproyeksi, sawah per kabupaten</td></tr>
    <tr><td>2</td><td><strong>Zonal</strong></td><td>Statistik zonal: rata-rata nilai hazard per sawah per kabupaten untuk setiap kombinasi RP & skenario</td><td>Tabel zonal_kabupaten di DB</td></tr>
    <tr><td>3</td><td><strong>Analysis</strong></td><td>LOP (Level of Protection) → Loss (kerugian langsung IDR) → AAL (kerugian tahunan rata-rata IDR)</td><td>Tabel losses dan aal di DB</td></tr>
    <tr><td>4</td><td><strong>ETL</strong></td><td>Load hasil ke database, update geometri vektor tile, aktivasi run</td><td>Data siap dashboard dan peta</td></tr>
  </table>

  <h3>4.2 Alur Kerja Admin (SOP)</h3>
  <div class="steps">
    <div class="step"><div class="step-num">1</div><div class="step-body"><strong>Siapkan data input</strong> — tempatkan semua file di folder yang benar dengan nama standar.</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-body"><strong>Verifikasi di Data Management</strong> — pastikan semua file terdeteksi sistem.</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-body"><strong>Jalankan pipeline di Process Control</strong> — pilih hazard, isi nama run, klik Jalankan.</div></div>
    <div class="step"><div class="step-num">4</div><div class="step-body"><strong>Pantau di Pipeline Monitor</strong> — cek progress dan status setiap tahap.</div></div>
    <div class="step"><div class="step-num">5</div><div class="step-body"><strong>Validasi hasil</strong> — setelah selesai, klik ikon validasi untuk melihat kelengkapan data per hazard.</div></div>
    <div class="step"><div class="step-num">6</div><div class="step-body"><strong>Aktifkan run</strong> — klik 'Aktifkan' di Pipeline Monitor agar dashboard menggunakan data terbaru.</div></div>
    <div class="step"><div class="step-num">7</div><div class="step-body"><strong>Verifikasi dashboard</strong> — buka dashboard publik dan periksa peta serta statistik.</div></div>
  </div>

  <div class="callout">
    Pipeline multi-hazard secara otomatis menjalankan analisis banjir + kekeringan + gabungan dalam satu proses.
  </div>
</div>

<!-- ═══ 5. KLASIFIKASI PETA ══════════════════════════════════════════════ -->
<div class="section">
  <div class="section-num">Bab 5</div>
  <div class="section-title">Klasifikasi & Visualisasi Peta</div>
  <div class="section-desc">Skema klasifikasi warna untuk setiap layer peta dan cara menginterpretasikan nilai yang ditampilkan.</div>

  <h3>5.1 Layer yang Tersedia</h3>
  <table>
    <tr><th>Layer</th><th>Nilai</th><th>Klasifikasi</th></tr>
    <tr><td>Indeks Hazard (Banjir)</td><td>Kedalaman genangan (m)</td><td>Kelas tetap: &lt;0.5, 0.5–1, 1–2, 2–3.5, ≥3.5 m</td></tr>
    <tr><td>Indeks Hazard (Kekeringan)</td><td>Indeks kekeringan 0–1</td><td>Kelas tetap: &lt;0.30, 0.30–0.45, 0.45–0.60, 0.60–0.75, ≥0.75</td></tr>
    <tr><td>Kerugian Langsung (Loss)</td><td>IDR per kabupaten</td><td>Kelas tetap IDR: &lt;10M, 10M–100M, 100M–500M, 500M–2T, &gt;2T</td></tr>
    <tr><td>Risiko Tahunan (AAL)</td><td>IDR per kabupaten per tahun</td><td>Kelas tetap IDR: &lt;1M, 1M–10M, 10M–50M, 50M–100M, &gt;100M</td></tr>
    <tr><td>Produksi Padi</td><td>Ton per kabupaten</td><td>Kuantil 5 kelas</td></tr>
  </table>

  <h3>5.2 Mode Indeks 0–1 (Normalized)</h3>
  <p>
    Selain mode IDR, layer Loss dan AAL dapat ditampilkan dalam mode indeks relatif 0–1 (GEM-style).
    Nilai dinormalisasi terhadap maksimum run aktif.
  </p>
  <table>
    <tr><th>Kelas</th><th>Range Indeks</th><th>Interpretasi</th></tr>
    <tr><td>Sangat Rendah</td><td>0.00 – 0.01</td><td>Risiko sangat rendah relatif terhadap wilayah paling terdampak</td></tr>
    <tr><td>Rendah</td><td>0.01 – 0.05</td><td>Risiko rendah</td></tr>
    <tr><td>Sedang</td><td>0.05 – 0.15</td><td>Risiko sedang</td></tr>
    <tr><td>Tinggi</td><td>0.15 – 0.30</td><td>Risiko tinggi</td></tr>
    <tr><td>Sangat Tinggi</td><td>0.30 – 1.00</td><td>Termasuk wilayah terdampak paling parah</td></tr>
  </table>
  <p>Toggle mode IDR ↔ Indeks 0–1 tersedia di tombol dalam panel legenda peta.</p>

  <h3>5.3 Palet Warna</h3>
  <p>Semua layer menggunakan palet diverging hijau–kuning–merah (green=risiko rendah, merah=risiko tinggi), konsisten di seluruh skenario untuk memudahkan perbandingan visual.</p>
</div>

<!-- ═══ 6. LAPORAN ════════════════════════════════════════════════════════ -->
<div class="section">
  <div class="section-num">Bab 6</div>
  <div class="section-title">Laporan Analisis</div>
  <div class="section-desc">Cara menghasilkan laporan PDF dan Excel dari hasil analisis PADIS.</div>

  <h3>6.1 Jenis Laporan</h3>
  <table>
    <tr><th>Jenis</th><th>Format</th><th>Isi</th></tr>
    <tr><td>Laporan Regional</td><td>PDF (print)</td><td>Ringkasan risiko satu kabupaten: Loss, AAL, perbandingan Baseline vs Projection, grafik</td></tr>
    <tr><td>Laporan Nasional</td><td>PDF (print)</td><td>Ringkasan agregat seluruh Indonesia: top wilayah terdampak, perbandingan AAL, peta nasional</td></tr>
    <tr><td>Ekspor Data</td><td>Excel (.xlsx)</td><td>Data tabular lengkap per kabupaten, semua kombinasi hazard/RP/skenario</td></tr>
  </table>

  <h3>6.2 Cara Generate Laporan</h3>
  <div class="steps">
    <div class="step"><div class="step-num">1</div><div class="step-body">Buka Dashboard → pilih hazard, return period, dan skenario (Baseline/Projection) yang diinginkan.</div></div>
    <div class="step"><div class="step-num">2</div><div class="step-body">Klik tombol <strong>Laporan</strong> di dashboard untuk membuka dialog laporan.</div></div>
    <div class="step"><div class="step-num">3</div><div class="step-body">Pilih jenis laporan: Regional (satu wilayah) atau Nasional (seluruh Indonesia).</div></div>
    <div class="step"><div class="step-num">4</div><div class="step-body">Klik <strong>Preview</strong> untuk melihat laporan, lalu <strong>Print / Save as PDF</strong> via dialog print browser.</div></div>
    <div class="step"><div class="step-num">5</div><div class="step-body">Untuk ekspor Excel: klik tombol Excel di dialog laporan (memerlukan autentikasi).</div></div>
  </div>

  <div class="callout callout-info">
    Laporan mengambil data dari run yang sedang aktif. Pastikan run aktif sudah dikonfirmasi di Pipeline Monitor sebelum generate laporan.
  </div>
</div>

<!-- ═══ 7. TROUBLESHOOTING ═══════════════════════════════════════════════ -->
<div class="section">
  <div class="section-num">Bab 7</div>
  <div class="section-title">Troubleshooting</div>
  <div class="section-desc">Referensi cepat untuk masalah yang paling sering ditemui.</div>

  <table>
    <tr><th>Masalah</th><th>Solusi</th></tr>
    <tr><td>Preview data kosong di Data Management</td><td>Periksa nama file dan lokasi folder. Nama file bersifat case-sensitive.</td></tr>
    <tr><td>Pipeline gagal di tahap Preprocess</td><td>Pastikan semua 16 file raster tersedia dan dapat dibaca GDAL.</td></tr>
    <tr><td>Pipeline gagal di tahap Analysis</td><td>Cek file CSV produksi padi — field total_prod_padi harus berisi nilai numerik.</td></tr>
    <tr><td>Hasil tidak muncul di dashboard</td><td>Aktifkan run di Pipeline Monitor. Dashboard hanya membaca run yang aktif.</td></tr>
    <tr><td>Run ETL tidak muncul di riwayat</td><td>Sudah diperbaiki di versi ini. Pastikan backend menggunakan versi terbaru.</td></tr>
    <tr><td>Pengguna tidak bisa akses admin</td><td>Cek role = 'admin' dan status = 'active' di menu Users.</td></tr>
    <tr><td>Peta kosong meski run sudah aktif</td><td>Verifikasi run di Pipeline Monitor → klik Aktifkan lalu cek tab Validasi untuk kelengkapan data per hazard.</td></tr>
    <tr><td>Laporan PDF tidak bisa di-generate</td><td>Pastikan ada data untuk kombinasi filter yang dipilih dan run aktif sudah dikonfirmasi.</td></tr>
  </table>
</div>

<!-- ═══ 8. REFERENSI TEKNIS ══════════════════════════════════════════════ -->
<div class="section" style="page-break-after:auto;">
  <div class="section-num">Bab 8</div>
  <div class="section-title">Referensi Teknis</div>
  <div class="section-desc">Ringkasan parameter, konstanta, dan endpoint yang relevan untuk administrator teknis.</div>

  <h3>8.1 Konstanta Klasifikasi</h3>
  <table>
    <tr><th>Layer</th><th>Break Points</th><th>Satuan</th></tr>
    <tr><td>Loss (IDR)</td><td>10M · 100M · 500M · 2T · ∞</td><td>Rupiah</td></tr>
    <tr><td>AAL (IDR)</td><td>1M · 10M · 50M · 100M · ∞</td><td>Rupiah/tahun</td></tr>
    <tr><td>Loss/AAL (Indeks)</td><td>0.01 · 0.05 · 0.15 · 0.30 · 1.0</td><td>Indeks 0–1</td></tr>
    <tr><td>Banjir</td><td>0.5 · 1.0 · 2.0 · 3.5 · ∞</td><td>Meter</td></tr>
    <tr><td>Kekeringan</td><td>0.30 · 0.45 · 0.60 · 0.75 · 1.0</td><td>Indeks</td></tr>
  </table>

  <h3>8.2 Endpoint Admin Utama</h3>
  <table>
    <tr><th>Endpoint</th><th>Method</th><th>Fungsi</th></tr>
    <tr><td><code>/api/admin/runs</code></td><td>GET</td><td>List 10 run terakhir (source=local/etl)</td></tr>
    <tr><td><code>/api/admin/runs/&lt;id&gt;</code></td><td>PATCH</td><td>Edit run_name / operator_name</td></tr>
    <tr><td><code>/api/admin/runs/&lt;id&gt;/activate</code></td><td>PATCH</td><td>Aktifkan run sebagai sumber data dashboard</td></tr>
    <tr><td><code>/api/admin/runs/&lt;id&gt;/validate</code></td><td>GET</td><td>Cek kelengkapan data run per tabel per hazard</td></tr>
    <tr><td><code>/api/admin/runs/&lt;id&gt;</code></td><td>DELETE</td><td>Hapus run + semua data turunannya</td></tr>
    <tr><td><code>/api/admin/run-status</code></td><td>GET</td><td>Status pipeline real-time</td></tr>
  </table>

  <h3>8.3 Source Flag pada Tabel Runs</h3>
  <table>
    <tr><th>source</th><th>Asal</th><th>Muncul di Monitor</th></tr>
    <tr><td><code>'local'</code></td><td>Pipeline dijalankan via Process Control</td><td>Ya</td></tr>
    <tr><td><code>'etl'</code></td><td>ETL dijalankan standalone via script</td><td>Ya (versi terbaru)</td></tr>
    <tr><td><code>NULL</code></td><td>Run legacy / migrasi lama</td><td>Tidak</td></tr>
  </table>

  <div style="margin-top:48px;border-top:2px solid #e2e8f0;padding-top:20px;text-align:center;color:#94a3b8;font-size:8.5pt;">
    PADIS Manual Book · Versi 1.0 · Dokumen Internal Admin ·
    Dicetak dari panel admin PADIS
  </div>
</div>

</div><!-- /page -->
</body>
</html>`;

  const win = window.open("", "_blank", "width=900,height=700");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 600);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AdminGuidePage() {
  return (
    <main className="space-y-6">

      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <section
        id="overview"
        className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">ADMIN GUIDE</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Panduan Admin PADIS
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
              Dokumentasi operasional lengkap untuk admin PADIS — standar data, alur pipeline,
              penggunaan setiap menu, klasifikasi peta, dan panduan laporan.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleDownloadManual}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
            >
              <Download className="h-4 w-4" />
              Download Manual Book PDF
            </button>
            <div className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-4 py-3 text-center">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-secondary-dark)]">Ruang Lingkup</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">Panel Admin Internal</p>
            </div>
          </div>
        </div>

        {/* Quick nav + info cards */}
        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-4 xl:sticky xl:top-24">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-white p-2 shadow-sm">
                <FileText className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">Navigasi Cepat</p>
                <p className="text-xs text-slate-500">Lompat ke bagian yang dibutuhkan</p>
              </div>
            </div>
            <div className="space-y-2">
              {guideNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--color-primary)]"
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 opacity-60" />
                  </a>
                );
              })}
            </div>
          </aside>

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-2 shadow-sm"><BookOpen className="h-4 w-4 text-blue-600" /></div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">Tujuan Panduan</p>
                    <p className="mt-1 text-sm text-blue-800">Membantu admin memahami seluruh operasional sistem dari input data hingga dashboard publik.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-2 shadow-sm"><Workflow className="h-4 w-4 text-emerald-600" /></div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">Cakupan</p>
                    <p className="mt-1 text-sm text-emerald-800">Data, pipeline, monitoring run, klasifikasi peta, laporan, dan manajemen pengguna.</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-2 shadow-sm"><AlertTriangle className="h-4 w-4 text-amber-600" /></div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">Catatan Penting</p>
                    <p className="mt-1 text-sm text-amber-800">Nama file bersifat case-sensitive. Format dan atribut data harus sesuai standar sebelum menjalankan pipeline.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* System summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Hazard", value: "3 jenis", sub: "Banjir · Kekeringan · Multi" },
                { label: "Return Period", value: "4 RP", sub: "25 · 50 · 100 · 250 tahun" },
                { label: "Skenario", value: "2 mode", sub: "Baseline · Projection" },
                { label: "Kombinasi", value: "24 total", sub: "per run penuh" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{s.label}</p>
                  <p className="mt-1 text-lg font-bold text-slate-900">{s.value}</p>
                  <p className="text-[10px] text-slate-500">{s.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Standar Data ──────────────────────────────────────────────────── */}
      <GuideSection id="upload-standard">
        <SectionHeader
          eyebrow="STANDAR DATA"
          title="Penempatan & Format File Data"
          desc="Tempatkan file dengan nama dan lokasi yang tepat agar pipeline dapat membaca dan memproses data secara otomatis. Nama file bersifat case-sensitive."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {uploadRules.map((item) => (
            <div key={item.name} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-bold text-slate-900">{item.name}</h3>
              <div className="mt-3 space-y-1.5 text-sm text-slate-600">
                <p><span className="font-semibold text-slate-800">Format:</span> <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">{item.format}</code></p>
                <p><span className="font-semibold text-slate-800">Nama file:</span> <span className="font-mono text-xs text-emerald-700">{item.filename}</span></p>
                <p><span className="font-semibold text-slate-800">Folder:</span> <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs text-slate-700">{item.destination}</code></p>
              </div>
              <div className="mt-3 space-y-2">
                {item.notes.map((note, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-600">{note}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GuideSection>

      {/* ── Standar Atribut ───────────────────────────────────────────────── */}
      <GuideSection id="attribute-standard">
        <SectionHeader
          eyebrow="STANDAR ATRIBUT"
          title="Atribut Wajib dan Disarankan"
          desc="Pastikan data memiliki field minimum untuk agregasi, join, analisis, dan tampilan dashboard."
        />
        <div className="space-y-5">
          {attributeRules.map((rule) => (
            <div key={rule.dataset} className="overflow-hidden rounded-3xl border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-3">
                <h3 className="text-sm font-bold text-slate-900">{rule.dataset}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-white">
                      {["Field", "Tipe", "Status", "Keterangan"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rule.attributes.map((attr) => (
                      <tr key={attr.name} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-900">{attr.name}</td>
                        <td className="px-4 py-3 text-slate-500">{attr.type}</td>
                        <td className="px-4 py-3">
                          <span className={attr.required
                            ? "rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600"
                            : "rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500"}>
                            {attr.required ? "Required" : "Optional"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{attr.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </GuideSection>

      {/* ── Panduan Menu ──────────────────────────────────────────────────── */}
      <GuideSection id="menu-guide">
        <SectionHeader
          eyebrow="PANDUAN MENU ADMIN"
          title="Fungsi Setiap Menu"
          desc="Ringkasan fungsi inti tiap halaman di panel admin PADIS."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {adminMenuGuides.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <Icon className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pipeline Monitor detail */}
        <div className="mt-5 rounded-3xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Star className="mt-0.5 h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />
            <div>
              <p className="text-sm font-bold text-amber-900">Pipeline Monitor — Fitur Terbaru</p>
              <ul className="mt-2 space-y-1 text-sm text-amber-800">
                <li>• Riwayat diurutkan berdasarkan <strong>ID run</strong> (terbaru selalu di atas), bukan <code>created_at</code> yang bisa NULL</li>
                <li>• Run ETL standalone (<code>source='etl'</code>) kini ikut tampil di riwayat</li>
                <li>• Kolom <strong>#ID</strong> ditambahkan untuk identifikasi run yang mudah</li>
                <li>• Edit <strong>Run Name</strong> dan <strong>Operator</strong> langsung inline via ikon pensil (<Pencil className="inline h-3 w-3" />)</li>
              </ul>
            </div>
          </div>
        </div>
      </GuideSection>

      {/* ── Alur Kerja ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <GuideSection id="usage-flow">
          <SectionHeader
            eyebrow="ALUR KERJA ADMIN"
            title="SOP Operasional"
            desc="Urutan langkah yang disarankan untuk menjalankan PADIS secara aman dan konsisten."
          />
          <div className="space-y-3">
            {[
              { step: "Siapkan data input", detail: "Tempatkan semua file di folder yang benar dengan nama sesuai standar." },
              { step: "Verifikasi di Data Management", detail: "Pastikan semua file terdeteksi sistem sebelum menjalankan proses." },
              { step: "Jalankan pipeline di Process Control", detail: "Pilih hazard, isi nama run, klik Jalankan Pipeline." },
              { step: "Pantau di Pipeline Monitor", detail: "Cek progress setiap tahap: Preprocess → Zonal → Analysis → ETL." },
              { step: "Validasi hasil", detail: "Klik ikon validasi untuk memastikan kelengkapan data per hazard per tabel." },
              { step: "Aktifkan run", detail: "Klik 'Aktifkan' agar dashboard publik menggunakan data run ini." },
              { step: "Verifikasi dashboard", detail: "Buka dashboard publik dan periksa peta serta statistik tampil dengan benar." },
            ].map((item, idx) => (
              <div key={idx} className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-bold text-white">
                  {idx + 1}
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">{item.step}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </GuideSection>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader eyebrow="PIPELINE" title="Tahapan Proses" desc="Alur analisis dari data mentah ke output." />
          <div className="space-y-3">
            {[
              { label: "Preprocess", color: "bg-blue-100 text-blue-700", desc: "Reproyeksi raster + interseksi sawah–admin" },
              { label: "Zonal", color: "bg-purple-100 text-purple-700", desc: "Statistik zonal per kabupaten per RP" },
              { label: "Analysis", color: "bg-amber-100 text-amber-700", desc: "LOP → Loss → AAL per hazard" },
              { label: "ETL", color: "bg-emerald-100 text-emerald-700", desc: "Load ke database + aktivasi run" },
            ].map((s) => (
              <div key={s.label} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <span className={`rounded-lg px-2.5 py-1 text-xs font-bold ${s.color}`}>{s.label}</span>
                <p className="text-sm text-slate-600">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Klasifikasi Peta ──────────────────────────────────────────────── */}
      <GuideSection id="map-classification">
        <SectionHeader
          eyebrow="KLASIFIKASI PETA"
          title="Skema Warna & Kelas"
          desc="Referensi kelas warna untuk setiap layer peta. Semua layer menggunakan palet hijau (rendah) → kuning → merah (tinggi)."
        />
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {[
            {
              title: "Kerugian Langsung (Loss) — mode IDR",
              icon: BarChart3,
              rows: [
                { color: "#1a9850", label: "< Rp 10 M" },
                { color: "#91cf60", label: "Rp 10 M – 100 M" },
                { color: "#fee08b", label: "Rp 100 M – 500 M" },
                { color: "#fc8d59", label: "Rp 500 M – 2 T" },
                { color: "#d73027", label: "> Rp 2 T" },
              ],
            },
            {
              title: "Risiko Tahunan (AAL) — mode IDR",
              icon: BarChart3,
              rows: [
                { color: "#1a9850", label: "< Rp 1 M / tahun" },
                { color: "#91cf60", label: "Rp 1 M – 10 M / tahun" },
                { color: "#fee08b", label: "Rp 10 M – 50 M / tahun" },
                { color: "#fc8d59", label: "Rp 50 M – 100 M / tahun" },
                { color: "#d73027", label: "> Rp 100 M / tahun" },
              ],
            },
            {
              title: "Loss / AAL — mode Indeks 0–1",
              icon: Palette,
              rows: [
                { color: "#1a9850", label: "0.00 – 0.01  (Sangat Rendah)" },
                { color: "#91cf60", label: "0.01 – 0.05  (Rendah)" },
                { color: "#fee08b", label: "0.05 – 0.15  (Sedang)" },
                { color: "#fc8d59", label: "0.15 – 0.30  (Tinggi)" },
                { color: "#d73027", label: "0.30 – 1.00  (Sangat Tinggi)" },
              ],
            },
            {
              title: "Indeks Hazard Banjir",
              icon: Layers3,
              rows: [
                { color: "#1a9850", label: "< 0.5 m" },
                { color: "#91cf60", label: "0.5 – 1.0 m" },
                { color: "#fee08b", label: "1.0 – 2.0 m" },
                { color: "#fc8d59", label: "2.0 – 3.5 m" },
                { color: "#d73027", label: "≥ 3.5 m" },
              ],
            },
          ].map((block) => {
            const Icon = block.icon;
            return (
              <div key={block.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="mb-4 flex items-center gap-2.5">
                  <div className="rounded-xl bg-white p-2 shadow-sm">
                    <Icon className="h-4 w-4 text-[var(--color-primary)]" />
                  </div>
                  <p className="text-sm font-bold text-slate-800">{block.title}</p>
                </div>
                <div className="space-y-2">
                  {block.rows.map((r, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="h-4 w-4 shrink-0 rounded-sm border border-slate-200" style={{ backgroundColor: r.color }} />
                      <span className="text-sm text-slate-700">{r.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Toggle <strong>IDR ↔ Indeks 0–1</strong> tersedia di panel legenda peta — klik tombol di atas kotak legenda untuk beralih mode.
        </div>
      </GuideSection>

      {/* ── Panduan Laporan ───────────────────────────────────────────────── */}
      <GuideSection id="report-guide">
        <SectionHeader
          eyebrow="PANDUAN LAPORAN"
          title="Generate Laporan Analisis"
          desc="Cara menghasilkan laporan PDF regional/nasional dan ekspor data Excel dari dashboard."
        />
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {[
            { title: "Laporan Regional", icon: Map, desc: "Ringkasan risiko satu kabupaten: Loss, AAL, perbandingan Baseline vs Projection, grafik distribusi.", badge: "PDF" },
            { title: "Laporan Nasional", icon: LayoutDashboard, desc: "Agregat seluruh Indonesia: top wilayah terdampak, perbandingan AAL, tabel nasional.", badge: "PDF" },
            { title: "Ekspor Data", icon: FileSpreadsheet, desc: "Data tabular lengkap per kabupaten untuk semua kombinasi hazard, RP, dan skenario.", badge: "XLSX" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-sm"><Icon className="h-5 w-5 text-[var(--color-primary)]" /></div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-slate-900">{item.title}</h3>
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">{item.badge}</span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-4 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <p className="mb-3 text-sm font-bold text-slate-900">Langkah Generate Laporan</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {["Buka Dashboard", "Pilih filter (hazard, RP, skenario)", "Klik tombol Laporan", "Pilih jenis laporan", "Klik Print / Save as PDF"].map((s, i) => (
              <div key={i} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-[10px] font-bold text-white">{i + 1}</span>
                <span className="text-xs text-slate-600">{s}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">Laporan membaca data dari run yang aktif. Pastikan run sudah diaktifkan di Pipeline Monitor sebelum generate laporan.</p>
        </div>
      </GuideSection>

      {/* ── Troubleshooting ───────────────────────────────────────────────── */}
      <GuideSection id="troubleshooting">
        <SectionHeader
          eyebrow="TROUBLESHOOTING"
          title="Masalah & Solusi"
          desc="Referensi cepat untuk kendala yang paling sering ditemui di panel admin PADIS."
        />
        <div className="overflow-hidden rounded-3xl border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Masalah</th>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">Solusi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {troubleshootingItems.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-medium text-slate-800">{item.problem}</td>
                  <td className="px-5 py-3 text-slate-600">{item.solution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GuideSection>

      {/* ── Download CTA ──────────────────────────────────────────────────── */}
      <section className="rounded-3xl border border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-6">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-white p-3 shadow-sm">
              <BookOpen className="h-5 w-5 text-[var(--color-primary)]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Manual Book PADIS</h2>
              <p className="mt-1 text-sm text-slate-600">
                Versi PDF lengkap panduan ini — 8 bab, mencakup seluruh operasional sistem dari data input hingga laporan.
                Simpan untuk referensi offline.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadManual}
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </button>
        </div>
      </section>

    </main>
  );
}
