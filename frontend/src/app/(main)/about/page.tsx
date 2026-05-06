"use client";
import {
  BarChart3,
  Database,
  FileText,
  Globe2,
  GraduationCap,
  Layers3,
  Mail,
  ShieldCheck,
  Users,
  Droplet,
  TrendingDown,
  Map,
  Server,
  Workflow,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";

const techStack = [
  {
    title: "Antarmuka WebGIS",
    desc: "Dashboard dibangun sebagai aplikasi Next.js dan React dengan kontrol filter, autentikasi, serta tampilan analitik yang responsif.",
    items: ["Next.js 16", "React 19", "Tailwind CSS 4", "react-select"],
    icon: Globe2,
  },
  {
    title: "Rendering Peta",
    desc: "Peta interaktif memakai Leaflet dan vector tile agar layer loss, AAL, hazard, dan produksi dapat dimuat efisien.",
    items: ["Leaflet", "React Leaflet", "leaflet.vectorgrid", "MVT tiles"],
    icon: Layers3,
  },
  {
    title: "API & Otorisasi",
    desc: "Backend Flask menyediakan endpoint analitik, layer, tile, laporan, admin, serta autentikasi berbasis token.",
    items: ["Flask 3", "Flask-CORS", "PyJWT", "REST API"],
    icon: ShieldCheck,
  },
  {
    title: "Basis Data Spasial",
    desc: "Data run, wilayah, loss, AAL, hazard, dan produksi terhubung ke PostgreSQL/PostGIS melalui lapisan database Python.",
    items: ["PostgreSQL", "PostGIS", "psycopg2", "SQLAlchemy"],
    icon: Database,
  },
  {
    title: "Pipeline Geospasial",
    desc: "Preprocess, zonal statistics, loss, AAL, dan multi-hazard diproses dengan pustaka geospasial Python.",
    items: ["GeoPandas", "Rasterio", "RasterStats", "Pandas", "NumPy"],
    icon: Workflow,
  },
  {
    title: "Visualisasi & Output",
    desc: "Dashboard dan keluaran analisis memakai chart interaktif, ekspor spreadsheet, serta generator laporan.",
    items: ["Recharts", "openpyxl", "ReportLab", "Matplotlib"],
    icon: BarChart3,
  },
];

const technologyFlow = [
  {
    title: "Input Spasial",
    desc: "Raster hazard, batas administrasi, area sawah, dan data produksi.",
    icon: FileText,
  },
  {
    title: "Analisis",
    desc: "Reproject, overlay, zonal statistics, loss, AAL, dan multi-hazard.",
    icon: Workflow,
  },
  {
    title: "Penyajian Data",
    desc: "REST API, PostGIS, MVT tile, GeoJSON ringan, dan endpoint laporan.",
    icon: Server,
  },
  {
    title: "Eksplorasi",
    desc: "WebGIS, chart, filter analisis, unduhan CSV/XLSX, dan preview laporan.",
    icon: Globe2,
  },
];

const developers = [
  "Thezar Rifqi Izaati",
  "Aletha Nur Fatimah Siswandi Putri",
  "Elicia Hardiyanti",
  "Sonny Okandra Rusman",
  "Andhika Prasetya Adi Nugroho",
];

const supervisors = [
  "Dr. Riantini Virtriana, S.T., M.T.",
  "Prof. Dr. Irwan Meilano, S.T., M.Sc.",
  "Dr. Ir. Irwan Gumilar, S.T., M.Si.",
];

const partnerCards = [
  {
    name: "Kementerian Keuangan Republik Indonesia",
    short: "Kemenkeu",
    logo: "/partners/kemenkeu.png",
  },
  {
    name: "Badan Pusat Statistik Indonesia",
    short: "BPS",
    logo: "/partners/bps.png",
  },
  {
    name: "Kementerian Pertanian Republik Indonesia",
    short: "Kementan",
    logo: "/partners/kementan.svg",
  },
  {
    name: "Badan Nasional Penanggulangan Bencana",
    short: "BNPB",
    logo: "/partners/bnpb.png",
  },
  {
    name: "Badan Penanggulangan Bencana Daerah",
    short: "BPBD",
    logo: "/partners/bpbd.png",
  },
  {
    name: "PT Reasuransi Indonesia Utama",
    short: "RIU",
    logo: "/partners/riu.png",
  },
];

function getInitials(name: string): string {
  const clean = name
    .replace(/^(Prof\.\s*)?(Dr\.\s*)?(Ir\.\s*)*/i, "")
    .split(",")[0]
    .trim();
  return clean
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

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
        <p className="text-muted mt-3 leading-relaxed md:text-base">{desc}</p>
      ) : null}
    </div>
  );
}

export default function AboutPage() {
  return (
    <div className="content-theme">
      <section className="content-hero-gradient relative overflow-hidden text-white">
        <div className="content-hero-overlay" />
        <div className="hero-grid-overlay" />
        <div className="hero-orb hero-orb-primary -left-10 top-10 h-52 w-52" />
        <div className="hero-orb hero-orb-secondary right-0 top-0 h-64 w-64" />
        <div className="hero-orb hero-orb-soft bottom-0 left-1/3 h-40 w-40" />

        <div className="section-container relative py-20 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <span className="badge badge-secondary">Tentang PADIS</span>

            <h1 className="animate-fade-up mt-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Analisis risiko padi
              <span className="mt-1 block text-[var(--color-secondary)]">
                berbasis data spasial
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[var(--content-hero-muted)] md:text-base">
              Platform geospasial untuk estimasi kerugian banjir, kekeringan, dan
              multi-hazard — dari raster hazard hingga Annual Average Loss tingkat
              kabupaten.
            </p>

            {/* Stat strip — communicates scope */}
            <div className="mx-auto mt-10 flex max-w-sm flex-wrap items-center justify-center gap-8">
              {[
                { num: 514, label: "Kab / Kota" },
                { num: 4, label: "Periode Ulang" },
                { num: 2, label: "Hazard Utama" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl font-bold text-white">
                    <CountUp to={stat.num} />
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-[var(--content-hero-soft)]">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/dashboard"
                className="btn-secondary px-5 py-3 font-semibold"
              >
                Buka Dashboard
              </Link>
              <Link
                href="/cara-kerja"
                className="rounded-2xl border border-[var(--content-hero-glass-border)] bg-[var(--content-hero-glass-bg)] px-5 py-3 font-medium text-white transition hover:bg-[var(--content-hero-glass-bg-strong)]"
              >
                Cara Kerja
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell content-section">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            <SectionHeader title="Apa yang Dilakukan PADIS" centered={true} />

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: "Hazard",
                  desc: "PADIS mengolah informasi banjir, kekeringan, dan multi-hazard sebagai dasar analisis risiko pada lahan padi.",
                  icon: Droplet,
                },
                {
                  title: "Kerugian",
                  desc: "Sistem ini menghubungkan hazard, kondisi iklim, dan data padi untuk menghasilkan informasi kerugian yang lebih terukur.",
                  icon: TrendingDown,
                },
                {
                  title: "Visualisasi",
                  desc: "Hasil analisis ditampilkan melalui WebGIS agar lebih mudah dipahami untuk evaluasi dan pengambilan keputusan.",
                  icon: Map,
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="card p-5"
                  >
                    <div className="mb-3 inline-flex rounded-xl bg-[var(--color-primary-soft)] p-2">
                      <Icon className="h-4 w-4 text-[var(--color-primary)]" />
                    </div>
                    <h3 className="text-lg font-semibold text-heading">
                      {item.title}
                    </h3>

                    <p className="mt-2 text-sm leading-relaxed text-muted">
                      {item.desc}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell section-soft">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-start">
              <div>
                <SectionHeader
                  title="Teknologi PADIS"
                  desc="Bagian ini diselaraskan dengan stack yang benar-benar digunakan: WebGIS di frontend, REST API dan tile service di backend, serta pipeline geospasial Python untuk analisis risiko."
                  centered={false}
                />

                <div className="mt-6 space-y-3">
                  {technologyFlow.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div
                        key={step.title}
                        className="group grid grid-cols-[2.5rem_1fr] gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--content-surface)]/80 p-3 shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                      >
                        <div className="flex flex-col items-center">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--content-surface-muted)]">
                            <Icon className="h-4 w-4 text-[var(--color-primary)]" />
                          </div>
                          {index < technologyFlow.length - 1 ? (
                            <div className="mt-2 h-7 w-px bg-[var(--color-border)]" />
                          ) : null}
                        </div>
                        <div className="min-w-0 pb-1">
                          <p className="text-sm font-semibold text-heading">
                            {step.title}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {techStack.map((group, index) => {
                  const Icon = group.icon;
                  const accents = [
                    { card: "card card-accent-primary", iconBg: "bg-[var(--color-primary-soft)]", iconColor: "text-[var(--color-primary)]" },
                    { card: "card card-accent-secondary", iconBg: "bg-[var(--color-secondary-soft)]", iconColor: "text-[var(--color-secondary-dark)]" },
                    { card: "card", iconBg: "bg-[var(--color-primary-soft)]", iconColor: "text-[var(--color-primary)]" },
                    { card: "card", iconBg: "bg-[var(--content-surface-muted)]", iconColor: "text-[var(--color-primary)]" },
                  ];
                  const accent = accents[index % accents.length] ?? accents[0];
                  return (
                    <div
                      key={group.title}
                      className={`${accent.card} flex min-h-[15.5rem] flex-col p-5`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className={`inline-flex rounded-xl ${accent.iconBg} p-2`}>
                          <Icon className={`h-4 w-4 ${accent.iconColor}`} />
                        </div>
                        <span className="rounded-full border border-[var(--color-border)] bg-[var(--content-surface-muted)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                      </div>

                      <h3 className="mt-4 text-lg font-semibold text-heading">
                        {group.title}
                      </h3>

                      <p className="mt-2 text-sm leading-relaxed text-muted">
                        {group.desc}
                      </p>

                      <div className="mt-auto flex flex-wrap gap-2 pt-5">
                        {group.items.map((item) => (
                          <span
                            key={item}
                            className="badge badge-outline"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell content-section">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            {/* Header */}
            <SectionHeader
              label="Capstone Project"
              title="Tim PADIS"
              centered
            />

            {/* ITB identity pill */}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--content-surface-muted)] px-5 py-3 shadow-[var(--shadow-soft)]">
                <img src="/itb/itb.png" alt="Logo ITB" className="h-8 w-auto flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-heading">Teknik Geodesi dan Geomatika</p>
                  <p className="text-xs text-muted">Fakultas Ilmu dan Teknologi Kebumian · Institut Teknologi Bandung</p>
                </div>
              </div>
            </div>

            {/* Developers */}
            <div className="mt-10">
              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--content-surface-muted)] px-3 py-1">
                  <Users className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">Pengembang</span>
                </div>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {developers.map((name) => (
                  <div
                    key={name}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--content-surface)] p-5 text-center shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-bold text-[var(--color-primary)]">
                      {getInitials(name)}
                    </div>
                    <p className="text-sm font-medium leading-snug text-heading">{name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Supervisors */}
            <div className="mt-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--content-surface-muted)] px-3 py-1">
                  <GraduationCap className="h-3.5 w-3.5 text-[var(--color-secondary-dark)]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-secondary-dark)]">Pembimbing</span>
                </div>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {supervisors.map((name) => (
                  <div
                    key={name}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--content-surface)] p-5 text-center shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-secondary-soft)] text-sm font-bold text-[var(--color-secondary-dark)]">
                      {getInitials(name)}
                    </div>
                    <p className="text-sm font-medium leading-snug text-heading">{name}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Contact */}
            <div className="mt-8 flex justify-center">
              <a
                href="mailto:padiswebgis@gmail.com"
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--content-surface-muted)] px-4 py-2 text-sm text-muted transition hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"
              >
                <Mail className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />
                <span className="truncate">Kontak proyek: padiswebgis@gmail.com</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell section-soft">
        <div className="section-container">
          <SectionHeader
            title="Mitra Kolaborasi"
            desc="PADIS dikembangkan dalam kolaborasi lintas institusi yang mendukung analisis risiko, data, dan pengambilan keputusan."
          />

          <div className="relative mt-8 overflow-hidden">
            <div className="partner-fade-left pointer-events-none absolute left-0 top-0 z-10 h-full w-16" />
            <div className="partner-fade-right pointer-events-none absolute right-0 top-0 z-10 h-full w-16" />

            <div className="partner-marquee">
              <div className="partner-track">
                {[...partnerCards, ...partnerCards].map((item, index) => (
                  <div
                    key={`${item.short}-${index}`}
                    className="group mx-3 flex min-w-[220px] max-w-[220px] flex-col items-center rounded-3xl border border-[var(--color-border)] bg-[var(--content-surface)] px-5 py-5 text-center shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--content-logo-tile-bg)] p-3 shadow-sm">
                      {item.logo ? (
                        <Image
                          src={item.logo}
                          alt={item.short}
                          width={64}
                          height={64}
                          className="h-full w-full object-contain opacity-90 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
                        />
                      ) : (
                        <span className="text-sm font-bold text-[var(--color-primary)]">
                          {item.short}
                        </span>
                      )}
                    </div>

                    <p className="mt-4 text-sm font-semibold text-heading">
                      {item.short}
                    </p>

                    <p className="mt-1 text-xs leading-relaxed text-muted">
                      {item.name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

     <section className="section-shell content-section">
      <div className="section-container">
        <div className="content-cta-panel relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] p-10 text-center shadow-[var(--shadow-lg)]">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-10 top-10 h-40 w-40 rounded-full bg-[var(--color-primary)]/10 blur-3xl" />
            <div className="absolute right-10 bottom-10 h-40 w-40 rounded-full bg-[var(--color-secondary)]/10 blur-3xl" />
          </div>

          <div className="relative z-10">
            <img
              src="/logo/padis.svg"
              alt="Logo PADIS"
              className="mx-auto h-12 w-auto opacity-90"
            />

            <h2 className="mt-4 text-heading text-2xl font-bold tracking-tight md:text-3xl">
              Semoga{" "}
              <span className="text-[var(--color-primary)]">PADIS</span>{" "}
              Membantu!
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
              PADIS hadir untuk mendukung analisis risiko padi yang terstruktur dan berbasis data spasial.
            </p>
          </div>
        </div>
      </div>
    </section>
    </div>
  );
}
