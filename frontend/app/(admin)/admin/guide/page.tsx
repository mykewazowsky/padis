"use client";

import {
  AlertTriangle,
  BookOpen,
  Database,
  FileOutput,
  Layers3,
  Settings2,
  ShieldCheck,
  Users,
  Workflow,
  Wrench,
  ChevronRight,
  FileText,
  TableProperties,
  FolderTree,
} from "lucide-react";

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

const guideNavItems: GuideNavItem[] = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "upload-standard", label: "Upload Standard", icon: FolderTree },
  { id: "attribute-standard", label: "Attribute Standard", icon: TableProperties },
  { id: "process-flow", label: "Process Flow", icon: Workflow },
  { id: "output-reference", label: "Output Reference", icon: FileOutput },
  { id: "menu-guide", label: "Admin Menu Guide", icon: Settings2 },
  { id: "usage-flow", label: "Usage Flow", icon: ChevronRight },
  { id: "troubleshooting", label: "Troubleshooting", icon: AlertTriangle },
];

const uploadRules: UploadRule[] = [
  {
    name: "Admin Boundary",
    format: ".shp, .dbf, .shx, .prj, .geojson, .gpkg",
    filename: "batas_adm_kabkota.*",
    destination: "data/raw",
    notes: [
      "Digunakan sebagai referensi utama agregasi kabupaten/kota.",
      "Disarankan memiliki field id_kabkota, kab_kota, dan prov.",
      "Pastikan geometri valid dan tidak korup.",
    ],
  },
  {
    name: "Sawah Layer",
    format: ".shp, .dbf, .shx, .prj, .geojson, .gpkg",
    filename: "lulc_sawah.*",
    destination: "data/raw",
    notes: [
      "Digunakan sebagai layer sawah sumber untuk overlay.",
      "Pastikan layer benar-benar merepresentasikan area sawah.",
      "Disarankan polygon bersih dan tidak self-intersect.",
    ],
  },
  {
    name: "Total Produksi Padi",
    format: ".csv",
    filename: "total_prod_padi.csv",
    destination: "data/raw",
    notes: [
      "Dipakai untuk menghitung loss ekonomi.",
      "Pastikan encoding CSV aman dibaca UTF-8 atau UTF-8-SIG.",
      "Gunakan identifier wilayah yang konsisten dengan admin boundary.",
    ],
  },
  {
    name: "Flood Raster Set",
    format: ".tif / .tiff",
    filename: "R25, R50, R100, R250, RC25, RC50, RC100, RC250",
    destination: "data/raw",
    notes: [
      "Nama file harus sesuai standar agar lolos validasi upload.",
      "Set flood ideal mencakup current dan climate scenario.",
      "Gunakan raster yang siap dipreprocess ke CRS target pipeline.",
    ],
  },
  {
    name: "Drought Raster Set",
    format: ".tif / .tiff",
    filename: "mme_rp25, mme_rp50, mme_rp100, mme_rp250, gpm_rp25, gpm_rp50, gpm_rp100, gpm_rp250",
    destination: "data/raw",
    notes: [
      "Nama file harus sesuai standar validasi upload.",
      "Set drought ideal mencakup seluruh MME dan GPM scenario.",
      "Pastikan raster bisa dibaca dan extent/CRS valid.",
    ],
  },
];

const attributeRules: AttributeRule[] = [
  {
    dataset: "Admin Boundary",
    attributes: [
      {
        name: "id_kabkota",
        type: "string / integer",
        required: true,
        description: "Identifier unik kabupaten/kota untuk join dan agregasi.",
      },
      {
        name: "kab_kota",
        type: "string",
        required: true,
        description: "Nama kabupaten/kota yang dipakai di dashboard dan laporan.",
      },
      {
        name: "prov",
        type: "string",
        required: true,
        description: "Nama provinsi untuk grouping dan tampilan informasi.",
      },
    ],
  },
  {
    dataset: "Total Produksi Padi CSV",
    attributes: [
      {
        name: "id_kabkota",
        type: "string / integer",
        required: true,
        description: "Identifier wilayah yang konsisten dengan admin boundary.",
      },
      {
        name: "kab_kota",
        type: "string",
        required: true,
        description: "Nama kabupaten/kota untuk verifikasi manual.",
      },
      {
        name: "prov",
        type: "string",
        required: false,
        description: "Provinsi, disarankan untuk validasi tambahan.",
      },
      {
        name: "total_prod_padi",
        type: "number",
        required: true,
        description: "Nilai total produksi padi yang dipakai dalam kalkulasi loss.",
      },
    ],
  },
  {
    dataset: "Sawah Layer",
    attributes: [
      {
        name: "geometry",
        type: "polygon / multipolygon",
        required: true,
        description: "Geometri area sawah yang valid dan dapat dioverlay.",
      },
    ],
  },
];

const processModes = [
  {
    title: "Full",
    desc: "Menjalankan seluruh tahapan pipeline dari awal sampai output web layer final.",
  },
  {
    title: "Preprocess",
    desc: "Menjalankan tahap persiapan data awal seperti reprojection atau raster preprocessing.",
  },
  {
    title: "Analysis",
    desc: "Menjalankan analisis utama seperti zonal statistics, loss, AAL, dan agregasi.",
  },
  {
    title: "Web",
    desc: "Menyiapkan layer akhir yang dipakai untuk dashboard dan WebGIS frontend.",
  },
];

const adminMenuGuides = [
  {
    title: "Overview",
    icon: BookOpen,
    desc: "Menampilkan ringkasan sistem, status proses, jumlah output, dan statistik user/admin.",
  },
  {
    title: "Data Management",
    icon: Database,
    desc: "Digunakan untuk upload data, melihat preview, menghapus file tertentu, dan memilih active source.",
  },
  {
    title: "Process Control",
    icon: Workflow,
    desc: "Digunakan untuk mengecek dependency pipeline, menjalankan analisis, dan memantau progress proses.",
  },
  {
    title: "Outputs",
    icon: FileOutput,
    desc: "Dipakai untuk melihat output terbaru, preview file CSV/GeoJSON, dan mengunduh file hasil.",
  },
  {
    title: "Users",
    icon: Users,
    desc: "Dipakai admin untuk mengelola akun, mengganti role user, dan mengubah status active/inactive.",
  },
  {
    title: "Admin Guide",
    icon: ShieldCheck,
    desc: "Dokumentasi operasional panel admin, format data, atribut wajib, dan panduan penggunaan.",
  },
];

const outputReferences = [
  {
    name: "kabkota_flood_aal_v2.csv",
    meaning: "Output AAL final untuk hazard flood.",
  },
  {
    name: "kabkota_drought_aal_v2.csv",
    meaning: "Output AAL final untuk hazard drought.",
  },
  {
    name: "kabkota_multihazard_aal_v2.csv",
    meaning: "Output AAL final untuk multi-hazard.",
  },
  {
    name: "web_flood_*_v2.geojson",
    meaning: "Layer web flood yang dipakai dashboard frontend.",
  },
  {
    name: "web_drought_*_v2.geojson",
    meaning: "Layer web drought yang dipakai dashboard frontend.",
  },
  {
    name: "web_multi_*_v2.geojson",
    meaning: "Layer web multi-hazard yang dipakai dashboard frontend.",
  },
];

const troubleshooting = [
  "Jika upload gagal, periksa nama file, ekstensi, dan struktur data.",
  "Jika preview kosong, cek apakah file benar-benar tersimpan di folder target.",
  "Jika process gagal, periksa dependency script, raw input, dan log proses terakhir.",
  "Jika output tidak muncul di dashboard, cek apakah file aktif adalah versi _v2 yang benar.",
  "Jika user tidak bisa akses admin, pastikan role adalah admin dan status akun active.",
];

function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc: string;
}) {
  return (
    <div className="mb-5">
      <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
        {title}
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
        {desc}
      </p>
    </div>
  );
}

function GuideSection({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {children}
    </section>
  );
}

export default function AdminGuidePage() {
  return (
    <main className="space-y-6">
      <section
        id="overview"
        className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-7"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <p className="text-sm font-semibold tracking-[0.18em] text-[var(--color-primary)]">
              ADMIN GUIDE
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              PADIS Admin Operational Manual
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-relaxed text-slate-600 md:text-base">
              Panduan operasional untuk admin PADIS yang mencakup standar data,
              atribut wajib, alur proses, referensi output, dan penggunaan
              setiap menu administrasi.
            </p>
          </div>

          <div className="rounded-2xl border border-[var(--color-secondary)] bg-[var(--color-secondary-soft)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-secondary-dark)]">
              Document Scope
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              Admin Panel Internal
            </p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit rounded-3xl border border-slate-200 bg-slate-50 p-4 xl:sticky xl:top-24">
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-2xl bg-white p-2 shadow-sm">
                <FileText className="h-4 w-4 text-[var(--color-primary)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Quick Navigation
                </p>
                <p className="text-xs text-slate-500">
                  Lompat cepat ke section penting
                </p>
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
                  <div className="rounded-2xl bg-white p-2 shadow-sm">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      Tujuan Guide
                    </p>
                    <p className="mt-1 text-sm text-blue-800">
                      Membantu admin memahami aturan data dan penggunaan sistem.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-2 shadow-sm">
                    <Settings2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-900">
                      Fokus Operasional
                    </p>
                    <p className="mt-1 text-sm text-emerald-800">
                      Data upload, process control, outputs, dan user management.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-2 shadow-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      Catatan Penting
                    </p>
                    <p className="mt-1 text-sm text-amber-800">
                      Pastikan format file, atribut, dan nama file sesuai standar sebelum menjalankan pipeline.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">
                Ringkasan isi guide
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Halaman ini menjelaskan standar upload data, atribut minimum,
                mode proses analisis, referensi output, fungsi setiap menu admin,
                urutan kerja yang disarankan, dan troubleshooting dasar.
              </p>
            </div>
          </div>
        </div>
      </section>

      <GuideSection id="upload-standard">
        <SectionHeader
          eyebrow="UPLOAD STANDARD"
          title="Format Data yang Didukung"
          desc="Gunakan format, nama file, dan lokasi penyimpanan sesuai standar agar data dapat dibaca dan diproses oleh pipeline PADIS."
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {uploadRules.map((item) => (
            <div
              key={item.name}
              className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
            >
              <h3 className="text-lg font-bold text-slate-900">{item.name}</h3>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>
                  <span className="font-semibold text-slate-800">Format:</span>{" "}
                  {item.format}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Nama file:</span>{" "}
                  {item.filename}
                </p>
                <p>
                  <span className="font-semibold text-slate-800">Folder tujuan:</span>{" "}
                  {item.destination}
                </p>
              </div>

              <div className="mt-4 space-y-2">
                {item.notes.map((note, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
                  >
                    {note}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </GuideSection>

      <GuideSection id="attribute-standard">
        <SectionHeader
          eyebrow="ATTRIBUTE STANDARD"
          title="Atribut Wajib dan Disarankan"
          desc="Pastikan data yang diunggah memiliki field minimum yang dibutuhkan untuk agregasi, join, analisis, dan tampilan dashboard."
        />

        <div className="space-y-5">
          {attributeRules.map((rule) => (
            <div
              key={rule.dataset}
              className="overflow-hidden rounded-3xl border border-slate-200"
            >
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <h3 className="text-lg font-bold text-slate-900">
                  {rule.dataset}
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white">
                    <tr className="border-b border-slate-200">
                      <th className="px-5 py-3 text-left font-semibold text-slate-700">
                        Attribute
                      </th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-700">
                        Type
                      </th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-700">
                        Required
                      </th>
                      <th className="px-5 py-3 text-left font-semibold text-slate-700">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rule.attributes.map((attr) => (
                      <tr key={attr.name} className="border-b border-slate-100">
                        <td className="px-5 py-3 font-medium text-slate-900">
                          {attr.name}
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {attr.type}
                        </td>
                        <td className="px-5 py-3">
                          <span
                            className={
                              attr.required
                                ? "rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"
                                : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                            }
                          >
                            {attr.required ? "Required" : "Optional"}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-slate-600">
                          {attr.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </GuideSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <GuideSection id="process-flow">
          <SectionHeader
            eyebrow="PROCESS FLOW"
            title="Mode Pipeline"
            desc="Pilih mode proses sesuai kebutuhan eksekusi agar analisis berjalan efisien dan sesuai dependency data."
          />

          <div className="space-y-3">
            {processModes.map((mode) => (
              <div
                key={mode.title}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-sm font-semibold text-slate-900">
                  {mode.title}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {mode.desc}
                </p>
              </div>
            ))}
          </div>
        </GuideSection>

        <GuideSection id="output-reference">
          <SectionHeader
            eyebrow="OUTPUT REFERENCE"
            title="Referensi Output Utama"
            desc="File berikut adalah output yang paling penting untuk analisis, monitoring admin, dan dashboard frontend."
          />

          <div className="space-y-3">
            {outputReferences.map((item) => (
              <div
                key={item.name}
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <p className="text-sm font-semibold break-all text-slate-900">
                  {item.name}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  {item.meaning}
                </p>
              </div>
            ))}
          </div>
        </GuideSection>
      </div>

      <GuideSection id="menu-guide">
        <SectionHeader
          eyebrow="ADMIN MENU GUIDE"
          title="Panduan Setiap Menu Admin"
          desc="Gunakan ringkasan ini untuk memahami fungsi inti tiap halaman di panel administrasi PADIS."
        />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 2xl:grid-cols-3">
          {adminMenuGuides.map((item) => {
            const Icon = item.icon;

            return (
              <div
                key={item.title}
                className="rounded-3xl border border-slate-200 bg-slate-50 p-5"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-2xl bg-white p-3 shadow-sm">
                    <Icon className="h-5 w-5 text-[var(--color-primary)]" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {item.desc}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GuideSection>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <GuideSection id="usage-flow">
          <SectionHeader
            eyebrow="USAGE FLOW"
            title="Urutan Kerja Admin yang Disarankan"
            desc="Alur berikut membantu admin menjalankan PADIS secara lebih aman dan konsisten."
          />

          <div className="space-y-3">
            {[
              "Periksa data input pada menu Data Management.",
              "Pastikan file utama aktif dan dependency tersedia.",
              "Jalankan pipeline yang sesuai di Process Control.",
              "Pantau progress, status, dan log proses.",
              "Periksa hasil di menu Outputs.",
              "Validasi apakah output final sudah terbaca di dashboard frontend.",
            ].map((step, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary)] text-sm font-bold text-white">
                  {idx + 1}
                </div>
                <p className="pt-1 text-sm leading-relaxed text-slate-600">
                  {step}
                </p>
              </div>
            ))}
          </div>
        </GuideSection>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <SectionHeader
            eyebrow="LEGEND"
            title="Jenis Konten Guide"
            desc="Ringkasan ikon dan konteks dokumentasi operasional."
          />

          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Database className="mt-0.5 h-4 w-4 text-blue-600" />
              <p className="text-slate-600">Standar data dan struktur upload</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Layers3 className="mt-0.5 h-4 w-4 text-emerald-600" />
              <p className="text-slate-600">Layer spasial dan kebutuhan atribut</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <Workflow className="mt-0.5 h-4 w-4 text-amber-600" />
              <p className="text-slate-600">Tahapan proses dan alur analisis</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <FileOutput className="mt-0.5 h-4 w-4 text-purple-600" />
              <p className="text-slate-600">Output final untuk dashboard dan admin</p>
            </div>
          </div>
        </section>
      </div>

      <GuideSection id="troubleshooting">
        <SectionHeader
          eyebrow="TROUBLESHOOTING"
          title="Masalah Umum"
          desc="Gunakan daftar ini sebagai acuan awal saat menemukan kendala di panel admin PADIS."
        />

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {troubleshooting.map((item, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-relaxed text-slate-600"
            >
              {item}
            </div>
          ))}
        </div>
      </GuideSection>

      <section className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            <Wrench className="h-5 w-5 text-[var(--color-primary)]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Catatan Pengembangan Selanjutnya
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Ke depan, guide ini bisa dikembangkan lagi dengan contoh template
              CSV, contoh struktur atribut GeoJSON atau GPKG, dependency checklist
              tiap hazard, quick FAQ error pipeline, dan tombol unduh template.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}