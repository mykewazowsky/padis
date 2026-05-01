"use client";
import {
  Database,
  Globe2,
  GraduationCap,
  Mail,
  ShieldCheck,
  Users,
  Droplet,
  TrendingDown,
  Map,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import CountUp from "@/components/ui/CountUp";

const techStack = [
  {
    title: "Frontend",
    items: ["Next.js", "Tailwind CSS", "React Leaflet", "Recharts"],
    icon: Globe2,
  },
  {
    title: "Backend",
    items: ["Flask", "REST API", "Authentication", "Admin Process Control"],
    icon: ShieldCheck,
  },
  {
    title: "Geospasial & Data",
    items: [
      "GeoPandas",
      "RasterStats",
      "GeoJSON / GPKG / CSV",
      "File-based geospatial pipeline",
    ],
    icon: Database,
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
    <>
      <section className="section-gradient-primary relative overflow-hidden text-white">
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

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-blue-100 md:text-base">
              Platform geospasial untuk estimasi kerugian banjir, kekeringan, dan
              multi-hazard — dari raster hazard hingga Annual Average Loss tingkat
              kabupaten.
            </p>

            {/* Stat strip — communicates scope */}
            <div className="mx-auto mt-10 flex max-w-sm flex-wrap items-center justify-center gap-8">
              {[
                { num: 514, label: "Kab / Kota" },
                { num: 4, label: "Return Period" },
                { num: 2, label: "Hazard Utama" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <p className="text-3xl font-bold text-white">
                    <CountUp to={stat.num} />
                  </p>
                  <p className="mt-0.5 text-xs font-medium text-blue-200">{stat.label}</p>
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
                className="rounded-2xl border border-white/20 bg-white/10 px-5 py-3 font-medium text-white transition hover:bg-white/15"
              >
                Cara Kerja
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell bg-white">
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
            <SectionHeader title="Teknologi PADIS" centered={true} />

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {techStack.map((group, index) => {
                const Icon = group.icon;
                const accents = [
                  { card: "card card-accent-primary", iconBg: "bg-[var(--color-primary-soft)]", iconColor: "text-[var(--color-primary)]" },
                  { card: "card card-accent-secondary", iconBg: "bg-[var(--color-secondary-soft)]", iconColor: "text-[var(--color-secondary-dark)]" },
                  { card: "card", iconBg: "bg-[var(--color-primary-soft)]", iconColor: "text-[var(--color-primary)]" },
                ];
                const accent = accents[index] ?? accents[0];
                return (
                  <div
                    key={group.title}
                    className={`${accent.card} p-5`}
                  >
                    <div className={`mb-3 inline-flex rounded-xl ${accent.iconBg} p-2`}>
                      <Icon className={`h-4 w-4 ${accent.iconColor}`} />
                    </div>

                    <h3 className="text-lg font-semibold text-heading">
                      {group.title}
                    </h3>

                    <div className="mt-4 flex flex-wrap gap-2">
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
      </section>

      <section className="section-shell bg-white">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2 className="text-heading text-2xl font-bold tracking-tight md:text-3xl">
                Tim Capstone Project:{" "}
                <span className="text-[var(--color-primary)]">PADIS</span>
              </h2>
            </div>

            <div className="mt-4 flex flex-col items-center justify-center gap-2 text-center md:flex-row md:text-left">
              <img src="/itb/itb.png" alt="Logo ITB" className="h-9 w-auto" />
              <div>
                <p className="text-sm font-medium text-heading">
                  Program Studi Teknik Geodesi dan Geomatika
                </p>
                <p className="text-sm text-muted">
                  Fakultas Ilmu dan Teknologi Kebumian · Institut Teknologi Bandung
                </p>
              </div>
            </div>

            <div className="decor-line mt-6" />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div className="card card-accent-primary p-5">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-[var(--color-primary)]" />
                  <h3 className="text-base font-semibold text-heading">
                    Pengembang
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4">
                  {developers.map((item) => (
                    <li key={item} className="text-sm leading-relaxed text-muted">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card card-accent-secondary p-5">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-[var(--color-secondary-dark)]" />
                  <h3 className="text-base font-semibold text-heading">
                    Pembimbing
                  </h3>
                </div>
                <ul className="mt-4 space-y-2 border-t border-[var(--color-border)] pt-4">
                  {supervisors.map((item) => (
                    <li key={item} className="text-sm leading-relaxed text-muted">
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-5 flex justify-center">
              <a
                href="mailto:padiswebgis@gmail.com"
                className="inline-flex max-w-full items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-primary-soft)]/35 px-4 py-2 text-sm text-muted transition hover:border-[var(--color-primary)]/30 hover:text-[var(--color-primary)]"
              >
                <Mail className="h-4 w-4 flex-shrink-0 text-[var(--color-primary)]" />
                <span className="truncate">
                  Kontak proyek: padiswebgis@gmail.com
                </span>
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
                    className="group mx-3 flex min-w-[220px] max-w-[220px] flex-col items-center rounded-3xl border border-[var(--color-border)] bg-white px-5 py-5 text-center shadow-[var(--shadow-soft)] transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
                  >
                    <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-white p-3">
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

     <section className="section-shell bg-white">
      <div className="section-container">
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-primary-soft)]/40 via-white to-[var(--color-secondary-soft)]/30 p-10 text-center shadow-[var(--shadow-lg)]">
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
    </>
  );
}
