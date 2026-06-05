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
import { useLanguage } from "@/contexts/LanguageContext";

const developers = [
  {
    name: "Thezar Rifqi Izaati",
    email: "thezarizaati@gmail.com",
    linkedin: "https://www.linkedin.com/in/thezar-rifqi-izaati-996066257/",
  },
  {
    name: "Aletha Nur Fatimah Siswandi Putri",
    email: "alethaputri40@gmail.com",
    linkedin: "https://www.linkedin.com/in/alethaaanf/",
  },
  {
    name: "Elicia Hardiyanti",
    email: "eeliciahardiyanti@gmail.com",
    linkedin: "https://www.linkedin.com/in/eeliciahardiyanti/",
  },
  {
    name: "Sonny Okandra Rusman",
    email: "sonnyokandra@gmail.com",
    linkedin: "https://www.linkedin.com/in/sonnyor/",
  },
  {
    name: "Andhika Prasetya Adi Nugroho",
    email: "AndhikaPrasetya68@gmail.com",
    linkedin: "https://www.linkedin.com/in/andhika-prasetya-adi-nugroho-160278205/",
  },
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
    role: "Kebijakan Keuangan & Data Fiskal",
  },
  {
    name: "Badan Pusat Statistik Indonesia",
    short: "BPS",
    logo: "/partners/bps.png",
    role: "Data Statistik & Total Produksi Padi",
  },
  {
    name: "Kementerian Pertanian Republik Indonesia",
    short: "Kementan",
    logo: "/partners/kementan.svg",
    role: "Harga Gabah Kering Panen (GKP)",
  },
  {
    name: "Badan Nasional Penanggulangan Bencana",
    short: "BNPB",
    logo: "/partners/bnpb.png",
    role: "Data Historis Bencana Nasional",
  },
  {
    name: "Badan Penanggulangan Bencana Daerah",
    short: "BPBD",
    logo: "/partners/bpbd.png",
    role: "Penanggulangan Bencana Daerah",
  },
  {
    name: "PT Reasuransi Indonesia Utama",
    short: "RIU",
    logo: "/partners/riu.png",
    role: "Kolaborasi Asuransi Risiko Bencana",
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
  const { t } = useLanguage();

  const techStack = [
    {
      title: t("about.webgisLabel"),
      desc: t("about.webgisDesc"),
      items: ["Next.js 16", "React 19", "Tailwind CSS 4", "react-select"],
      icon: Globe2,
    },
    {
      title: t("about.mapLabel"),
      desc: t("about.mapDesc"),
      items: ["Leaflet", "React Leaflet", "leaflet.vectorgrid", "MVT tiles"],
      icon: Layers3,
    },
    {
      title: t("about.apiLabel"),
      desc: t("about.apiDesc"),
      items: ["Flask 3", "Flask-CORS", "PyJWT", "REST API"],
      icon: ShieldCheck,
    },
    {
      title: t("about.dbLabel"),
      desc: t("about.dbDesc"),
      items: ["PostgreSQL", "PostGIS", "psycopg2", "SQLAlchemy"],
      icon: Database,
    },
    {
      title: t("about.pipelineLabel"),
      desc: t("about.pipelineDesc"),
      items: ["GeoPandas", "Rasterio", "RasterStats", "Pandas", "NumPy"],
      icon: Workflow,
    },
    {
      title: t("about.vizOutLabel"),
      desc: t("about.vizOutDesc"),
      items: ["Recharts", "openpyxl", "ReportLab", "Matplotlib"],
      icon: BarChart3,
    },
  ];

  const technologyFlow = [
    {
      title: t("about.inputLabel"),
      desc: t("about.inputDesc"),
      icon: FileText,
    },
    {
      title: t("about.analysisLabel"),
      desc: t("about.analysisDesc"),
      icon: Workflow,
    },
    {
      title: t("about.dataLabel"),
      desc: t("about.dataDesc"),
      icon: Server,
    },
    {
      title: t("about.explorationLabel"),
      desc: t("about.explorationDesc"),
      icon: Globe2,
    },
  ];

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
            <span className="badge badge-secondary">{t("about.badge")}</span>

            <h1 className="animate-fade-up mt-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              {t("about.title1")}
              <span className="mt-1 block text-[var(--color-secondary)]">
                {t("about.title2")}
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-[var(--content-hero-muted)] md:text-base">
              {t("about.description")}
            </p>

            {/* Stat strip — communicates scope */}
            <div className="mx-auto mt-10 flex max-w-sm flex-wrap items-center justify-center gap-8">
              {[
                { num: 514, label: t("about.stat1Label") },
                { num: 4, label: t("about.stat2Label") },
                { num: 2, label: t("about.stat3Label") },
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
                {t("about.openDashboard")}
              </Link>
              <Link
                href="/cara-kerja"
                className="rounded-2xl border border-[var(--content-hero-glass-border)] bg-[var(--content-hero-glass-bg)] px-5 py-3 font-medium text-white transition hover:bg-[var(--content-hero-glass-bg-strong)]"
              >
                {t("about.howItWorks")}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell content-section">
        <div className="section-container">
          <div className="mx-auto max-w-5xl">
            <SectionHeader title={t("about.whatDoesTitle")} centered={true} />

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                {
                  title: t("about.hazardLabel"),
                  desc: t("about.hazardDesc"),
                  icon: Droplet,
                },
                {
                  title: t("about.lossLabel"),
                  desc: t("about.lossDesc"),
                  icon: TrendingDown,
                },
                {
                  title: t("about.vizLabel"),
                  desc: t("about.vizDesc"),
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
                  title={t("about.techTitle")}
                  desc={t("about.techDesc")}
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
              label={t("about.capstoneLabel")}
              title={t("about.teamTitle")}
              centered
            />

            {/* ITB identity pill */}
            <div className="mt-6 flex justify-center">
              <div className="inline-flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--content-surface-muted)] px-5 py-3 shadow-[var(--shadow-soft)]">
                <img src="/itb/itb.png" alt="Logo ITB" className="h-8 w-auto flex-shrink-0" />
                <div className="text-left">
                  <p className="text-sm font-semibold text-heading">{t("about.program")}</p>
                  <p className="text-xs text-muted">{t("about.faculty")}</p>
                </div>
              </div>
            </div>

            {/* Developers */}
            <div className="mt-10">
              <div className="mb-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-[var(--color-border)]" />
                <div className="flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--content-surface-muted)] px-3 py-1">
                  <Users className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-primary)]">{t("about.developersLabel")}</span>
                </div>
                <div className="h-px flex-1 bg-[var(--color-border)]" />
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                {developers.map((dev) => (
                  <div
                    key={dev.name}
                    className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--content-surface)] p-5 text-center shadow-[var(--shadow-soft)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-sm font-bold text-[var(--color-primary)]">
                      {getInitials(dev.name)}
                    </div>
                    <p className="flex-1 text-sm font-medium leading-snug text-heading">{dev.name}</p>
                    <div className="flex items-center gap-2">
                      {dev.linkedin && (
                        <a
                          href={dev.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`LinkedIn ${dev.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--content-surface-muted)] text-[#0077b5] transition hover:border-[#0077b5] hover:bg-[#0077b5] hover:text-white"
                        >
                          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5">
                            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                          </svg>
                        </a>
                      )}
                      {dev.email && (
                        <a
                          href={`mailto:${dev.email}`}
                          aria-label={`Email ${dev.name}`}
                          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--content-surface-muted)] text-[var(--color-primary)] transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary)] hover:text-white"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
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
                  <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-secondary-dark)]">{t("about.supervisorsLabel")}</span>
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
                <span className="truncate">{t("about.contactEmail")}</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section-shell section-soft">
        <div className="section-container">
          <SectionHeader
            title={t("about.partnersTitle")}
            desc={t("about.partnersDesc")}
          />

          <div className="mx-auto mt-10 grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3">
            {partnerCards.map((item) => (
              <div
                key={item.short}
                className="group flex flex-col items-center rounded-2xl border border-[var(--color-border)] bg-[var(--content-surface)] p-3 text-center shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-md)] sm:p-6"
              >
                {/* Logo tile */}
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--content-logo-tile-bg)] p-2.5">
                  {item.logo ? (
                    <Image
                      src={item.logo}
                      alt={item.short}
                      width={56}
                      height={56}
                      className="h-full w-full object-contain opacity-85 transition duration-300 group-hover:scale-105 group-hover:opacity-100"
                    />
                  ) : (
                    <span className="text-sm font-bold text-[var(--color-primary)]">
                      {item.short}
                    </span>
                  )}
                </div>

                {/* Name */}
                <p className="mt-3 text-sm font-bold text-heading">{item.short}</p>
                <p className="mt-1 text-xs leading-snug text-muted">{item.name}</p>

                {/* Role pill */}
                <span className="mt-3 rounded-full border border-[var(--color-border)] bg-[var(--content-surface-muted)] px-2.5 py-1 text-[10px] font-medium text-muted">
                  {item.role}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

     <section className="section-shell content-section">
      <div className="section-container">
        <div className="content-cta-panel relative overflow-hidden rounded-[2rem] border border-[var(--color-border)] p-6 text-center shadow-[var(--shadow-lg)] sm:p-10">
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
              {t("about.hopeTitle")}
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-muted md:text-base">
              {t("about.hopeDesc")}
            </p>
          </div>
        </div>
      </div>
    </section>
    </div>
  );
}
