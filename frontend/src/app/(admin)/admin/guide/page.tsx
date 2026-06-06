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

// ─── Manual book download ───────────────────────────────────────────────────

function handleDownloadManual() {
  const link = document.createElement('a');
  link.href = '/manual-book/PADIS_User-Guide.pdf';
  link.download = 'PADIS_User-Guide.pdf';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
